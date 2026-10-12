import type { Metadata } from "next";
import { CopyCodeButton } from "@/components/site/copy-code-button";
import { PageHeading, SampleNotice } from "@/components/student/page-heading";
import { cn } from "@/lib/utils";
import { getOffers } from "@/services/student";

export const metadata: Metadata = {
  title: "My Offers",
};

const tones = {
  orange: { border: "border-orange-500", solid: "bg-orange-500", text: "text-orange-500" },
  blue: { border: "border-blue-600", solid: "bg-blue-600", text: "text-blue-600" },
  navy: { border: "border-navy", solid: "bg-navy", text: "text-navy" },
};

export default async function MyOffersPage() {
  const offers = await getOffers();

  return (
    <>
      <PageHeading
        title="My Offers"
        description="Personal coupons and exclusive discounts."
      />
      <SampleNotice />

      <div className="grid gap-5 md:grid-cols-2">
        {offers.map((offer) => {
          const tone = tones[offer.tone];
          return (
            <div
              key={offer.code}
              className={cn(
                "flex flex-col rounded-xl border-2 border-dashed bg-white p-6",
                tone.border,
              )}
            >
              <div className="mb-4 flex items-start justify-between">
                <span
                  className={cn(
                    "inline-flex size-14 items-center justify-center rounded-2xl text-lg font-extrabold text-white",
                    tone.solid,
                  )}
                >
                  {offer.amount}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase">
                  Active
                </span>
              </div>
              <h2 className="mb-2 text-lg leading-snug font-bold text-navy">
                {offer.title}
              </h2>
              <p className="mb-4 text-sm text-gray-500">{offer.description}</p>
              <div className="mt-auto flex items-center gap-2 rounded-xl bg-blue-50 p-3">
                <span
                  className={cn(
                    "flex-1 font-mono text-sm font-black tracking-widest",
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
    </>
  );
}
