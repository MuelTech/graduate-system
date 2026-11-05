"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatScheduleDate,
  formatScheduleTime,
} from "@/lib/admin-exam-schedules";
import type { ExamRecordDetail } from "@/types";
import { toast } from "sonner";

const actions = {
  reschedule: { title: "Reschedule", endpoint: "reschedule", target: true },
  cancel: {
    title: "Cancel Appointment",
    endpoint: "cancel-appointment",
    target: false,
  },
  approve: {
    title: "Approve Appeal",
    endpoint: "missed-appeal/approve",
    target: true,
  },
  reject: {
    title: "Reject Appeal",
    endpoint: "missed-appeal/reject",
    target: false,
  },
  reconsider: {
    title: "Reconsider Result",
    endpoint: "reconsider-result",
    target: false,
  },
} as const;
type Action = keyof typeof actions;
type SlotOption = {
  id: string;
  examDate: string;
  examTime: string;
  remainingSeats: number;
};
const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });

export function ExamRecordActions({ record }: { record: ExamRecordDetail }) {
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const client = useQueryClient();
  const optionQuery = useQuery<SlotOption[]>({
    queryKey: ["examAmendmentOptions", record.id],
    queryFn: () =>
      apiClientRequest(`/exam/applications/${record.id}/amendment-options`, {
        cache: "no-store",
      }),
    enabled: action !== null && actions[action].target,
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (!action) throw new Error("Choose an action.");
      return apiClientRequest(
        `/exam/applications/${record.id}/${actions[action].endpoint}`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: reason.trim(),
            ...(actions[action].target ? { targetSlotId: slot } : {}),
          }),
        },
      );
    },
    onSuccess: () => {
      setAction(null);
      setReason("");
      setSlot("");
      toast.success("Examination record updated.");
    },
    onError: (failure: Error) =>
      setError(
        failure.message ||
          "Could not complete this action. Your reason is retained.",
      ),
    onSettled: async () => {
      try {
        await Promise.all(
          [
            ["examRecord", record.id],
            ["examRecords"],
            ["examStatus"],
            ["examSlots"],
            ["adminApplicants"],
            ["adminApplicantDetail"],
            ["applicant-exam-execution"],
          ].map((queryKey) => client.invalidateQueries({ queryKey })),
        );
      } finally {
        busy.current = false;
      }
    },
  });
  const begin = (kind: Action) => {
    setAction(kind);
    setReason("");
    setSlot("");
    setError("");
  };
  const appeal =
    record.status === "APPEALED" &&
    record.scheduleAmendment?.type === "MISSED_APPEAL" &&
    record.scheduleAmendment.status === "PENDING" &&
    record.seatReleasedAt !== null;
  const amendment = record.scheduleAmendment;
  const valid =
    reason.trim().length > 0 &&
    reason.trim().length <= 2000 &&
    (!action || !actions[action].target || !!slot);
  return (
    <>
      {record.canAmendAppointment ||
      amendment ||
      record.replacementOfApplicationId ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-base font-semibold">Appointment Changes</h2>
            {record.canAmendAppointment ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => begin("reschedule")}>
                  Reschedule
                </Button>
                <Button variant="outline" onClick={() => begin("cancel")}>
                  Cancel Appointment
                </Button>
              </div>
            ) : null}
            {amendment ? (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt>Request</dt>
                  <dd>{amendment.reason}</dd>
                </div>
                <div>
                  <dt>Requested</dt>
                  <dd>{dateTime(amendment.requestedAt)}</dd>
                </div>
                <div>
                  <dt>Seat</dt>
                  <dd>
                    {record.seatReleasedAt
                      ? `Released ${dateTime(record.seatReleasedAt)}`
                      : "Reserved"}
                  </dd>
                </div>
                <div>
                  <dt>Amendment Status</dt>
                  <dd>{amendment.status}</dd>
                </div>
                {amendment.decisionReason ? (
                  <div>
                    <dt>Decision Reason</dt>
                    <dd>{amendment.decisionReason}</dd>
                  </div>
                ) : null}
                {amendment.decidedAt ? (
                  <div>
                    <dt>Decided</dt>
                    <dd>
                      {dateTime(amendment.decidedAt)}
                      {amendment.decidedBy
                        ? ` — ${amendment.decidedBy.firstName} ${amendment.decidedBy.lastName}`
                        : ""}
                    </dd>
                  </div>
                ) : null}
                {amendment.targetSlot ? (
                  <div>
                    <dt>Replacement Appointment</dt>
                    <dd>
                      {formatScheduleDate(amendment.targetSlot.examDate)} ·{" "}
                      {formatScheduleTime(amendment.targetSlot.examTime)}
                    </dd>
                  </div>
                ) : null}
                {amendment.replacementApplicationId ? (
                  <Link
                    className="underline"
                    href={`/admin/exam/applications/${amendment.replacementApplicationId}`}
                  >
                    View replacement Exam Record
                  </Link>
                ) : null}
              </dl>
            ) : null}
            {appeal ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => begin("approve")}>Approve Appeal</Button>
                <Button variant="outline" onClick={() => begin("reject")}>
                  Reject Appeal
                </Button>
              </div>
            ) : null}
            {record.replacementOfApplicationId ? (
              <Link
                className="text-sm underline"
                href={`/admin/exam/applications/${record.replacementOfApplicationId}`}
              >
                View original appointment
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {record.canReconsiderResult || record.reconsideration ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-base font-semibold">Institutional Decision</h2>
            <p className="text-sm">Computed Result: FAILED</p>
            {record.reconsideration ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold">PASSED — RECONSIDERED</p>
                <p>{record.reconsideration.reason}</p>
                <p>
                  {record.reconsideration.decidedBy.firstName}{" "}
                  {record.reconsideration.decidedBy.lastName} ·{" "}
                  {dateTime(record.reconsideration.decidedAt)}
                </p>
              </div>
            ) : (
              <Button variant="outline" onClick={() => begin("reconsider")}>
                Reconsider Result
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !busy.current) setAction(null);
        }}
      >
        <DialogContent
          showCloseButton={!mutation.isPending}
          className="max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {action ? actions[action].title : "Examination action"}
            </DialogTitle>
            <DialogDescription>
              {action === "reconsider"
                ? "Record a separate institutional pass decision. The computed FAILED result and all scores stay unchanged. This decision cannot be reversed here."
                : action === "cancel"
                  ? "Cancel this never-started appointment and release its seat. Its original schedule remains in history."
                  : action === "reject"
                    ? "Reject this missed-exam appeal. The original appointment becomes Missed and no replacement is created."
                    : "Confirm a future replacement appointment. The original appointment remains in history."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Original appointment: {formatScheduleDate(record.slot.examDate)} ·{" "}
            {formatScheduleTime(record.slot.examTime)}
          </p>
          {action && actions[action].target ? (
            <div className="space-y-2">
              <Label htmlFor="amendment-slot">Replacement Appointment</Label>
              <select
                id="amendment-slot"
                className="w-full rounded-md border p-2 text-sm"
                value={slot}
                disabled={mutation.isPending || optionQuery.isFetching}
                onChange={(e) => setSlot(e.target.value)}
              >
                <option value="">Choose a future appointment</option>
                {optionQuery.data?.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {formatScheduleDate(candidate.examDate)} ·{" "}
                    {formatScheduleTime(candidate.examTime)} ·{" "}
                    {candidate.remainingSeats} seats available
                  </option>
                ))}
              </select>
              {optionQuery.isFetching ? (
                <p role="status">Loading appointments…</p>
              ) : optionQuery.isError ? (
                <div>
                  <p role="alert">Could not load replacement appointments.</p>
                  <Button
                    variant="outline"
                    onClick={() => void optionQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : optionQuery.data?.length === 0 ? (
                <p>No eligible future appointment is available.</p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="exam-action-reason">
              {action === "reconsider" ? "Justification" : "Reason"}
            </Label>
            <Textarea
              id="exam-action-reason"
              value={reason}
              maxLength={2000}
              disabled={mutation.isPending}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              Back
            </Button>
            <Button
              disabled={
                !valid ||
                mutation.isPending ||
                (action !== null &&
                  actions[action].target &&
                  (optionQuery.isFetching || optionQuery.isError))
              }
              onClick={() => {
                if (!valid || busy.current) return;
                busy.current = true;
                setError("");
                mutation.mutate();
              }}
            >
              {mutation.isPending ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
