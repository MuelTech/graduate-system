"use client";

/**
 * CDW-4 FIX — minimal icon tooltip button built on the existing Base UI dependency
 * (`@base-ui/react/tooltip`, already used by the shared Dialog). No new package.
 *
 * Accessibility: the trigger carries an explicit `aria-label`, and the tooltip
 * exposes the same text visually on hover/keyboard focus.
 */

import type { ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

export function IconTooltipButton({
  label,
  onClick,
  className,
  children,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        render={<button type="button" />}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-gray) hover:text-(--earist-primary) focus-visible:ring-2 focus-visible:ring-(--earist-primary)/40 focus-visible:outline-none disabled:opacity-50",
          className,
        )}
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner sideOffset={6}>
          <TooltipPrimitive.Popup className="z-50 rounded-md bg-(--earist-primary) px-2 py-1 text-xs font-medium text-white shadow-lg">
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
