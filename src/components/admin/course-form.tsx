"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ListTree } from "lucide-react";
import { toast } from "sonner";
import { createCourse, updateCourse } from "@/actions/course";
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
import type { ContentStatusValue } from "@/lib/content-status";
import { courseLevelLabels, courseLevels, type CourseLevelValue } from "@/lib/course";
import { BADGE_MAX, COURSE_SHORT_DESCRIPTION_MAX, COURSE_SUBTITLE_MAX, COURSE_TITLE_MAX, splitMinutes } from "@/lib/course-form";
import { initialFormState } from "@/lib/form-state";
import type { MediaSummary } from "@/lib/media-types";
import type { RichTextDocument } from "@/lib/rich-text";
import { slugify } from "@/lib/slug";

type CourseFormProps = {
  mode: "create" | "edit";
  // Panel path of the courses area, e.g. "/admin/courses" or "/instructor/courses".
  basePath: string;
  course?: {
    id: number;
    title: string;
    slug: string;
    subtitle: string | null;
    shortDescription: string | null;
    description: RichTextDocument | null;
    thumbnail: MediaSummary | null;
    price: number;
    compareAtPrice: number | null;
    level: CourseLevelValue;
    language: string;
    durationMinutes: number | null;
    badge: string | null;
    featured: boolean;
    instructorId: number | null;
    categoryId: number | null;
    tagIds: number[];
    status: ContentStatusValue;
    publishAt: string | null;
    seo: { title: string | null; metaDescription: string | null; canonicalUrl: string | null; noindex: boolean } | null;
    socialImage: MediaSummary | null;
  };
  categories: { id: number; name: string }[];
  tags: { id: number; name: string }[];
  instructors: { id: number; name: string }[];
  currentUserId: number;
  // Whether this viewer may change this course (permission and workflow).
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

export function CourseForm({
  mode,
  basePath,
  course,
  categories,
  tags,
  instructors,
  currentUserId,
  canEdit,
  canPublish,
  canCreateTags,
  lockedReason,
}: CourseFormProps) {
  const [state, formAction, pending] = useActionState(mode === "create" ? createCourse : updateCourse, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;

  // The form is not remounted after an error, so what was typed stays in state.
  const [title, setTitle] = useState(course?.title ?? "");
  const [slug, setSlug] = useState(course?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [shortDescription, setShortDescription] = useState(course?.shortDescription ?? "");
  const [categoryId, setCategoryId] = useState(String(course?.categoryId ?? ""));
  const [instructorId, setInstructorId] = useState(String(course?.instructorId ?? currentUserId));
  const [featured, setFeatured] = useState(course?.featured ?? false);
  const [level, setLevel] = useState<string>(course?.level ?? "ALL_LEVELS");
  const duration = splitMinutes(course?.durationMinutes);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const readOnly = !canEdit;
  const slugChangesLiveUrl =
    mode === "edit" && course && (course.status === "PUBLISHED" || course.status === "SCHEDULED") && slug !== course.slug;
  const seoDefaults = {
    seoTitle: values?.seoTitle ?? course?.seo?.title,
    metaDescription: values?.metaDescription ?? course?.seo?.metaDescription,
    canonicalUrl: values?.canonicalUrl ?? course?.seo?.canonicalUrl,
    noindex: values ? values.noindex === "on" || values.noindex === "true" : course?.seo?.noindex,
  };

  return (
    <form action={formAction} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" noValidate>
      {course && <input type="hidden" name="id" value={course.id} />}
      <input type="hidden" name="basePath" value={basePath} />
      {lockedReason && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 lg:col-span-2">
          {lockedReason}
        </p>
      )}

      <fieldset disabled={readOnly} className="grid min-w-0 gap-5 rounded-xl border bg-white p-4 sm:p-6">
        <legend className="sr-only">Content</legend>
        <FormField id="course-title" label="Title" error={errors?.title}>
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
              maxLength={COURSE_TITLE_MAX}
              required
              className="h-10 text-base"
            />
          )}
        </FormField>
        <FormField id="course-slug" label="Slug" error={errors?.slug} hint={`Public address: /courses/${slug || "your-slug"}`}>
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
                  This course is live. Changing the slug changes its public URL, and links to the old address will stop working.
                </p>
              )}
            </>
          )}
        </FormField>
        <FormField id="course-subtitle" label="Subtitle" error={errors?.subtitle} hint="Optional. One line under the title.">
          {(aria) => <Input {...aria} name="subtitle" defaultValue={values?.subtitle ?? course?.subtitle ?? ""} maxLength={COURSE_SUBTITLE_MAX} autoComplete="off" />}
        </FormField>
        <FormField id="course-short" label="Short description" error={errors?.shortDescription} hint="Optional. A paragraph for the top of the course page and for search results.">
          {(aria) => (
            <>
              <Textarea
                {...aria}
                name="shortDescription"
                rows={3}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                maxLength={COURSE_SHORT_DESCRIPTION_MAX}
              />
              <p className="text-xs text-slate-500" aria-live="polite">
                {shortDescription.length} of {COURSE_SHORT_DESCRIPTION_MAX} characters
              </p>
            </>
          )}
        </FormField>

        {readOnly ? (
          <div className="grid gap-1.5">
            <span className="text-sm leading-none font-medium">Description</span>
            <div className="rounded-lg border p-4">
              <RichText doc={course?.description} />
            </div>
          </div>
        ) : (
          <RichTextEditor name="description" label="Description" initialValue={course?.description} error={errors?.description} />
        )}
      </fieldset>

      <fieldset disabled={readOnly} className="grid min-w-0 gap-4">
        <legend className="sr-only">Settings</legend>
        <Card title="Publish">
          <PublishControls
            key={course?.status ?? "new"}
            current={course?.status ?? null}
            canEdit={canEdit}
            canPublish={canPublish}
            publishAt={course?.publishAt}
            errors={errors}
          />
          {!readOnly && (
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : mode === "create" ? "Create course" : "Save"}
            </Button>
          )}
          {!state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {mode === "create" && <p className="text-xs text-slate-500">After saving you can add the intro video and build the curriculum.</p>}
        </Card>

        {course && (
          <Card title="Curriculum">
            <Button variant="outline" render={<Link href={`${basePath}/${course.id}/curriculum`} />}>
              <ListTree aria-hidden /> Open the curriculum builder
            </Button>
          </Card>
        )}

        <Card title="Price">
          <div className="grid grid-cols-2 gap-3">
            <FormField id="course-price" label="Price (£)" error={errors?.price} hint="0 or empty means free.">
              {(aria) => <Input {...aria} name="price" inputMode="decimal" defaultValue={values?.price ?? (course ? String(course.price) : "0")} autoComplete="off" />}
            </FormField>
            <FormField id="course-compare" label="Old price (£)" error={errors?.compareAtPrice} hint="Optional, shown struck through.">
              {(aria) => (
                <Input {...aria} name="compareAtPrice" inputMode="decimal" defaultValue={values?.compareAtPrice ?? (course?.compareAtPrice != null ? String(course.compareAtPrice) : "")} autoComplete="off" />
              )}
            </FormField>
          </div>
        </Card>

        <Card title="Details">
          <FormField id="course-level" label="Level" error={errors?.level}>
            {(aria) => (
              <select {...aria} name="level" value={level} onChange={(e) => setLevel(e.target.value)} className={selectClassName}>
                {courseLevels.map((l) => (
                  <option key={l} value={l}>
                    {courseLevelLabels[l]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField id="course-language" label="Language" error={errors?.language}>
            {(aria) => <Input {...aria} name="language" defaultValue={values?.language ?? course?.language ?? "English"} maxLength={50} autoComplete="off" />}
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-sm leading-none font-medium">Duration</span>
            <div className="flex items-center gap-2">
              <Input name="durationHours" inputMode="numeric" aria-label="Hours" placeholder="0" defaultValue={values?.durationHours ?? duration.hours} className="w-20" />
              <span className="text-sm text-slate-500">hours</span>
              <Input name="durationMins" inputMode="numeric" aria-label="Minutes" placeholder="0" defaultValue={values?.durationMins ?? duration.minutes} className="w-20" />
              <span className="text-sm text-slate-500">min</span>
            </div>
            {(errors?.durationHours || errors?.durationMins) && (
              <p role="alert" className="text-sm text-destructive">
                {errors?.durationHours?.[0] ?? errors?.durationMins?.[0]}
              </p>
            )}
            <p className="text-xs text-slate-500">Optional. When empty, the lesson lengths are added up.</p>
          </div>
          <FormField id="course-badge" label="Badge" error={errors?.badge} hint="Optional short label on the course card, such as Bestseller.">
            {(aria) => <Input {...aria} name="badge" defaultValue={values?.badge ?? course?.badge ?? ""} maxLength={BADGE_MAX} autoComplete="off" />}
          </FormField>
        </Card>

        <Card title="Organise">
          <FormField id="course-category" label="Category" error={errors?.categoryId}>
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
            <TagInput options={tags} initialIds={course?.tagIds ?? []} canCreate={canCreateTags} disabled={readOnly} error={errors?.tags} />
          </div>
          <FormField
            id="course-instructor"
            label="Instructor"
            error={errors?.instructorId}
            hint={canPublish ? undefined : "Only someone who can publish courses may change the instructor."}
          >
            {(aria) => (
              <>
                <select
                  {...aria}
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  disabled={readOnly || !canPublish}
                  className={selectClassName}
                >
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="instructorId" value={instructorId} />
              </>
            )}
          </FormField>
          {canPublish && (
            <div className="flex items-center gap-3">
              <Switch id="course-featured" checked={featured} onCheckedChange={setFeatured} />
              <input type="hidden" name="featured" value={featured ? "on" : ""} />
              <Label htmlFor="course-featured">Featured on the home page</Label>
            </div>
          )}
        </Card>

        <Card title="Thumbnail">
          <MediaField
            name="thumbnailId"
            label="Image"
            initial={course?.thumbnail}
            error={errors?.thumbnailId}
            hint="Optional. Courses without one show a plain placeholder."
          />
        </Card>

        <SeoFields defaultValues={seoDefaults} socialImage={course?.socialImage} errors={errors} />
      </fieldset>
    </form>
  );
}
