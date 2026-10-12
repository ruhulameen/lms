"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { postFieldsSchema, planRestore, snapshotsEqual, statusActivity } from "@/lib/blog-post";
import {
  allowedTransitions,
  canTransition,
  publishFieldsSchema,
  statusFields,
  type ContentStatusValue,
} from "@/lib/content-status";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { diffSnapshots, type PostSnapshot } from "@/lib/revision-diff";
import { isEmptyDocument } from "@/lib/rich-text";
import { seoFieldsSchema } from "@/lib/seo";
import { nextFreeSlug, slugify } from "@/lib/slug";
import { logActivity } from "@/services/activity";
import { isValidAuthor } from "@/services/post";
import { createPostRevision } from "@/services/revision";
import { deleteSeo, getSeo, upsertSeo } from "@/services/seo";
import { authorizeAction, can, type CurrentUser } from "@/services/user";

const NOT_FOUND = "This post no longer exists.";
const LOCKED = "This post is published, scheduled or archived. Only someone who can publish posts may change it.";
const TAG_NAME_MAX = 50;

type Tx = Prisma.TransactionClient;

function refresh() {
  // The public pages are rendered per request; this also clears the client router cache.
  revalidatePath("/blog", "layout");
  revalidatePath("/admin/blog", "layout");
  revalidatePath("/admin");
}

function invalid(error: z.ZodError | Record<string, string[]>, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: error instanceof z.ZodError ? z.flattenError(error).fieldErrors : error,
    values: formValues(formData),
  };
}

function fieldError(field: string, message: string, formData: FormData): FormState {
  return { ok: false, error: message, fieldErrors: { [field]: [message] }, values: formValues(formData) };
}

function idFrom(value: FormDataEntryValue | null) {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Everything a revision records plus the columns it does not.
async function readState(client: Tx | typeof db, id: number) {
  const post = await client.blogPost.findUnique({
    where: { id },
    select: {
      title: true,
      slug: true,
      excerpt: true,
      body: true,
      categoryId: true,
      featuredImageId: true,
      authorId: true,
      featured: true,
      status: true,
      publishAt: true,
      publishedAt: true,
      tags: { select: { tagId: true } },
    },
  });
  if (!post) return null;
  const seo = await getSeo("POST", id, client);
  const snapshot: PostSnapshot = {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    seo,
    categoryId: post.categoryId,
    tagIds: post.tags.map((t) => t.tagId),
  };
  return { ...post, snapshot };
}

type Parsed = {
  fields: z.output<typeof postFieldsSchema>;
  seo: z.output<typeof seoFieldsSchema>;
  status: ContentStatusValue;
  publishAt: Date | null;
  tagIds: number[];
  newTags: string[];
};

function parseForm(formData: FormData): { ok: true; data: Parsed } | { ok: false; state: FormState } {
  const raw = Object.fromEntries(formData);
  const fields = postFieldsSchema.safeParse(raw);
  const seo = seoFieldsSchema.safeParse(raw);
  const publish = publishFieldsSchema.safeParse(raw);

  const errors: Record<string, string[]> = {};
  if (!fields.success) Object.assign(errors, z.flattenError(fields.error).fieldErrors);
  if (!seo.success) Object.assign(errors, z.flattenError(seo.error).fieldErrors);
  if (!publish.success) Object.assign(errors, z.flattenError(publish.error).fieldErrors);

  const tagIds = [...new Set(formData.getAll("tagIds").map(idFrom).filter((n): n is number => n !== null))];
  const newTags = [...new Set(formData.getAll("newTags").map((v) => String(v).trim()).filter(Boolean))];
  if (newTags.some((name) => name.length > TAG_NAME_MAX || !slugify(name))) {
    errors.tags = [`Tag names need letters or numbers and at most ${TAG_NAME_MAX} characters.`];
  }

  if (!fields.success || !seo.success || !publish.success || Object.keys(errors).length > 0) {
    return { ok: false, state: invalid(errors, formData) };
  }
  return {
    ok: true,
    data: { fields: fields.data, seo: seo.data, status: publish.data.status, publishAt: publish.data.publishAt, tagIds, newTags },
  };
}

// Checks that need the database; returns a form error or null.
async function checkReferences(
  data: Parsed,
  formData: FormData,
  options: { postId: number | null; currentAuthorId: number | null; actor: CurrentUser; canPublish: boolean },
): Promise<FormState | null> {
  const { fields } = data;
  if (await db.blogPost.findFirst({ where: { slug: fields.slug, id: { not: options.postId ?? 0 } }, select: { id: true } })) {
    return fieldError("slug", "Another post already uses this slug.", formData);
  }
  if (data.status === "SCHEDULED" && (!data.publishAt || data.publishAt.getTime() <= Date.now())) {
    return fieldError("publishAtLocal", "Choose a time in the future.", formData);
  }
  if ((data.status === "PUBLISHED" || data.status === "SCHEDULED") && isEmptyDocument(fields.body)) {
    return fieldError("body", "Add some content before publishing.", formData);
  }
  if (fields.categoryId && !(await db.blogCategory.findUnique({ where: { id: fields.categoryId }, select: { id: true } }))) {
    return fieldError("categoryId", "That category no longer exists.", formData);
  }
  if (fields.featuredImageId) {
    const image = await db.media.findFirst({
      where: { id: fields.featuredImageId, kind: "IMAGE", uploadStatus: "READY" },
      select: { id: true },
    });
    if (!image) return fieldError("featuredImageId", "Choose an image from the media library.", formData);
  }
  if (data.seo.socialImageId) {
    const image = await db.media.findFirst({
      where: { id: data.seo.socialImageId, kind: "IMAGE", uploadStatus: "READY" },
      select: { id: true },
    });
    if (!image) return fieldError("socialImageId", "Choose an image from the media library.", formData);
  }
  const authorId = fields.authorId ?? options.currentAuthorId ?? options.actor.id;
  if (authorId !== options.currentAuthorId) {
    // A new post may only be assigned to its creator; changing the author later needs publish rights.
    if (!options.canPublish && (options.currentAuthorId !== null || authorId !== options.actor.id)) {
      return fieldError("authorId", "Only someone who can publish posts may change the author.", formData);
    }
    if (!(await isValidAuthor(authorId))) {
      return fieldError("authorId", "That user cannot be an author.", formData);
    }
  }
  return null;
}

// Existing tags are kept if they still exist; new names reuse a tag with the
// same slug or are created (only with blog-taxonomy.manage).
async function planTags(data: Parsed, canCreate: boolean, formData: FormData) {
  const existing = data.tagIds.length
    ? await db.blogTag.findMany({ where: { id: { in: data.tagIds } }, select: { id: true } })
    : [];
  const ids = new Set(existing.map((t) => t.id));
  const toCreate: { name: string; slug: string }[] = [];
  for (const name of data.newTags) {
    const slug = slugify(name);
    const found = await db.blogTag.findUnique({ where: { slug }, select: { id: true } });
    if (found) ids.add(found.id);
    else if (!canCreate) {
      return { ok: false as const, error: fieldError("tags", "You do not have permission to create new tags.", formData) };
    } else if (!toCreate.some((t) => t.slug === slug)) toCreate.push({ name, slug });
  }
  return { ok: true as const, ids: [...ids], toCreate };
}

async function createTags(tx: Tx, toCreate: { name: string; slug: string }[]) {
  const created: { id: number; name: string }[] = [];
  for (const tag of toCreate) {
    created.push(await tx.blogTag.create({ data: tag, select: { id: true, name: true } }));
  }
  return created;
}

async function setTags(tx: Tx, postId: number, tagIds: number[]) {
  await tx.blogPostTag.deleteMany({ where: { postId } });
  if (tagIds.length) await tx.blogPostTag.createMany({ data: tagIds.map((tagId) => ({ postId, tagId })) });
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const RACE = "That slug or tag was just taken by someone else. Try again.";

export async function createPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("post.create");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const actor = authz.user;
  const canPublish = can(actor, "post.publish");

  const parsed = parseForm(formData);
  if (!parsed.ok) return parsed.state;
  const { data } = parsed;

  if (!canTransition(null, data.status, { canEdit: true, canPublish })) {
    return fieldError("status", "You cannot set that status.", formData);
  }
  const refError = await checkReferences(data, formData, { postId: null, currentAuthorId: null, actor, canPublish });
  if (refError) return refError;
  const tagPlan = await planTags(data, can(actor, "blog-taxonomy.manage"), formData);
  if (!tagPlan.ok) return tagPlan.error;

  const { fields } = data;
  let postId: number;
  let createdTags: { id: number; name: string }[] = [];
  try {
    postId = await db.$transaction(async (tx) => {
      createdTags = await createTags(tx, tagPlan.toCreate);
      const post = await tx.blogPost.create({
        data: {
          title: fields.title,
          slug: fields.slug,
          body: fields.body as Prisma.InputJsonValue,
          excerpt: fields.excerpt,
          featuredImageId: fields.featuredImageId,
          categoryId: fields.categoryId,
          authorId: fields.authorId ?? actor.id,
          featured: fields.featured,
          ...statusFields(data.status, { publishAt: data.publishAt }),
        },
        select: { id: true },
      });
      await setTags(tx, post.id, [...tagPlan.ids, ...createdTags.map((t) => t.id)]);
      await upsertSeo("POST", post.id, data.seo, tx);
      await createPostRevision(post.id, actor.id, "Created", tx);
      return post.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fieldError("slug", RACE, formData);
    throw error;
  }

  await logActivity({ userId: actor.id, action: "post.create", entity: "post", entityId: postId, details: { title: fields.title } });
  const statusAction = statusActivity(null, data.status);
  if (statusAction) {
    await logActivity({ userId: actor.id, action: statusAction, entity: "post", entityId: postId, details: { title: fields.title } });
  }
  for (const tag of createdTags) {
    await logActivity({ userId: actor.id, action: "blog-tag.create", entity: "blog-tag", entityId: tag.id, details: { name: tag.name } });
  }
  refresh();
  redirect(`/admin/blog/${postId}?created=1`);
}

export async function updatePost(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("post.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const actor = authz.user;
  const perms = { canEdit: true, canPublish: can(actor, "post.publish") };

  const id = idFrom(formData.get("id"));
  if (!id) return { ok: false, error: NOT_FOUND, values: formValues(formData) };
  const before = await readState(db, id);
  if (!before) return { ok: false, error: NOT_FOUND, values: formValues(formData) };
  if (allowedTransitions(before.status, perms).length === 0) {
    return { ok: false, error: LOCKED, values: formValues(formData) };
  }

  const parsed = parseForm(formData);
  if (!parsed.ok) return parsed.state;
  const { data } = parsed;
  if (!canTransition(before.status, data.status, perms)) {
    return fieldError("status", "You cannot set that status.", formData);
  }
  const refError = await checkReferences(data, formData, {
    postId: id,
    currentAuthorId: before.authorId,
    actor,
    canPublish: perms.canPublish,
  });
  if (refError) return refError;
  const tagPlan = await planTags(data, can(actor, "blog-taxonomy.manage"), formData);
  if (!tagPlan.ok) return tagPlan.error;

  const { fields } = data;
  const authorId = fields.authorId ?? before.authorId;
  let createdTags: { id: number; name: string }[] = [];
  let after: PostSnapshot;
  try {
    after = await db.$transaction(async (tx) => {
      // Posts that predate revisions get a baseline, so the first edit can be compared and undone.
      if ((await tx.blogPostRevision.count({ where: { postId: id } })) === 0) {
        await createPostRevision(id, null, "Version before revisions were kept", tx);
      }
      createdTags = await createTags(tx, tagPlan.toCreate);
      await tx.blogPost.update({
        where: { id },
        data: {
          title: fields.title,
          slug: fields.slug,
          body: fields.body as Prisma.InputJsonValue,
          excerpt: fields.excerpt,
          featuredImageId: fields.featuredImageId,
          categoryId: fields.categoryId,
          authorId,
          featured: fields.featured,
          ...statusFields(data.status, { publishAt: data.publishAt, publishedAt: before.publishedAt }),
        },
      });
      await setTags(tx, id, [...tagPlan.ids, ...createdTags.map((t) => t.id)]);
      await upsertSeo("POST", id, data.seo, tx);
      const state = await readState(tx, id);
      if (!state) throw new Error(NOT_FOUND);
      if (!snapshotsEqual(before.snapshot, state.snapshot)) await createPostRevision(id, actor.id, null, tx);
      return state.snapshot;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fieldError("slug", RACE, formData);
    throw error;
  }

  const { changes, body } = diffSnapshots(before.snapshot, after);
  const changed = [...changes.map((c) => c.field), ...(body ? ["body"] : [])];
  if (before.featuredImageId !== fields.featuredImageId) changed.push("featuredImage");
  if (before.featured !== fields.featured) changed.push("featured");
  if (before.authorId !== authorId) changed.push("author");

  const details = { title: fields.title };
  const statusAction = statusActivity(before.status, data.status);
  if (statusAction) {
    await logActivity({ userId: actor.id, action: statusAction, entity: "post", entityId: id, details });
  }
  if (changed.length > 0) {
    await logActivity({ userId: actor.id, action: "post.update", entity: "post", entityId: id, details: { ...details, fields: changed } });
  }
  for (const tag of createdTags) {
    await logActivity({ userId: actor.id, action: "blog-tag.create", entity: "blog-tag", entityId: tag.id, details: { name: tag.name } });
  }
  refresh();
  return { ok: true, message: statusAction || changed.length > 0 ? "Post saved." : "Nothing to change." };
}

// List shortcut for people who can publish: fields are `id` and `status`
// (PUBLISHED, or DRAFT to take a live or scheduled post offline).
export async function setPostStatus(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("post.publish");
  if (!authz.ok) return authz.result;
  const parsed = z
    .object({ id: z.coerce.number().int().positive(), status: z.enum(["PUBLISHED", "DRAFT"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id, status } = parsed.data;

  const post = await db.blogPost.findUnique({
    where: { id },
    select: { title: true, body: true, status: true, publishAt: true, publishedAt: true },
  });
  if (!post) return { ok: false, error: NOT_FOUND };
  if (post.status === status) return { ok: false, error: `The post is already ${status === "DRAFT" ? "a draft" : "published"}.` };
  if (status === "DRAFT" && post.status !== "PUBLISHED" && post.status !== "SCHEDULED") {
    return { ok: false, error: "Only published or scheduled posts can be unpublished." };
  }
  if (status === "PUBLISHED" && isEmptyDocument(post.body)) {
    return { ok: false, error: "Add some content before publishing." };
  }

  await db.blogPost.update({ where: { id }, data: statusFields(status, { publishedAt: post.publishedAt }) });
  await logActivity({
    userId: authz.user.id,
    action: statusActivity(post.status, status) ?? "post.update",
    entity: "post",
    entityId: id,
    details: { title: post.title },
  });
  refresh();
  return { ok: true, message: status === "PUBLISHED" ? "Post published." : "Post unpublished and saved as a draft." };
}

export async function duplicatePost(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("post.create");
  if (!authz.ok) return authz.result;
  const actor = authz.user;
  const id = idFrom(formData.get("id"));
  if (!id) return { ok: false, error: NOT_FOUND };
  const source = await readState(db, id);
  if (!source) return { ok: false, error: NOT_FOUND };

  const slug = await nextFreeSlug(`${source.slug}-copy`, async (candidate) =>
    Boolean(await db.blogPost.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );
  const title = `${source.title} (copy)`.slice(0, 200);
  const newId = await db.$transaction(async (tx) => {
    const post = await tx.blogPost.create({
      data: {
        title,
        slug,
        body: source.body as Prisma.InputJsonValue,
        excerpt: source.excerpt,
        featuredImageId: source.featuredImageId,
        categoryId: source.categoryId,
        authorId: actor.id,
        status: "DRAFT",
      },
      select: { id: true },
    });
    await setTags(tx, post.id, source.snapshot.tagIds);
    if (source.snapshot.seo) {
      // A canonical URL points at the original, so it is not copied.
      await upsertSeo(
        "POST",
        post.id,
        {
          seoTitle: source.snapshot.seo.title ?? undefined,
          metaDescription: source.snapshot.seo.metaDescription ?? undefined,
          canonicalUrl: undefined,
          noindex: source.snapshot.seo.noindex,
          socialImageId: source.snapshot.seo.socialImageId,
        },
        tx,
      );
    }
    await createPostRevision(post.id, actor.id, `Duplicated from "${source.title}"`, tx);
    return post.id;
  });

  await logActivity({
    userId: actor.id,
    action: "post.duplicate",
    entity: "post",
    entityId: newId,
    details: { title, from: id },
  });
  refresh();
  redirect(`/admin/blog/${newId}?created=1`);
}

// Field `redirect` = "list" sends the browser back to the list afterwards.
export async function deletePost(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("post.delete");
  if (!authz.ok) return authz.result;
  const id = idFrom(formData.get("id"));
  if (!id) return { ok: false, error: NOT_FOUND };

  const post = await db.blogPost.findUnique({ where: { id }, select: { title: true } });
  if (!post) return { ok: false, error: NOT_FOUND };
  await db.$transaction(async (tx) => {
    // Revisions and tag links go with the post (cascade); the SEO row has no foreign key.
    await tx.blogPost.delete({ where: { id } });
    await deleteSeo("POST", id, tx);
  });
  await logActivity({ userId: authz.user.id, action: "post.delete", entity: "post", entityId: id, details: { title: post.title } });
  refresh();
  if (formData.get("redirect") === "list") redirect("/admin/blog?deleted=1");
  return { ok: true, message: "Post deleted." };
}

// Writes an old revision back to the post. Status, schedule, author, featured
// image and the featured flag are not part of a revision and stay as they are.
export async function restorePostRevision(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("post.edit");
  if (!authz.ok) return authz.result;
  const actor = authz.user;
  const id = idFrom(formData.get("id"));
  const number = idFrom(formData.get("number"));
  if (!id || !number) return { ok: false, error: "Invalid request." };

  const current = await readState(db, id);
  if (!current) return { ok: false, error: NOT_FOUND };
  if (allowedTransitions(current.status, { canEdit: true, canPublish: can(actor, "post.publish") }).length === 0) {
    return { ok: false, error: LOCKED };
  }
  const revision = await db.blogPostRevision.findUnique({ where: { postId_number: { postId: id, number } } });
  if (!revision) return { ok: false, error: "This revision no longer exists." };

  const snapshot: PostSnapshot = {
    title: revision.title,
    slug: revision.slug,
    excerpt: revision.excerpt,
    body: revision.body,
    seo: (revision.seo as PostSnapshot["seo"]) ?? null,
    categoryId: revision.categoryId,
    tagIds: Array.isArray(revision.tagIds) ? (revision.tagIds as number[]) : [],
  };
  const [slugOwner, categories, tags, media] = await Promise.all([
    db.blogPost.findFirst({ where: { slug: snapshot.slug, id: { not: id } }, select: { id: true } }),
    snapshot.categoryId ? db.blogCategory.findMany({ where: { id: snapshot.categoryId }, select: { id: true } }) : [],
    snapshot.tagIds.length ? db.blogTag.findMany({ where: { id: { in: snapshot.tagIds } }, select: { id: true } }) : [],
    snapshot.seo?.socialImageId ? db.media.findMany({ where: { id: snapshot.seo.socialImageId, uploadStatus: "READY" }, select: { id: true } }) : [],
  ]);
  const plan = planRestore(snapshot, { slug: current.slug }, {
    slugTaken: Boolean(slugOwner),
    categoryIds: categories.map((c) => c.id),
    tagIds: tags.map((t) => t.id),
    mediaIds: media.map((m) => m.id),
  });

  try {
    await db.$transaction(async (tx) => {
      await tx.blogPost.update({
        where: { id },
        data: {
          title: plan.title,
          slug: plan.slug,
          body: plan.body as Prisma.InputJsonValue,
          excerpt: plan.excerpt,
          categoryId: plan.categoryId,
        },
      });
      await setTags(tx, id, plan.tagIds);
      await upsertSeo(
        "POST",
        id,
        {
          seoTitle: plan.seo?.title ?? undefined,
          metaDescription: plan.seo?.metaDescription ?? undefined,
          canonicalUrl: plan.seo?.canonicalUrl ?? undefined,
          noindex: plan.seo?.noindex ?? false,
          socialImageId: plan.seo?.socialImageId ?? null,
        },
        tx,
      );
      await createPostRevision(id, actor.id, `Restored from revision ${number}`, tx);
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: RACE };
    throw error;
  }

  await logActivity({ userId: actor.id, action: "post.restore", entity: "post", entityId: id, details: { title: plan.title, revision: number } });
  refresh();
  const notes = [
    plan.skipped.slug && "the slug is used by another post, so the current slug was kept",
    plan.skipped.category && "the category no longer exists",
    plan.skipped.tags > 0 && `${plan.skipped.tags} tag(s) no longer exist`,
  ].filter(Boolean);
  return { ok: true, message: `Restored revision ${number}${notes.length ? `; ${notes.join("; ")}` : ""}.` };
}
