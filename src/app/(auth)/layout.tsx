import { Logo } from "@/components/site/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-slate-100 px-4 py-10">
      <Logo />
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
