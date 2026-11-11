import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatCardTone = "red" | "amber" | "green" | "blue" | "purple" | "gray";

const TONE_STYLES: Record<StatCardTone, string> = {
  red: "bg-red-50 text-[#e02b20]",
  amber: "bg-amber-50 text-[#f9a825]",
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  gray: "bg-gray-100 text-gray-600",
};

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: LucideIcon;
  tone?: StatCardTone;
  className?: string;
  children?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "red",
  className,
  children,
}: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
            {title}
          </p>
          <div className="text-3xl font-bold tracking-tight text-[#333333]">
            {value}
          </div>
          {subtitle ? (
            <p className="text-xs text-gray-500">{subtitle}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            TONE_STYLES[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {children ? <div className="mt-3 pt-3 border-t border-gray-100">{children}</div> : null}
    </div>
  );
}
