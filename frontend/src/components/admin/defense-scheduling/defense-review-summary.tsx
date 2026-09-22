"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Mail } from "lucide-react";
import type { ApprovedApplicationDto } from "@/types";
import {
  ROLE_LABELS,
  defenseTypeLabel,
  type CommitteeMember,
  type ScheduleFormState,
} from "./types";

type Props = {
  application: ApprovedApplicationDto;
  committee: CommitteeMember[];
  adviser?: CommitteeMember | null;
  schedule: ScheduleFormState;
  isValid: boolean;
  isSubmitting: boolean;
  onPreviewEmail: () => void;
  onSubmit: () => void;
};

export function DefenseReviewSummary({
  application,
  committee,
  adviser,
  schedule,
  isValid,
  isSubmitting,
  onPreviewEmail,
  onSubmit,
}: Props) {
  const student = application.student;
  const allMembers = [...(adviser ? [adviser] : []), ...committee];
  const byRole = (role: string) =>
    allMembers.filter((m) => m.role === role).map((m) => m.name);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          4. Review &amp; Notify
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-(--earist-body-text)">Student</p>
            <p className="font-semibold">
              {student.user.firstName} {student.user.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs text-(--earist-body-text)">Defense</p>
            <p className="font-semibold">
              {defenseTypeLabel(application.stage)}
            </p>
          </div>
          <div>
            <p className="text-xs text-(--earist-body-text)">Committee</p>
            <p>{allMembers.length} members</p>
          </div>
          <div>
            <p className="text-xs text-(--earist-body-text)">Schedule</p>
            <p>
              {schedule.defenseDate || "—"} {schedule.defenseTime || ""}
            </p>
          </div>
        </div>

        <div className="space-y-1 rounded-lg bg-(--earist-surface-gray) p-3 text-xs">
          {(["CHAIRMAN", "PANELIST", "ADVISER", "RAPPORTEUR", "FACILITATOR"] as const).map(
            (role) => {
              const names = byRole(role);
              if (names.length === 0) return null;
              return (
                <p key={role}>
                  <span className="font-semibold">{ROLE_LABELS[role]}:</span>{" "}
                  {names.join(", ")}
                </p>
              );
            },
          )}
          <p>
            <span className="font-semibold">MS Teams:</span>{" "}
            {schedule.meetingLink || "—"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onPreviewEmail}
            className="flex-1"
          >
            <Mail className="mr-2 h-4 w-4" />
            Preview Email Notification
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!isValid || isSubmitting}
            className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
          >
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting
              ? "Scheduling defense..."
              : "Schedule Defense & Notify"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
