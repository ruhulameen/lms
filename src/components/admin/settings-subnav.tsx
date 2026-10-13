import Link from "next/link";
import { settingGroupLabels, type SettingGroup } from "@/lib/settings-schema";
import { cn } from "@/lib/utils";

const paths: Record<SettingGroup, string> = {
  site: "/admin/settings",
  certificate: "/admin/settings/certificate",
  payment: "/admin/settings/payments",
  email: "/admin/settings/email",
  storage: "/admin/settings/storage",
};

// Links between the settings screens; `active` marks the current one.
export function SettingsSubnav({ active }: { active: SettingGroup }) {
  return (
    <nav aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto border-b whitespace-nowrap">
      {(Object.keys(paths) as SettingGroup[]).map((group) => (
        <Link
          key={group}
          href={paths[group]}
          aria-current={group === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            group === active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900",
          )}
        >
          {settingGroupLabels[group]}
        </Link>
      ))}
    </nav>
  );
}
