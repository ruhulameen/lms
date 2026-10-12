import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { PostSnapshot } from "@/lib/revision-diff";
import { getSeo } from "@/services/seo";

// Revisions are specific to blog posts. Every save stores a snapshot; restoring
// writes a new revision, so nothing is overwritten.

async function snapshotOf(tx: Prisma.TransactionClient, postId: number): Promise<PostSnapshot | null> {
  const post = await tx.blogPost.findUnique({
    where: { id: postId },
    select: {
      title: true,
      slug: true,
      excerpt: true,
      body: true,
      categoryId: true,
      tags: { select: { tagId: true } },
    },
  });
  if (!post) return null;
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    seo: await getSeo("POST", postId, tx),
    categoryId: post.categoryId,
    tagIds: post.tags.map((t) => t.tagId),
  };
}

// The post as it is stored now, in the same shape as a revision.
export async function getCurrentPostSnapshot(postId: number) {
  return db.$transaction((tx) => snapshotOf(tx, postId));
}

// Snapshots the post as it is now. Call after the save, with the saving
// transaction when there is one, so the snapshot matches what was stored.
export async function createPostRevision(
  postId: number,
  userId: number | null,
  note?: string | null,
  client?: Prisma.TransactionClient,
) {
  const run = async (tx: Prisma.TransactionClient) => {
    const snapshot = await snapshotOf(tx, postId);
    if (!snapshot) throw new Error("Post not found.");
    const last = await tx.blogPostRevision.aggregate({ where: { postId }, _max: { number: true } });
    return tx.blogPostRevision.create({
      data: {
        postId,
        number: (last._max.number ?? 0) + 1,
        title: snapshot.title,
        slug: snapshot.slug,
        body: snapshot.body as Prisma.InputJsonValue,
        excerpt: snapshot.excerpt,
        seo: (snapshot.seo ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        categoryId: snapshot.categoryId,
        tagIds: snapshot.tagIds,
        note: note || null,
        createdById: userId,
      },
      select: { id: true, number: true },
    });
  };
  if (client) return run(client);
  // The unique (postId, number) index makes a concurrent save fail; retry once.
  try {
    return await db.$transaction(run);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.$transaction(run);
    }
    throw error;
  }
}

export async function listPostRevisions(postId: number) {
  return db.blogPostRevision.findMany({
    where: { postId },
    orderBy: { number: "desc" },
    select: { id: true, number: true, title: true, note: true, createdAt: true, createdBy: { select: { id: true, name: true } } },
  });
}

export async function getPostRevision(postId: number, number: number) {
  const row = await db.blogPostRevision.findUnique({
    where: { postId_number: { postId, number } },
    select: {
      number: true, title: true, slug: true, body: true, excerpt: true, seo: true,
      categoryId: true, tagIds: true, note: true, createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!row) return null;
  const snapshot: PostSnapshot = {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    seo: (row.seo as PostSnapshot["seo"]) ?? null,
    categoryId: row.categoryId,
    tagIds: Array.isArray(row.tagIds) ? (row.tagIds as number[]) : [],
  };
  return { number: row.number, note: row.note, createdAt: row.createdAt, createdBy: row.createdBy, snapshot };
}
