"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { termsAndConditionsContent } from "@/content/terms-content";
import { ShieldCheck, FileText, CheckCircle2 } from "lucide-react";

interface TermsModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onAccept?: () => Promise<void> | void;
  isEnforcedGate?: boolean;
}

export function TermsModal({
  open,
  onOpenChange,
  onAccept,
  isEnforcedGate = false,
}: TermsModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 35) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!onAccept) return;
    setIsSubmitting(true);
    try {
      await onAccept();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isEnforcedGate ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!isEnforcedGate}
        className="sm:max-w-2xl max-h-[85vh] flex flex-col p-6"
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-[#e02b20]">
            <ShieldCheck className="h-6 w-6 shrink-0" />
            <DialogTitle className="text-lg font-bold text-[#333333]">
              EARIST Graduate School Terms & Data Privacy
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-gray-500">
            Version {termsAndConditionsContent.version} • Last updated {termsAndConditionsContent.lastUpdated}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Document Container */}
        <div
          onScroll={handleScroll}
          className="my-3 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/70 p-4 text-sm text-gray-700 space-y-4 max-h-[50vh] pr-3 select-text"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200 text-xs text-gray-500 font-medium">
            <FileText className="h-4 w-4 text-gray-400" />
            <span>Official Policy Document • Republic Act No. 10173</span>
          </div>

          {termsAndConditionsContent.sections.map((section, idx) => (
            <div key={idx} className="space-y-1.5">
              <h4 className="font-semibold text-gray-900 text-xs sm:text-sm">
                {section.title}
              </h4>
              <p className="text-xs leading-relaxed text-gray-600 text-justify">
                {section.body}
              </p>
            </div>
          ))}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {isEnforcedGate ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                {hasScrolledToBottom ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    You have reached the end of the terms.
                  </span>
                ) : (
                  <span>Please scroll to the bottom to enable acceptance.</span>
                )}
              </div>
              <Button
                type="button"
                disabled={!hasScrolledToBottom || isSubmitting}
                onClick={handleAccept}
                className="w-full sm:w-auto bg-[#e02b20] hover:bg-[#b71c1c] text-white font-medium"
              >
                {isSubmitting ? "Accepting..." : "I Understand & Accept"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              className="ml-auto"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
