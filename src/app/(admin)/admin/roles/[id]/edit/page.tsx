import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { RoleForm } from "@/components/admin/role-form";
import { parseRouteId } from "@/lib/route-id";
import { getRoleDetail } from "@/services/role";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Edit role" };

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("role.manage");
  const id = parseRouteId((await params).id);
  if (!id) notFound();

  const role = await getRoleDetail(id);
  // System roles are view only.
  if (!role || role.system) notFound();

  return (
    <>
      <PageHeader title={`Edit ${role.name}`} description="Change the name, description and permissions in one save." />
      <RoleForm mode="edit" role={{ id: role.id, name: role.name, description: role.description, keys: role.keys }} />
    </>
  );
}
