import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { deleteCourse, duplicateCourse } from "@/actions/course";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { CourseForm } from "@/components/admin/course-form";
import { CourseIntroVideo } from "@/components/admin/course-intro-video";
import { CourseSubnav } from "@/components/admin/course-subnav";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { allowedTransitions, isPublic } from "@/lib/content-status";
import { parseRouteId } from "@/lib/route-id";
import { emptyDocumentCopy, sanitizeDocument, type RichTextDocument } from "@/lib/rich-text";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { assertCourseAccess } from "@/services/course-access";
import { getCourseForEdit, listCourseCategoryOptions, listCourseTagOptions, listInstructorOptions } from "@/services/course-admin";
import { getCourseIntroVideoUrl } from "@/services/lesson-access";
import { can } from "@/services/user";

export async function CourseEditView({
  base,
  params,
  searchParams,
}: {
  base: string;
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const { user: viewer } = await assertCourseAccess(id, "course.view");
  const query = await searchParams;

  const course = await getCourseForEdit(id);
  if (!course) notFound();
  const [categories, tags, instructors, introLink] = await Promise.all([
    listCourseCategoryOptions(),
    listCourseTagOptions(),
    listInstructorOptions(course.instructorId),
    course.introVideoKey ? getCourseIntroVideoUrl(viewer, id) : null,
  ]);

  const canPublish = can(viewer, "course.publish");
  const canEditPermission = can(viewer, "course.edit");
  const workflowAllows = allowedTransitions(course.status, { canEdit: true, canPublish }).length > 0;
  const canEdit = canEditPermission && workflowAllows;
  const lockedReason = !canEditPermission
    ? "You can view this course but not change it."
    : !workflowAllows
      ? "This course is published, scheduled or archived. Only someone who can publish courses may change it."
      : undefined;

  let description: RichTextDocument;
  try {
    description = course.description ? sanitizeDocument(course.description) : emptyDocumentCopy();
  } catch {
    description = emptyDocumentCopy();
  }
  const filesNeeded = Number(firstParam(query.files) ?? 0);

  return (
    <>
      <PageHeader
        title={course.title}
        description={`/courses/${course.slug}`}
        actions={
          <>
            <ContentStatusBadge status={course.status} className="self-center" />
            {isPublic(course.status, course.publishAt) && (
              <Button variant="outline" render={<Link href={`/courses/${course.slug}`} target="_blank" />}>
                <ExternalLink aria-hidden /> View live
              </Button>
            )}
            {can(viewer, "course.create") && (
              <ConfirmDialog
                action={duplicateCourse}
                fields={{ id: String(course.id), basePath: base }}
                title="Duplicate this course?"
                description="A draft copy is created with the same modules, lessons and quiz questions. Videos, documents and resources are not copied: add them to the copy."
                trigger={<><Copy aria-hidden /> Duplicate</>}
                confirmLabel="Duplicate"
              />
            )}
            {can(viewer, "course.delete") && (
              <ConfirmDialog
                action={deleteCourse}
                fields={{ id: String(course.id), redirect: "list", basePath: base }}
                title="Delete this course?"
                description="The course, its modules, lessons, files, reviews and SEO settings are deleted for good. A course with enrolments cannot be deleted: archive it instead."
                trigger={<><Trash2 aria-hidden /> Delete</>}
                triggerVariant="destructive"
                confirmLabel="Delete course"
                destructive
              />
            )}
          </>
        }
      />
      <CourseSubnav courseId={course.id} basePath={base} active="edit" />
      {firstParam(query.created) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Course created. Add an intro video below, then build the curriculum.
        </p>
      )}
      {firstParam(query.duplicated) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Copy created as a draft. Files are not copied: the intro video, lesson videos, documents and resources need uploading again
          {filesNeeded > 0 ? `, and ${filesNeeded} lesson${filesNeeded === 1 ? "" : "s"} that had a file ${filesNeeded === 1 ? "is" : "are"} hidden until you do` : ""}.
        </p>
      )}
      <div className="grid gap-6">
        <CourseForm
          // Remounts when a save changed what the form shows (not when only the intro video changed).
          key={[course.title, course.slug, course.status, course.tagIds.join(","), course.thumbnailId, course.seo?.title].join("|")}
          mode="edit"
          basePath={base}
          course={{
            id: course.id,
            title: course.title,
            slug: course.slug,
            subtitle: course.subtitle,
            shortDescription: course.shortDescription,
            description,
            thumbnail: course.thumbnail,
            price: course.price,
            compareAtPrice: course.compareAtPrice,
            level: course.level,
            language: course.language,
            durationMinutes: course.durationMinutes,
            badge: course.badge,
            featured: course.featured,
            instructorId: course.instructorId,
            categoryId: course.categoryId,
            tagIds: course.tagIds,
            status: course.status,
            publishAt: course.publishAt?.toISOString() ?? null,
            seo: course.seo,
            socialImage: course.socialImage,
          }}
          categories={categories}
          tags={tags}
          instructors={instructors}
          currentUserId={viewer.id}
          canEdit={canEdit}
          canPublish={canPublish}
          canCreateTags={can(viewer, "course-taxonomy.manage")}
          lockedReason={lockedReason}
        />
        <CourseIntroVideo
          courseId={course.id}
          video={course.introVideoKey && course.introVideoName ? { name: course.introVideoName, size: course.introVideoSize ?? 0 } : null}
          previewUrl={introLink && introLink.ok ? introLink.url : null}
          canEdit={canEditPermission}
        />
      </div>
    </>
  );
}
