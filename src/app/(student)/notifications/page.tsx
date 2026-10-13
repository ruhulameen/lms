import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen, CircleAlert, Gift, type LucideIcon, Receipt, Star } from "lucide-react";
import { markAllNotificationsRead, openNotification } from "@/actions/notification";
import { PageHeading } from "@/components/student/page-heading";
import { groupByAge, notificationKind, timeAgo, type NotificationKind } from "@/lib/notification";
import { cn } from "@/lib/utils";
import { listNotifications } from "@/services/notification";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Notifications",
};

const kinds: Record<NotificationKind, { icon: LucideIcon; className: string }> = {
  order: { icon: Receipt, className: "bg-blue-100 text-blue-600" },
  problem: { icon: CircleAlert, className: "bg-red-100 text-red-600" },
  course: { icon: BookOpen, className: "bg-blue-100 text-blue-600" },
  certificate: { icon: Award, className: "bg-green-100 text-green-600" },
  offer: { icon: Gift, className: "bg-orange-100 text-orange-500" },
  review: { icon: Star, className: "bg-orange-100 text-orange-500" },
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const page = Number.parseInt((await searchParams).page ?? "1", 10) || 1;
  const list = await listNotifications(user.id, page);
  const now = new Date();
  const groups = groupByAge(list.rows, now);

  return (
    <>
      <PageHeading
        title="Notifications"
        description={`${list.unread} unread · ${list.total} total`}
      >
        {list.unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-navy transition hover:border-blue-600 hover:text-blue-600"
            >
              Mark all as read
            </button>
          </form>
        )}
      </PageHeading>

      {list.total === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
          <h2 className="mb-2 text-lg font-bold text-navy">Nothing here yet</h2>
          <p className="text-sm text-gray-500">
            Order updates, new courses, certificates and offers will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.group}>
              <h2 className="mb-3 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                {group.group}
              </h2>
              <ul className="space-y-2">
                {group.items.map((item) => {
                  const kind = kinds[notificationKind(item.type)];
                  const unread = item.readAt === null;
                  return (
                    <li key={item.id}>
                      {/* A form, not a link: opening marks it read, which a prefetched link must not do. */}
                      <form action={openNotification}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className={cn(
                            "flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-blue-600/40",
                            unread ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-11 shrink-0 items-center justify-center rounded-xl",
                              kind.className,
                            )}
                          >
                            <kind.icon className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="mb-1 flex items-start gap-2">
                              <span className="flex-1 text-sm font-bold text-navy">
                                {item.title}
                              </span>
                              {unread && (
                                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600">
                                  <span className="sr-only">Unread</span>
                                </span>
                              )}
                            </span>
                            {item.body && (
                              <span className="mb-2 block text-xs text-gray-500">
                                {item.body}
                              </span>
                            )}
                            <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                              {timeAgo(item.createdAt, now)}
                            </span>
                          </span>
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {list.pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm font-semibold">
          {list.page > 1 ? (
            <Link href={list.page === 2 ? "/notifications" : `/notifications?page=${list.page - 1}`} className="text-blue-600 hover:underline">
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-500">
            Page {list.page} of {list.pages}
          </span>
          {list.page < list.pages ? (
            <Link href={`/notifications?page=${list.page + 1}`} className="text-blue-600 hover:underline">
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
