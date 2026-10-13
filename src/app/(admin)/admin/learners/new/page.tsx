import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { UserForm } from "@/components/admin/user-form";
import { listRoleOptions, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "New learner" };

export default async function NewLearnerPage() {
  await requirePermission("user.create");
  const role = (await listRoleOptions()).find((r) => r.name === "student");

  return (
    <>
      <PageHeader title="New learner" description="Create a student account." />
      <div className="rounded-xl border bg-white p-4 sm:p-6">
        {role ? (
          <UserForm mode="create" roles={[role]} submitLabel="Create learner" />
        ) : (
          <p className="text-sm text-red-700">The student role does not exist, so a learner cannot be created.</p>
        )}
      </div>
    </>
  );
}
