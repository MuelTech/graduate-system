"use client";

import { useState } from "react";
import { TermsModal } from "@/components/common/terms-modal";

export function FooterTermsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-xs text-[#fff0e8] hover:text-white hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
      >
        Terms & Data Privacy Notice
      </button>

      <TermsModal open={open} onOpenChange={setOpen} />
    </>
  );
}
