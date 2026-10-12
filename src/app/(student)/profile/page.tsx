import type { Metadata } from "next";
import { UserAvatar } from "@/components/site/user-avatar";
import { ProfileForm } from "@/components/student/account-forms";
import { PageHeading } from "@/components/student/page-heading";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const joined = user.joinedAt.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeading
        title="Profile"
        description="Manage your personal information."
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="h-32 bg-linear-to-r from-blue-900 to-blue-600" />
        <div className="-mt-12 flex flex-col gap-5 px-6 pb-8 sm:flex-row sm:items-end lg:px-8">
          <UserAvatar
            name={user.name}
            image={user.image}
            className="size-24 rounded-2xl border-4 border-white text-3xl shadow-lg"
          />
          <div className="min-w-0">
            <h2 className="mb-1 truncate text-2xl font-extrabold text-navy">
              {user.name}
            </h2>
            <p className="text-sm break-words text-gray-500">
              {user.email} · Joined {joined}
            </p>
          </div>
        </div>
      </div>

      <section className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-5 text-lg font-bold text-navy">Personal info</h2>
        <ProfileForm name={user.name} email={user.email} />
      </section>
    </>
  );
}
