export function PageHeader({
  title,
  description,
  children,
  titleTestId,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  titleTestId?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal" data-testid={titleTestId}>
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
