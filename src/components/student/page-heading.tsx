type PageHeadingProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function PageHeading({ title, description, children }: PageHeadingProps) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="mb-2 text-3xl font-extrabold text-navy">{title}</h1>
        {description && <p className="text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}
