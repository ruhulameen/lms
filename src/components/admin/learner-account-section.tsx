import { Ban, CircleCheck, Pause } from "lucide-react";
import { setUserStatus } from "@/actions/user";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { UserForm } from "@/components/admin/user-form";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { formatDate, formatDateTime } from "@/lib/activity-details";

type LearnerAccountSectionProps = {
  user: {
    id: number;
    name: string;
    email: string;
    status: "ACTIVE" | "SUSPENDED" | "BANNED";
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    createdAt: Date;
    roleId: number | null;
    role: { name: string } | null;
  };
  roles: { id: number; name: string }[];
  lastSignIn: Date | null;
  isSelf: boolean;
  canEdit: boolean;
  canChangeStatus: boolean;
};

// Basic info, the edit form and the suspend / ban / reactivate controls.
export function LearnerAccountSection({ user, roles, lastSignIn, isSelf, canEdit, canChangeStatus }: LearnerAccountSectionProps) {
  const fields = { id: String(user.id) };
  return (
    <section aria-labelledby="account" className="scroll-mt-4">
      <h2 id="account" className="mb-3 text-base font-bold text-slate-900">
        Basic info
      </h2>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-xl border bg-white p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Details</h3>
          <UserForm
            mode="edit"
            roles={roles}
            user={{ id: user.id, name: user.name, email: user.email, roleId: user.roleId }}
            readOnly={!canEdit}
            roleLockedReason={isSelf ? "You cannot change your own role." : undefined}
          />
        </div>

        <div className="rounded-xl border bg-white p-4 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Account</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Role</dt>
            <dd>{user.role?.name ?? "None"}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd>
              <UserStatusBadge status={user.status} />
            </dd>
            <dt className="text-slate-500">Joined</dt>
            <dd>{formatDate(user.createdAt)}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd>{user.emailVerified ? "Verified" : "Not verified"}</dd>
            <dt className="text-slate-500">2FA</dt>
            <dd>{user.twoFactorEnabled ? "On" : "Off"}</dd>
            <dt className="text-slate-500">Last sign-in</dt>
            <dd>{lastSignIn ? formatDateTime(lastSignIn) : "Never"}</dd>
          </dl>
          {canChangeStatus && (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Change status</h3>
              {isSelf ? (
                <p className="text-sm text-slate-500">You cannot change your own status.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.status !== "ACTIVE" && (
                    <ConfirmDialog
                      action={setUserStatus}
                      fields={{ ...fields, status: "ACTIVE" }}
                      title="Reactivate this user?"
                      description={`${user.name} will be able to sign in again.`}
                      trigger={<><CircleCheck aria-hidden /> Reactivate</>}
                      confirmLabel="Reactivate"
                    />
                  )}
                  {user.status !== "SUSPENDED" && (
                    <ConfirmDialog
                      action={setUserStatus}
                      fields={{ ...fields, status: "SUSPENDED" }}
                      title="Suspend this user?"
                      description={`${user.name} will be signed out everywhere right away and cannot sign in until reactivated.`}
                      trigger={<><Pause aria-hidden /> Suspend</>}
                      confirmLabel="Suspend"
                    />
                  )}
                  {user.status !== "BANNED" && (
                    <ConfirmDialog
                      action={setUserStatus}
                      fields={{ ...fields, status: "BANNED" }}
                      title="Ban this user?"
                      description={`${user.name} will be signed out everywhere right away and cannot sign in until reactivated.`}
                      trigger={<><Ban aria-hidden /> Ban</>}
                      triggerVariant="destructive"
                      confirmLabel="Ban user"
                      destructive
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
