// Single source of truth for permission keys. `pnpm db:seed` syncs the
// `permission` table with this list; later modules add their own groups here.
export const permissionGroups = [
  {
    key: "dashboard",
    label: "Dashboard",
    permissions: [
      { key: "dashboard.view", label: "View dashboard", description: "See the admin dashboard and its widgets" },
    ],
  },
  {
    key: "user",
    label: "Users",
    permissions: [
      { key: "user.view", label: "View users", description: "See the user list and user details" },
      { key: "user.create", label: "Create users", description: "Add new users" },
      { key: "user.edit", label: "Edit users", description: "Edit user details and change their role" },
      { key: "user.status", label: "Change user status", description: "Suspend, ban and reactivate users" },
    ],
  },
  {
    key: "role",
    label: "Roles",
    permissions: [
      { key: "role.view", label: "View roles", description: "See roles and their permissions" },
      { key: "role.manage", label: "Manage roles", description: "Create, rename and delete roles and edit their permissions" },
    ],
  },
  {
    key: "activity",
    label: "Activity",
    permissions: [
      { key: "activity.view", label: "View activity logs", description: "See the activity log" },
    ],
  },
  {
    key: "media",
    label: "Media",
    permissions: [
      { key: "media.view", label: "View media", description: "Browse the media library" },
      { key: "media.upload", label: "Upload media", description: "Upload files and create folders" },
      { key: "media.edit", label: "Edit media", description: "Edit media details, rename and move files and folders" },
      { key: "media.delete", label: "Delete media", description: "Delete files and folders" },
    ],
  },
  {
    key: "post",
    label: "Blog",
    permissions: [
      { key: "post.view", label: "View posts", description: "See the post list and post details" },
      { key: "post.create", label: "Create posts", description: "Add new posts" },
      { key: "post.edit", label: "Edit posts", description: "Edit posts and submit them for review" },
      { key: "post.delete", label: "Delete posts", description: "Delete posts" },
      { key: "post.publish", label: "Publish posts", description: "Publish, schedule, unpublish and archive posts" },
      { key: "blog-taxonomy.manage", label: "Manage categories and tags", description: "Create, rename and delete blog categories and tags" },
    ],
  },
  {
    key: "course",
    label: "Courses",
    permissions: [
      { key: "course.view", label: "View courses", description: "See the course list and course details" },
      { key: "course.create", label: "Create courses", description: "Add new courses" },
      { key: "course.edit", label: "Edit courses", description: "Edit courses, curriculum and lesson files; submit courses for review" },
      { key: "course.delete", label: "Delete courses", description: "Delete courses" },
      { key: "course.publish", label: "Publish courses", description: "Publish, schedule, unpublish and archive courses; manage every instructor's courses" },
      { key: "course-taxonomy.manage", label: "Manage course categories and tags", description: "Create, rename and delete course categories and tags" },
    ],
  },
  {
    key: "enrolment",
    label: "Learners",
    permissions: [
      { key: "enrolment.view", label: "View enrolments", description: "See learners, their enrolments and progress" },
      { key: "enrolment.manage", label: "Manage enrolments", description: "Assign courses to learners and cancel enrolments" },
      { key: "review.moderate", label: "Moderate reviews", description: "Approve or reject course reviews" },
      { key: "certificate.view", label: "View certificates", description: "See issued certificates" },
      { key: "certificate.manage", label: "Manage certificates", description: "Issue and revoke certificates" },
    ],
  },
] as const;

// Granted to the instructor role the first time each permission is seeded;
// afterwards the permission matrix owns the assignments. Admin needs no rows.
export const defaultInstructorPermissions: PermissionKey[] = ["course.view", "course.create", "course.edit"];

export type PermissionKey =
  (typeof permissionGroups)[number]["permissions"][number]["key"];

export const allPermissions: {
  key: PermissionKey;
  label: string;
  description: string;
}[] = permissionGroups.flatMap((group) => [...group.permissions]);
