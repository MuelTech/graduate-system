"use client";
import { useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  formatScheduleDate,
  formatScheduleTime,
} from "@/lib/admin-exam-schedules";

export type AppointmentStatus = {
  applicationId: string | null;
  examStatus: string;
  canAppealMissedExam: boolean;
  confirmedSlot: { examDate: string; examTime: string } | null;
  amendment: { reason: string; status: string } | null;
};
export function ApplicantAppointmentGate({
  children,
}: {
  children: ReactNode;
}) {
  const { data: session } = useSession();
  const client = useQueryClient();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const busy = useRef(false);
  const query = useQuery<AppointmentStatus>({
    queryKey: ["examStatus", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: () => apiClientRequest("/exam/status", { cache: "no-store" }),
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: () =>
      apiClientRequest(
        `/exam/applications/${query.data!.applicationId}/missed-appeal`,
        { method: "POST", body: JSON.stringify({ reason: reason.trim() }) },
      ),
    onSuccess: () => {
      setOpen(false);
      setReason("");
    },
    onError: (failure: Error) =>
      setError(
        failure.message ||
          "Could not file the appeal. Your reason is retained.",
      ),
    onSettled: async () => {
      try {
        await Promise.all(
          [["examStatus"], ["applicant-exam-execution"], ["examSlots"]].map(
            (queryKey) => client.invalidateQueries({ queryKey }),
          ),
        );
      } finally {
        busy.current = false;
      }
    },
  });
  if (query.isLoading) return <p role="status">Loading appointment…</p>;
  if (query.isError || !query.data)
    return (
      <div>
        <p role="alert">Could not load your appointment.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  const status = query.data;
  const pending = status.examStatus === "appealed";
  if (!status.canAppealMissedExam && !pending && status.examStatus !== "missed")
    return children;
  const appointment = status.confirmedSlot
    ? `${formatScheduleDate(status.confirmedSlot.examDate)} · ${formatScheduleTime(status.confirmedSlot.examTime)}`
    : "Not recorded";
  const valid = reason.trim().length > 0 && reason.trim().length <= 2000;
  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-lg font-semibold">
            {pending
              ? "Missed Exam Appeal Pending"
              : status.examStatus === "missed"
                ? "Missed Examination"
                : "Appeal Missed Exam"}
          </h2>
          <p className="text-sm">Original appointment: {appointment}</p>
          {pending ? (
            <p className="text-sm">
              Graduate School staff will review your appeal and choose a
              replacement appointment if approved.
            </p>
          ) : status.examStatus === "missed" ? (
            <p className="text-sm">
              Your appeal was rejected. No replacement appointment is
              authorized. Contact Graduate School staff.
            </p>
          ) : (
            <Button
              onClick={() => {
                setOpen(true);
                setError("");
              }}
            >
              Appeal Missed Exam
            </Button>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy.current) setOpen(value);
        }}
      >
        <DialogContent showCloseButton={!mutation.isPending}>
          <DialogHeader>
            <DialogTitle>Appeal Missed Exam</DialogTitle>
            <DialogDescription>
              Use this appeal for an appointment on an earlier calendar date.
              Same-day late arrival follows Start Examination. Filing releases
              the missed appointment&apos;s seat; staff choose any approved
              replacement.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">Original appointment: {appointment}</p>
          <Label htmlFor="missed-appeal-reason">Reason</Label>
          <Textarea
            id="missed-appeal-reason"
            required
            maxLength={2000}
            value={reason}
            disabled={mutation.isPending}
            onChange={(e) => setReason(e.target.value)}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Back
            </Button>
            <Button
              disabled={!valid || mutation.isPending}
              onClick={() => {
                if (!valid || busy.current || !status.canAppealMissedExam)
                  return;
                busy.current = true;
                setError("");
                mutation.mutate();
              }}
            >
              {mutation.isPending ? "Submitting…" : "Submit Appeal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
