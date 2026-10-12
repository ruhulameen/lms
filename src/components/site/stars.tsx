import { formatCount } from "@/lib/format";

type StarsProps = {
  reviews?: number;
  // Average rating, 1-5. Without it the row shows five full stars.
  rating?: number | null;
  suffix?: string;
};

export function Stars({ reviews, rating, suffix = "" }: StarsProps) {
  if (reviews === 0) {
    return <div className="text-xs text-gray-400">No reviews yet</div>;
  }

  const filled = Math.min(5, Math.max(0, Math.round(rating ?? 5)));
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span aria-label={`Rated ${rating ?? 5} out of 5`}>
        <span className="text-amber-500">{"★".repeat(filled)}</span>
        <span className="text-gray-300">{"★".repeat(5 - filled)}</span>
      </span>
      {reviews !== undefined && (
        <span>
          ({formatCount(reviews)}
          {suffix})
        </span>
      )}
    </div>
  );
}
