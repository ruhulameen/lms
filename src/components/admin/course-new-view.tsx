import { CourseForm } from "@/components/admin/course-form";
import { PageHeader } from "@/components/admin/page-header";
import { listCourseCategoryOptions, listCourseTagOptions, listInstructorOptions } from "@/services/course-admin";
import { can, requirePermission } from "@/services/user";

export async function CourseNewView({ base }: { base: string }) {
  const user = await requirePermission("course.create");
  const [categories, tags, instructors] = await Promise.all([
    listCourseCategoryOptions(),
    listCourseTagOptions(),
    listInstructorOptions(user.id),
  ]);

  return (
    <>
      <PageHeader title="New course" description="Describe the course, then save it as a draft or submit it for review. The curriculum comes next." />
      <CourseForm
        mode="create"
        basePath={base}
        categories={categories}
        tags={tags}
        instructors={instructors}
        currentUserId={user.id}
        canEdit
        canPublish={can(user, "course.publish")}
        canCreateTags={can(user, "course-taxonomy.manage")}
      />
    </>
  );
}
