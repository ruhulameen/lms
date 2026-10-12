import { notFound } from "next/navigation";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { CourseSubnav } from "@/components/admin/course-subnav";
import { CurriculumBuilder } from "@/components/admin/curriculum-builder";
import { PageHeader } from "@/components/admin/page-header";
import { parseRouteId } from "@/lib/route-id";
import { assertCourseAccess } from "@/services/course-access";
import { getCourseForEdit, toCurriculumView } from "@/services/course-admin";
import { can } from "@/services/user";

export async function CourseCurriculumView({ base, params }: { base: string; params: Promise<{ id: string }> }) {
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const { user } = await assertCourseAccess(id, "course.view");
  const course = await getCourseForEdit(id);
  if (!course) notFound();
  const modules = toCurriculumView(course);
  const lessonCount = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  return (
    <>
      <PageHeader
        title={course.title}
        description={`${modules.length} ${modules.length === 1 ? "module" : "modules"}, ${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}`}
        actions={<ContentStatusBadge status={course.status} className="self-center" />}
      />
      <CourseSubnav courseId={course.id} basePath={base} active="curriculum" />
      <CurriculumBuilder
        // Remounts when the structure changes on the server (add, rename, delete), not on a reorder.
        key={JSON.stringify(modules.map((m) => [m.id, m.title, m.description, m.lessons.map((l) => [l.id, l.title, l.type, l.durationSeconds, l.isFreePreview, l.published, l.hasFile, l.resourceCount, l.questionCount])]))}
        courseId={course.id}
        basePath={base}
        modules={modules}
        canEdit={can(user, "course.edit")}
      />
    </>
  );
}
