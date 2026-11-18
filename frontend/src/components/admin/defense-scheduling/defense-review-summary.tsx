"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Send, Mail } from "lucide-react";
import type { CommitteeReadiness, ScheduleFormState } from "./types";

type Props = {
  readiness: CommitteeReadiness | null;
  showAdviser: boolean;
  schedule: ScheduleFormState;
  isValid: boolean;
  isSubmitting: boolean;
  onPreviewEmail?: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  title?: string;
  submitLabel?: string;
  submittingLabel?: string;
  submitIcon?: ReactNode;
};

export function DefenseReviewSummary({
  isValid,
  isSubmitting,
  onPreviewEmail,
  onSubmit,
  onCancel,
  submitLabel = "Schedule Defense",
  submittingLabel = "Scheduling…",
  submitIcon,
}: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row">
      {onPreviewEmail && (
        <Button
          type="button"
          variant="outline"
          onClick={onPreviewEmail}
          className="sm:flex-1"
        >
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          Preview Notification
        </Button>
      )}
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      )}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={!isValid || isSubmitting}
        className="bg-[#e02b20] text-white hover:bg-[#b71c1c] sm:flex-1"
      >
        {submitIcon ?? (
          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {isSubmitting ? submittingLabel : submitLabel}
      </Button>
    </div>
  );
}
