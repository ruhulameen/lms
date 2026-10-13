import type { Metadata } from "next";
import Link from "next/link";
import { CopyCodeButton } from "@/components/site/copy-code-button";
import { PageHeading } from "@/components/student/page-heading";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listOffersForUser, type Offer } from "@/services/coupon";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "My Offers",
};

const tones = {
  orange: { border: "border-orange-500", solid: "bg-orange-500", text: "text-orange-500" },
  blue: { border: "border-blue-600", solid: "bg-blue-600", text: "text-blue-600" },
  navy: { border: "border-navy", solid: "bg-navy", text: "text-navy" },
};

const amount = (offer: Offer) =>
  offer.discountType === "PERCENTAGE" ? `${Number.isInteger(offer.value) ? offer.value : offer.value.toFixed(2)}%` : formatPrice(offer.value).replace(/\.00$/, "");

// "any course", "Barista Training", "Barista Training and 2 more", "Health courses".
function appliesTo(offer: Offer) {
  const names = [...offer.courses, ...offer.categories.map((c) => `${c} courses`)];
  if (names.length === 0) return "any course";
  return names.length <= 2 ? names.join(" and ") : `${names[0]} and ${names.length - 1} more`;
}

export default async function MyOffersPage() {
  const user = await requireUser();
  const offers = await listOffersForUser(user.id);

  return (
    <>
      <PageHeading
        title="My Offers"
        description="Coupons you can use at checkout right now."
      />

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
          <h2 className="mb-2 text-lg font-bold text-navy">No offers right now</h2>
          <p className="mb-5 text-sm text-gray-500">
            When a coupon is available to you, it appears here.
          </p>
          <Link
            href="/courses"
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Browse courses
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {offers.map((offer) => {
            const tone = tones[offer.personal ? "orange" : offer.discountType === "PERCENTAGE" ? "blue" : "navy"];
            const details = [
              offer.minSpend !== null ? `Min spend ${formatPrice(offer.minSpend)}` : null,
              offer.expiresAt
                ? `Use before ${offer.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                : "No expiry date",
              offer.usesLeft !== null ? `${offer.usesLeft} ${offer.usesLeft === 1 ? "use" : "uses"} left` : null,
            ].filter(Boolean);
            return (
              <div
                key={offer.id}
                className={cn(
                  "flex flex-col rounded-xl border-2 border-dashed bg-white p-6",
                  tone.border,
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "inline-flex h-14 min-w-14 items-center justify-center rounded-2xl px-2 text-lg font-extrabold text-white",
                      tone.solid,
                    )}
                  >
                    {amount(offer)}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase">
                    {offer.personal ? "Just for you" : "Active"}
                  </span>
                </div>
                <h2 className="mb-2 text-lg leading-snug font-bold text-navy">
                  {amount(offer)} off {appliesTo(offer)}
                </h2>
                {offer.description && (
                  <p className="mb-2 text-sm text-gray-500">{offer.description}</p>
                )}
                <p className="mb-4 text-xs text-gray-500">{details.join(" · ")}</p>
                <div className="mt-auto flex items-center gap-2 rounded-xl bg-blue-50 p-3">
                  <span
                    className={cn(
                      "min-w-0 flex-1 font-mono text-sm font-black tracking-widest break-all",
                      tone.text,
                    )}
                  >
                    {offer.code}
                  </span>
                  <CopyCodeButton
                    code={offer.code}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-bold text-white",
                      tone.solid,
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
