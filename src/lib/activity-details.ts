import { formatPence } from "@/lib/commerce";

// Turns an activity row's JSON details into a short readable line for the
// actions the admin screens log; anything else falls back to key: value pairs.
type Details = Record<string, unknown> | null;

const pence = (value: unknown) => formatPence(Number(value) || 0);

function list(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(", ") : String(value ?? "");
}

export function describeActivity(action: string, raw: unknown): string {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw == null ? "" : String(raw);
  }
  const d = raw as NonNullable<Details>;

  switch (action) {
    case "user.role-change":
      return `Role changed from ${d.from ?? "none"} to ${d.to ?? "none"}`;
    case "user.suspend":
    case "user.ban":
    case "user.reactivate":
      return `Status changed from ${String(d.from ?? "").toLowerCase()} to ${String(d.to ?? "").toLowerCase()}`;
    case "user.create":
      return `Created ${d.email ?? "user"} as ${d.role ?? "no role"}`;
    case "user.update":
      return `Updated ${list(d.fields)}`;
    case "role.create":
      return `Created role ${d.name}`;
    case "role.delete":
      return `Deleted role ${d.name}`;
    case "role.update":
      return d.from !== d.to ? `Renamed ${d.from} to ${d.to}` : `Updated role ${d.to}`;
    case "role.permissions-update": {
      const parts = [];
      if (Array.isArray(d.added) && d.added.length) parts.push(`Added ${list(d.added)}`);
      if (Array.isArray(d.removed) && d.removed.length) parts.push(`Removed ${list(d.removed)}`);
      return `${d.role}: ${parts.join("; ") || "no change"}`;
    }
    case "post.create":
    case "post.duplicate":
    case "post.delete":
    case "post.submit-for-review":
    case "post.publish":
    case "post.schedule":
    case "post.unpublish":
    case "post.archive":
      return `"${d.title ?? "Untitled"}"`;
    case "post.update":
      return `"${d.title ?? "Untitled"}": updated ${list(d.fields)}`;
    case "post.restore":
      return `"${d.title ?? "Untitled"}": restored revision ${d.revision}`;
    case "blog-category.create":
    case "blog-tag.create":
      return `Created ${d.name}`;
    case "blog-category.update":
    case "blog-tag.update":
      return d.from !== d.to ? `Renamed ${d.from} to ${d.to}` : `Updated ${d.to}`;
    case "blog-category.delete":
    case "blog-tag.delete":
      return `Deleted ${d.name} (${d.posts ?? 0} post${d.posts === 1 ? "" : "s"} affected)`;
    case "course.create":
    case "course.duplicate":
    case "course.delete":
    case "course.submit-for-review":
    case "course.publish":
    case "course.schedule":
    case "course.unpublish":
    case "course.archive":
      return `"${d.title ?? "Untitled"}"`;
    case "course.update":
      return `"${d.title ?? "Untitled"}": updated ${list(d.fields)}`;
    case "course.reorder":
      return `"${d.title ?? "Untitled"}": reordered ${d.modules ?? 0} module${d.modules === 1 ? "" : "s"} and ${d.lessons ?? 0} lesson${d.lessons === 1 ? "" : "s"}`;
    case "course-module.create":
      return `Added module "${d.title}" to ${d.course}`;
    case "course-module.update":
      return d.from !== d.to ? `Renamed module "${d.from}" to "${d.to}" in ${d.course}` : `Updated module "${d.to}" in ${d.course}`;
    case "course-module.delete":
      return `Deleted module "${d.title}" and its ${d.lessons ?? 0} lesson${d.lessons === 1 ? "" : "s"} from ${d.course}`;
    case "lesson.create":
      return `Added ${String(d.type ?? "").toLowerCase()} lesson "${d.title}" to ${d.course}`;
    case "lesson.update":
      return Array.isArray(d.fields)
        ? `"${d.title}" in ${d.course}: updated ${list(d.fields)}`
        : `Updated lesson "${d.title}" in ${d.course}`;
    case "lesson.delete":
      return `Deleted lesson "${d.title}" from ${d.course}`;
    case "lesson-resource.create":
      return `Added resource "${d.title}" to "${d.lesson}" in ${d.course}`;
    case "lesson-resource.update":
      return `Renamed resource "${d.from}" to "${d.to}" in ${d.course}`;
    case "lesson-resource.delete":
      return `Deleted resource "${d.title}" from ${d.course}`;
    case "lesson-resource.reorder":
      return `Reordered resources in ${d.course}`;
    case "course-category.create":
    case "course-tag.create":
      return `Created ${d.name}`;
    case "course-category.update":
    case "course-tag.update":
      return d.from !== d.to ? `Renamed ${d.from} to ${d.to}` : `Updated ${d.to}`;
    case "course-category.delete":
    case "course-tag.delete":
      return `Deleted ${d.name} (${d.courses ?? 0} course${d.courses === 1 ? "" : "s"} affected)`;
    case "course.enrol":
      return `Joined ${d.course} (${String(d.source ?? "").toLowerCase()})`;
    case "course.complete":
      return `Completed ${d.course}`;
    case "review.submit":
      return `Reviewed ${d.course}: ${d.rating} star${d.rating === 1 ? "" : "s"}`;
    case "review.update":
      return `Edited their review of ${d.course}: ${d.rating} star${d.rating === 1 ? "" : "s"}`;
    case "review.approve":
    case "review.reject":
      return `${d.learner}'s ${d.rating}-star review of ${d.course}`;
    case "review.delete":
      return `${d.learner}'s ${d.rating}-star review of ${d.course} (was ${String(d.status ?? "").toLowerCase()})`;
    case "quiz.update":
      return `Quiz "${d.quiz}" in ${d.course}: settings saved (pass mark ${d.passingScore}%)`;
    case "quiz-question.create":
    case "quiz-question.update":
    case "quiz-question.delete":
      return `Quiz "${d.quiz}" in ${d.course}: "${d.question}"`;
    case "quiz-question.reorder":
      return `Reordered the questions of "${d.quiz}" in ${d.course}`;
    case "quiz.submit":
      return `Quiz "${d.quiz}" in ${d.course}: ${d.score}/${d.maxScore} (${d.percent}%), ${d.passed ? "passed" : "not passed"}${d.timedOut ? ", out of time" : ""}`;
    case "quiz.pass":
      return `Passed quiz "${d.quiz}" in ${d.course} with ${d.percent}%`;
    case "certificate.issue":
      return `${d.code} for ${d.course}${d.backfill ? " (issued afterwards)" : ""}`;
    case "certificate.revoke":
    case "certificate.restore":
      return `${d.code}: ${d.learner}, ${d.course}`;
    case "enrolment.assign":
      return `${d.learner} was ${d.reactivated ? "re-enrolled in" : "given"} ${d.course}`;
    case "enrolment.reactivate":
      return `${d.learner}'s enrolment in ${d.course} is active again`;
    case "enrolment.cancel":
      return `${d.learner}'s enrolment in ${d.course} was cancelled`;
    case "order.place":
      return `Placed order ${d.orderNumber} for ${pence(d.totalPence)}${d.coupon ? ` with coupon ${d.coupon}` : ""}`;
    case "order.paid":
      return `Order ${d.orderNumber} paid (${pence(d.totalPence)})`;
    case "order.fail":
      return `Payment failed on order ${d.orderNumber}`;
    case "order.cancel":
      return `Order ${d.orderNumber} cancelled${d.reason === "expired" ? " (expired unpaid)" : d.reason === "superseded" ? " (replaced by a newer order)" : ""}`;
    case "order.note":
      return `Added a note to order ${d.orderNumber}`;
    case "order.refund-request":
      return `Requested a refund of ${pence(d.amountPence)} on order ${d.orderNumber}`;
    case "order.refund":
      return `Refunded ${pence(d.amountPence)} on order ${d.orderNumber}`;
    case "order.refund-fail":
      return `Refund of ${pence(d.amountPence)} on order ${d.orderNumber} failed${d.message ? `: ${d.message}` : ""}`;
    case "coupon.create":
      return `Created coupon ${d.code} (${d.discountType === "PERCENTAGE" ? `${d.value}% off` : `${formatPence(Math.round(Number(d.value) * 100))} off`})`;
    case "coupon.update":
      return `Updated coupon ${d.code}${d.previousCode ? ` (was ${d.previousCode})` : ""}${d.previousDiscount ? `, discount changed from ${String(d.previousDiscount).toLowerCase()}` : ""}`;
    case "coupon.activate":
      return `Switched coupon ${d.code} on`;
    case "coupon.deactivate":
      return `Switched coupon ${d.code} off`;
    case "coupon.delete":
      return `Deleted coupon ${d.code}`;
    case "settings.update":
      return `Changed ${d.group} settings: ${list(d.fields)}`;
  }

  return Object.entries(d)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

const formatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
export const formatDateTime = (date: Date) => formatter.format(date);
export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
