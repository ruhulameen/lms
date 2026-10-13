import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { RoleForm } from "@/components/admin/role-form";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "New role" };

export default async function NewRolePage() {
  await requirePermission("role.manage");

  return (
    <>
      <PageHeader title="New role" description="Name the role and choose what it may do." />
      <RoleForm mode="create" />
    </>
  );
}
