"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createPost, updatePost } from "@/actions/post";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { MediaField } from "@/components/admin/media-field";
import { PublishControls } from "@/components/admin/publish-controls";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { SeoFields } from "@/components/admin/seo-fields";
import { TagInput } from "@/components/admin/tag-input";
import { RichText } from "@/components/site/rich-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EXCERPT_MAX } from "@/lib/blog-post";
import type { ContentStatusValue } from "@/lib/content-status";
import { initialFormState } from "@/lib/form-state";
import type { MediaSummary } from "@/lib/media-types";
import type { RichTextDocument } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";

type PostFormProps = {
  mode: "create" | "edit";
  post?: {
    id: number;
    title: string;
    slug: string;
    excerpt: string | null;
    body: RichTextDocument;
    featuredImage: MediaSummary | null;
    categoryId: number | null;
    tagIds: number[];
    authorId: number | null;
    featured: boolean;
    status: ContentStatusValue;
    publishAt: string | null;
    seo: { title: string | null; metaDescription: string | null; canonicalUrl: string | null; noindex: boolean } | null;
    socialImage: MediaSummary | null;
  };
  categories: { id: number; name: string }[];
  tags: { id: number; name: string }[];
  authors: { id: number; name: string }[];
  currentUserId: number;
  // Whether this viewer may change this post (permission and workflow).
  canEdit: boolean;
  canPublish: boolean;
  canCreateTags: boolean;
  // Why the form is read-only, shown above it.
  lockedReason?: string;
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-3 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function PostForm({
  mode,
  post,
  categories,
  tags,
  authors,
  currentUserId,
  canEdit,
  canPublish,
  canCreateTags,
  lockedReason,
}: PostFormProps) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createPost : updatePost, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;

  // The form is not remounted after an error, so what was typed stays in state.
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [categoryId, setCategoryId] = useState(String(post?.categoryId ?? ""));
  const [authorId, setAuthorId] = useState(String(post?.authorId ?? currentUserId));
  const [featured, setFeatured] = useState(post?.featured ?? false);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const readOnly = !canEdit;
  const slugChangesLiveUrl =
    mode === "edit" && post && (post.status === "PUBLISHED" || post.status === "SCHEDULED") && slug !== post.slug;
  const seoDefaults = {
    seoTitle: values?.seoTitle ?? post?.seo?.title,
    metaDescription: values?.metaDescription ?? post?.seo?.metaDescription,
    canonicalUrl: values?.canonicalUrl ?? post?.seo?.canonicalUrl,
    noindex: values ? values.noindex === "on" || values.noindex === "true" : post?.seo?.noindex,
  };

  return (
    <form action={formAction} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" noValidate>
      {post && <input type="hidden" name="id" value={post.id} />}
      {lockedReason && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 lg:col-span-2">
          {lockedReason}
        </p>
      )}

      <fieldset disabled={readOnly} className="grid min-w-0 gap-5 rounded-xl border bg-white p-4 sm:p-6">
        <legend className="sr-only">Content</legend>
        <FormField id="post-title" label="Title" error={errors?.title}>
          {(aria) => (
            <Input
              {...aria}
              name="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              autoComplete="off"
              maxLength={200}
              required
              className="h-10 text-base"
            />
          )}
        </FormField>
        <FormField
          id="post-slug"
          label="Slug"
          error={errors?.slug}
          hint={`Public address: /blog/${slug || "your-slug"}`}
        >
          {(aria) => (
            <>
              <Input
                {...aria}
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                autoComplete="off"
                required
              />
              {slugChangesLiveUrl && (
                <p role="status" className="text-xs text-amber-800">
                  This post is live. Changing the slug changes its public URL, and links to the old address will stop working.
                </p>
              )}
            </>
          )}
        </FormField>

        {readOnly ? (
          <div className="grid gap-1.5">
            <span className="text-sm leading-none font-medium">Body</span>
            <div className="rounded-lg border p-4">
              <RichText doc={post?.body} />
            </div>
          </div>
        ) : (
          <RichTextEditor name="body" label="Body" initialValue={post?.body} error={errors?.body} />
        )}

        <FormField
          id="post-excerpt"
          label="Excerpt"
          error={errors?.excerpt}
          hint="Optional. A short summary for cards and search results. Left empty, the start of the body is used."
        >
          {(aria) => (
            <>
              <Textarea {...aria} name="excerpt" rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={EXCERPT_MAX} />
              <p className="text-xs text-slate-500" aria-live="polite">
                {excerpt.length} of {EXCERPT_MAX} characters
              </p>
            </>
          )}
        </FormField>
      </fieldset>

      <fieldset disabled={readOnly} className="grid min-w-0 gap-4">
        <legend className="sr-only">Settings</legend>
        <Card title="Publish">
          <PublishControls
            key={post?.status ?? "new"}
            current={post?.status ?? null}
            canEdit={canEdit}
            canPublish={canPublish}
            publishAt={post?.publishAt}
            errors={errors}
          />
          {!readOnly && (
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : mode === "create" ? "Create post" : "Save"}
            </Button>
          )}
          {!state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </Card>

        <Card title="Organise">
          <FormField id="post-category" label="Category" error={errors?.categoryId}>
            {(aria) => (
              <select {...aria} name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClassName}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-sm leading-none font-medium">Tags</span>
            <TagInput
              options={tags}
              initialIds={post?.tagIds ?? []}
              canCreate={canCreateTags}
              disabled={readOnly}
              error={errors?.tags}
            />
          </div>
          <FormField
            id="post-author"
            label="Author"
            error={errors?.authorId}
            hint={canPublish ? undefined : "Only someone who can publish posts may change the author."}
          >
            {(aria) => (
              <>
                <select
                  {...aria}
                  value={authorId}
                  onChange={(e) => setAuthorId(e.target.value)}
                  disabled={readOnly || !canPublish}
                  className={selectClassName}
                >
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="authorId" value={authorId} />
              </>
            )}
          </FormField>
          <div className="flex items-center gap-3">
            <Switch id="post-featured" checked={featured} onCheckedChange={setFeatured} />
            <input type="hidden" name="featured" value={featured ? "on" : ""} />
            <Label htmlFor="post-featured">Featured in the blog slider</Label>
          </div>
        </Card>

        <Card title="Featured image">
          <MediaField
            name="featuredImageId"
            label="Image"
            initial={post?.featuredImage}
            error={errors?.featuredImageId}
            hint="Optional. Posts without one show a plain placeholder."
          />
        </Card>

        <SeoFields defaultValues={seoDefaults} socialImage={post?.socialImage} errors={errors} />
      </fieldset>
    </form>
  );
}
