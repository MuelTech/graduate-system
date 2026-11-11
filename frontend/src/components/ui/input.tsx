import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "border-gray-200 bg-white text-[#333333] file:text-[#333333] placeholder:text-gray-400 focus-visible:border-[#e02b20] focus-visible:ring-3 focus-visible:ring-[#e02b20]/15 disabled:bg-gray-50 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-500/15 h-9 w-full min-w-0 rounded-lg border px-3 py-1.5 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
