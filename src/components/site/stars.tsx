import { formatCount } from "@/lib/format";

type StarsProps = {
  reviews?: number;
  suffix?: string;
};

export function Stars({ reviews, suffix = "" }: StarsProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="text-amber-500" aria-label="Rated 5 out of 5">
        ★★★★★
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
