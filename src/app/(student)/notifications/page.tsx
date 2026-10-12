import type { Metadata } from "next";
import { Award, CircleCheck, Gift, MessageSquare } from "lucide-react";
import { PageHeading, SampleNotice } from "@/components/student/page-heading";
import { cn } from "@/lib/utils";
import { getNotifications } from "@/services/student";

export const metadata: Metadata = {
  title: "Notifications",
};

const kinds = {
  certificate: { icon: CircleCheck, className: "bg-green-100 text-green-600" },
  achievement: { icon: Award, className: "bg-orange-100 text-orange-500" },
  message: { icon: MessageSquare, className: "bg-blue-100 text-blue-600" },
  offer: { icon: Gift, className: "bg-orange-100 text-orange-500" },
};

export default async function NotificationsPage() {
  const groups = await getNotifications();
  const items = groups.flatMap((group) => group.items);
  const unread = items.filter((item) => item.unread).length;

  return (
    <>
      <PageHeading
        title="Notifications"
        description={`${unread} unread · ${items.length} total`}
      />
      <SampleNotice />

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.group}>
            <h2 className="mb-3 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              {group.group}
            </h2>
            <ul className="space-y-2">
              {group.items.map((item) => {
                const kind = kinds[item.kind];
                return (
                  <li
                    key={item.title}
                    className={cn(
                      "flex items-start gap-4 rounded-2xl border p-5 transition hover:shadow-md",
                      item.unread
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-white",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl",
                        kind.className,
                      )}
                    >
                      <kind.icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start gap-2">
                        <p className="flex-1 text-sm font-bold text-navy">
                          {item.title}
                        </p>
                        {item.unread && (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600">
                            <span className="sr-only">Unread</span>
                          </span>
                        )}
                      </div>
                      <p className="mb-2 text-xs text-gray-500">
                        {item.description}
                      </p>
                      <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                        {item.time}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
