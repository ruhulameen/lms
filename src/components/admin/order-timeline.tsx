import { formatDateTime } from "@/lib/activity-details";
import { orderEventLabels } from "@/lib/order-display";
import type { AdminOrder } from "@/services/order-admin";
import { cn } from "@/lib/utils";

// The order's history, oldest first. Notes are set apart so staff can find them.
export function OrderTimeline({ events }: { events: AdminOrder["events"] }) {
  if (events.length === 0) return <p className="text-sm text-slate-500">Nothing has happened to this order yet.</p>;
  return (
    <ol className="grid gap-0">
      {events.map((event, i) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute top-3 left-[5px] h-full w-px bg-slate-200" />}
          <span
            aria-hidden
            className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-white ring-1", event.type === "NOTE" ? "bg-amber-500 ring-amber-300" : "bg-blue-600 ring-blue-300")}
          />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-slate-900">
              {orderEventLabels[event.type] ?? event.type}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {formatDateTime(event.createdAt)}
                {event.actor ? ` by ${event.actor.name}` : ""}
              </span>
            </p>
            <p className={cn("mt-0.5 whitespace-pre-wrap break-words text-slate-600", event.type === "NOTE" && "rounded-md bg-amber-50 px-2 py-1 text-amber-950")}>{event.message}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
