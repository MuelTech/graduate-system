import { cn } from "@/lib/utils";

/**
 * Shared page header (UI/UX Playbook §10.1).
 *
 * Title + one concise description + optional primary/secondary actions.
 * Breadcrumbs, when present, belong above this component.
 */
function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#333333]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm text-gray-500">
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export { PageHeader };
