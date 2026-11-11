import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TableActionVariant =
  | "view"
  | "primary"
  | "edit"
  | "success"
  | "warning"
  | "danger";

const VARIANT_CLASSES: Record<TableActionVariant, string> = {
  view: "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-[#333333]",
  primary:
    "border-red-200 bg-red-50/70 text-[#e02b20] hover:bg-red-100/80 hover:text-[#b71c1c]",
  edit: "border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100/80",
  success:
    "border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100/80",
  warning:
    "border-amber-200 bg-amber-50/70 text-amber-700 hover:bg-amber-100/80",
  danger: "border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100/80",
};

export interface TableActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  label?: string;
  variant?: TableActionVariant;
}

export function TableActionButton({
  icon: Icon,
  label,
  variant = "view",
  className,
  children,
  ...props
}: TableActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#e02b20]/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASSES[variant],
        !label && !children && "w-8 px-0",
        className,
      )}
      title={props.title ?? label}
      aria-label={props["aria-label"] ?? label}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {label ? <span>{label}</span> : null}
      {children}
    </button>
  );
}

export interface TableActionLinkProps
  extends React.ComponentProps<typeof Link> {
  icon?: LucideIcon;
  label?: string;
  variant?: TableActionVariant;
}

export function TableActionLink({
  icon: Icon,
  label,
  variant = "view",
  className,
  children,
  ...props
}: TableActionLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#e02b20]/40 focus-visible:outline-none",
        VARIANT_CLASSES[variant],
        !label && !children && "w-8 px-0",
        className,
      )}
      title={props.title ?? label}
      aria-label={props["aria-label"] ?? label}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {label ? <span>{label}</span> : null}
      {children}
    </Link>
  );
}

export function TableActions({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-actions"
      className={cn("flex items-center justify-end gap-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}
