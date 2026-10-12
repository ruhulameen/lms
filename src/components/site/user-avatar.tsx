import Image from "next/image";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  image: string | null;
  className?: string;
};

export function UserAvatar({ name, image, className }: UserAvatarProps) {
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={96}
        height={96}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white",
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
