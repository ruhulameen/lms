type ExampleProps = {
  title?: string;
};

export default function Example({ title = "Example component" }: ExampleProps) {
  return (
    <div className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This is a dummy component.
      </p>
    </div>
  );
}
