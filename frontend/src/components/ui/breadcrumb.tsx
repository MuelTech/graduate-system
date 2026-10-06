import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared breadcrumb (UI/UX Playbook §9.2, §30).
 *
 * Represents information hierarchy, not browser history. The parent link stays
 * keyboard-focusable; the current item is the final non-clickable entry and
 * carries `aria-current="page"`. Separators are decorative and hidden from
 * assistive technology. Long labels wrap safely instead of overflowing.
 */
export interface BreadcrumbItem {
  label: string;
  /** Omit on the current (final) item. */
  href?: string;
}

function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 items-center gap-x-1"
            >
              {index > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-(--earist-body-text)/50"
                  aria-hidden="true"
                />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="max-w-full rounded-sm break-words text-(--earist-body-text) transition-colors hover:text-(--earist-primary) hover:underline focus-visible:ring-2 focus-visible:ring-(--earist-primary)/40 focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "max-w-full break-words",
                    isLast
                      ? "font-semibold text-(--earist-primary)"
                      : "text-(--earist-body-text)",
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumb };
