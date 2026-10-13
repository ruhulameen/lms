import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { UserForm } from "@/components/admin/user-form";
import { listRoleOptions, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "New employee" };

export default async function NewEmployeePage() {
  await requirePermission("user.create");
  const roles = (await listRoleOptions()).filter((r) => r.name !== "student");

  return (
    <>
      <PageHeader title="New employee" description="Create a staff account and give it a role." />
      <div className="rounded-xl border bg-white p-4 sm:p-6">
        <UserForm mode="create" roles={roles} />
      </div>
    </>
  );
}
