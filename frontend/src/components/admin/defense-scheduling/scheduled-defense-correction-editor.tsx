"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { ApiError, apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CommitteePolicyDto,
  DefensePanelRole,
  ScheduledDefenseDetailDto,
} from "@/types";
import { DefenseCommitteeBuilder } from "./defense-committee-builder";
import { DefenseReviewSummary } from "./defense-review-summary";
import { DefenseScheduleForm } from "./defense-schedule-form";
import {
  MANUAL_ROLE_ORDER,
  ROLE_LABELS,
  computeCommitteeReadiness,
  defenseTypeLabel,
  programTypeLabel,
  scheduleFormFromDetail,
  stageFromDefenseType,
  validateScheduleForm,
  type CommitteeMember,
  type PickerPerson,
  type ScheduleFormState,
} from "./types";
import { formatDefenseDate } from "@/components/admin/defense-applications/labels";

type Props = {
  detail: ScheduledDefenseDetailDto;
  policy?: CommitteePolicyDto;
  policyLoading: boolean;
  policyError: boolean;
  onCancel: () => void;
  onSaved: () => void;
  /** Returns true when the refreshed schedule is no longer editable. */
  onLifecycleConflict: () => Promise<boolean>;
};

function memberFromDetail(
  seat: ScheduledDefenseDetailDto["committee"][number],
): CommitteeMember {
  return {
    userId: seat.userId,
    role: seat.role as DefensePanelRole,
    name: seat.name,
    email: "",
    affiliation: "",
  };
}

function committeeFromDetail(detail: ScheduledDefenseDetailDto): CommitteeMember[] {
  return detail.committee
    .filter((seat) => seat.role !== "ADVISER")
    .map(memberFromDetail);
}

function adviserFromDetail(
  detail: ScheduledDefenseDetailDto,
): CommitteeMember | null {
  const seat = detail.committee.find((member) => member.role === "ADVISER");
  if (!seat) return null;
  return {
    ...memberFromDetail(seat),
    affiliation: "Active thesis adviser",
    isDerivedAdviser: true,
  };
}

function assignmentKey(members: CommitteeMember[]): string {
  return members
    .map((member) => `${member.role}:${member.userId}`)
    .sort()
    .join("|");
}

function changedRoles(
  original: CommitteeMember[],
  current: CommitteeMember[],
): DefensePanelRole[] {
  return MANUAL_ROLE_ORDER.filter((role) => {
    const key = (members: CommitteeMember[]) =>
      members
        .filter((member) => member.role === role)
        .map((member) => member.userId)
        .sort()
        .join("|");
    return key(original) !== key(current);
  });
}

export function ScheduledDefenseCorrectionEditor({
  detail,
  policy,
  policyLoading,
  policyError,
  onCancel,
  onSaved,
  onLifecycleConflict,
}: Props) {
  const queryClient = useQueryClient();
  const scheduleId = detail.scheduleId;
  const showAdviser = detail.defenseType !== "TITLE_DEFENSE";
  const originalSchedule = useMemo(
    () => scheduleFormFromDetail(detail),
    [detail],
  );
  const originalCommittee = useMemo(
    () => committeeFromDetail(detail),
    [detail],
  );
  const adviser = useMemo(() => adviserFromDetail(detail), [detail]);

  const [schedule, setSchedule] = useState<ScheduleFormState>(originalSchedule);
  const [committee, setCommittee] =
    useState<CommitteeMember[]>(originalCommittee);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduleErrors = useMemo(
    () => validateScheduleForm(schedule),
    [schedule],
  );
  const scheduleOk =
    !scheduleErrors.date && !scheduleErrors.time && !scheduleErrors.venue;
  const readiness = policy
    ? computeCommitteeReadiness(policy, committee, adviser)
    : null;
  const isValid = !!readiness?.complete && scheduleOk;

  const dateChanged = originalSchedule.defenseDate !== schedule.defenseDate;
  const timeChanged = originalSchedule.defenseTime !== schedule.defenseTime;
  const venueChanged =
    originalSchedule.venueOrLink.trim() !== schedule.venueOrLink.trim();
  const committeeChanged =
    assignmentKey(originalCommittee) !== assignmentKey(committee);
  const rolesChanged = changedRoles(originalCommittee, committee);
  const hasChanges =
    dateChanged || timeChanged || venueChanged || committeeChanged;
  const canSave = isValid && hasChanges;

  const mutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(
        `/thesis/defense/schedules/${encodeURIComponent(scheduleId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            defenseDate: schedule.defenseDate,
            defenseTime: schedule.defenseTime,
            venueOrLink: schedule.venueOrLink.trim(),
            assignments: committee.map((member) => ({
              userId: member.userId,
              role: member.role,
            })),
          }),
        },
      );
    },
    onSuccess: async () => {
      setShowConfirm(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["scheduledDefenseDetail", scheduleId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["scheduledDefenseApplications"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["schedulingWorkflowSummary"],
        }),
        queryClient.invalidateQueries({ queryKey: ["defenseApplications"] }),
        queryClient.invalidateQueries({ queryKey: ["defenseWorkflowSummary"] }),
      ]);
      onSaved();
    },
    onError: async (failure) => {
      setShowConfirm(false);
      const message =
        failure instanceof Error
          ? failure.message
          : "Schedule and committee could not be updated.";
      if (failure instanceof ApiError && failure.statusCode === 409) {
        const exited = await onLifecycleConflict();
        if (exited) return;
      }
      setError(message);
    },
  });

  const assignRole = (role: DefensePanelRole, people: PickerPerson[]) => {
    setCommittee((previous) => [
      ...previous.filter((member) => member.role !== role),
      ...people.map((person) => ({
        userId: person.id,
        role,
        name: `${person.firstName} ${person.lastName}`,
        email: person.email,
        affiliation: person.affiliation,
      })),
    ]);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <DefenseScheduleForm
        value={schedule}
        onChange={setSchedule}
        errors={scheduleErrors}
      />

      <DefenseCommitteeBuilder
        policy={policy}
        policyLoading={policyLoading}
        policyError={policyError}
        showAdviser={showAdviser}
        defenseStageLabel={defenseTypeLabel(
          stageFromDefenseType(detail.defenseType),
        )}
        programTypeLabel={programTypeLabel(detail.programType)}
        members={committee}
        adviser={adviser}
        onAssignRole={assignRole}
      />

      <DefenseReviewSummary
        title="Review Changes"
        readiness={readiness}
        showAdviser={showAdviser}
        schedule={schedule}
        isValid={canSave}
        isSubmitting={mutation.isPending}
        onSubmit={() => {
          setError(null);
          setShowConfirm(true);
        }}
        onCancel={onCancel}
        submitLabel="Save Changes"
        submittingLabel="Saving…"
        submitIcon={<Save className="mr-2 h-4 w-4" aria-hidden="true" />}
      />

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save schedule and committee changes?</DialogTitle>
            <DialogDescription>
              This updates the current scheduled defense. The defense attempt and
              manuscript remain unchanged.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-sm">
            {dateChanged && (
              <li>
                Date: {formatDefenseDate(originalSchedule.defenseDate)} →{" "}
                {formatDefenseDate(schedule.defenseDate)}
              </li>
            )}
            {timeChanged && (
              <li>
                Time: {originalSchedule.defenseTime || "—"} →{" "}
                {schedule.defenseTime || "—"}
              </li>
            )}
            {venueChanged && <li>Venue / Meeting Details updated</li>}
            {committeeChanged && (
              <li>
                Committee updated
                {rolesChanged.length
                  ? `: ${rolesChanged.map((role) => ROLE_LABELS[role]).join(", ")}`
                  : ""}
              </li>
            )}
            {!dateChanged &&
              !timeChanged &&
              !venueChanged &&
              !committeeChanged && <li>No changes to save.</li>}
          </ul>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canSave}
              className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
