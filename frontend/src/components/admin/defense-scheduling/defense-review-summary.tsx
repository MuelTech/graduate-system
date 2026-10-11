"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Send, Mail, AlertTriangle } from "lucide-react";
import type { CommitteeReadiness, ScheduleFormState } from "./types";

type Props = {
  readiness: CommitteeReadiness;
  schedule: ScheduleFormState;
  isValid: boolean;
  isSubmitting: boolean;
  onPreviewEmail: () => void;
  onSubmit: () => void;
};

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="h-4 w-4 shrink-0 text-(--earist-success)" aria-hidden="true" />
      ) : (
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-(--earist-warning)"
          aria-hidden="true"
        />
      )}
      <span className={ok ? "text-(--earist-body-text)" : "text-(--earist-warning)"}>
        {label}
      </span>
    </li>
  );
}

export function DefenseReviewSummary({
  readiness,
  schedule,
  isValid,
  isSubmitting,
  onPreviewEmail,
  onSubmit,
}: Props) {
  const panelistsMissing = Math.max(
    0,
    readiness.panelistQuota - readiness.panelists,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          Final Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
            Committee
          </p>
          <ul className="space-y-1">
            <ChecklistRow
              ok={readiness.chairman === 1}
              label={
                readiness.chairman === 1
                  ? "Chairman assigned"
                  : "Chairman still required"
              }
            />
            <ChecklistRow
              ok={panelistsMissing === 0}
              label={
                panelistsMissing === 0
                  ? `Panelists assigned (${readiness.panelists} / ${readiness.panelistQuota})`
                  : `${panelistsMissing} Panelist${panelistsMissing === 1 ? "" : "s"} still required`
              }
            />
            <ChecklistRow
              ok={readiness.facilitator === 1}
              label={
                readiness.facilitator === 1
                  ? "Facilitator assigned"
                  : "Facilitator still required"
              }
            />
            <ChecklistRow
              ok={readiness.rapporteur === 1}
              label={
                readiness.rapporteur === 1
                  ? "Rapporteur assigned"
                  : "Rapporteur still required"
              }
            />
            {readiness.adviserMode === "AUTOMATIC" && (
              <ChecklistRow
                ok={readiness.adviserPresent}
                label={
                  readiness.adviserPresent
                    ? "Adviser assigned automatically"
                    : "Active thesis adviser required"
                }
              />
            )}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
            Schedule
          </p>
          <ul className="space-y-1">
            <ChecklistRow ok={!!schedule.defenseDate} label="Date" />
            <ChecklistRow ok={!!schedule.defenseTime} label="Time" />
            <ChecklistRow
              ok={!!schedule.venueOrLink.trim()}
              label="Venue / meeting details"
            />
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onPreviewEmail}
            className="sm:flex-1"
          >
            <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
            Preview Notification
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!isValid || isSubmitting}
            className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90 sm:flex-1"
          >
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Scheduling…" : "Schedule Defense"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
