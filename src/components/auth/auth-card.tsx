import type { LucideIcon } from "lucide-react";

type AuthCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthCard({
  icon: Icon,
  title,
  description,
  children,
}: AuthCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="bg-linear-to-r from-blue-900 to-blue-600 px-6 pt-8 pb-6 text-center">
        <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/20">
          <Icon className="size-7 text-white" />
        </span>
        <h1 className="mb-1 text-2xl font-extrabold text-white">{title}</h1>
        <p className="text-sm text-blue-100">{description}</p>
      </div>
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  );
}
