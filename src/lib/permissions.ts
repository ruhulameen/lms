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
] as const;

export type PermissionKey =
  (typeof permissionGroups)[number]["permissions"][number]["key"];

export const allPermissions: {
  key: PermissionKey;
  label: string;
  description: string;
}[] = permissionGroups.flatMap((group) => [...group.permissions]);
