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

// Marks pages that still show the design's sample data.
export function SampleNotice() {
  return (
    <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
      Sample data — enrolments, certificates and notifications are not stored
      yet.
    </p>
  );
}
