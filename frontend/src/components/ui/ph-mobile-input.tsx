"use client";

import {
  extractPhilippineMobileSuffix,
  toPhilippineMobileValue,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

interface PhMobileInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Controlled Philippine mobile number input with a fixed `+63` prefix.
 * Emits normalized `+639XXXXXXXXX` values (or `""` when empty).
 */
export function PhMobileInput({
  id,
  value,
  onChange,
  placeholder = "9171234567",
  disabled = false,
  required = false,
  className,
}: PhMobileInputProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-full overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors focus-within:border-[#e02b20] focus-within:ring-2 focus-within:ring-[#e02b20]/20",
        disabled && "cursor-not-allowed bg-gray-50 opacity-60",
        className,
      )}
    >
      <span className="inline-flex items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-[#333333] select-none">
        +63
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        maxLength={13}
        disabled={disabled}
        required={required}
        value={extractPhilippineMobileSuffix(value)}
        onChange={(e) => onChange(toPhilippineMobileValue(e.target.value))}
        placeholder={placeholder}
        className="h-full w-full flex-1 bg-transparent px-3 text-sm text-[#333333] placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}
