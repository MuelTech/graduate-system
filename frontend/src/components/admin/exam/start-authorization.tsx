"use client";
import { AdminDialogContent as DialogContent } from "@/components/admin/access/admin-dialog";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import type { ExamExecution } from "@/lib/exam-execution";
import { examinationTimestamp } from "@/lib/exam-execution";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatScheduleDate,
  formatScheduleTime,
} from "@/lib/admin-exam-schedules";

export function StartAuthorization({
  applicationId,
  applicantName,
}: {
  applicationId: string;
  applicantName: string;
}) {
  const queryClient = useQueryClient();
  const key = ["admin-exam-execution", applicationId];
  const endpoint = `/exam-engine/admin/applications/${encodeURIComponent(applicationId)}`;
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  const query = useQuery<ExamExecution>({
    queryKey: key,
    queryFn: () =>
      apiClientRequest(`${endpoint}/execution`, {
        method: "GET",
        cache: "no-store",
      }),
    refetchInterval: 15_000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      apiClientRequest(`${endpoint}/start-authorization`, {
        method: "POST",
        body: "{}",
      }),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      setOpen(false);
    },
    onError: () => {
      void query.refetch();
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  if (query.isPending) return <Skeleton className="h-28 w-full" />;
  if (query.isError || !query.data)
    return (
      <div role="alert" className="space-y-2 text-sm">
        Exam Timing could not be loaded.{" "}
        <Button variant="outline" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  const execution = query.data;
  const actor = execution.authorization?.authorizedBy;
  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-base font-semibold">Exam Timing</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Scheduled</dt>
            <dd>
              {formatScheduleDate(execution.appointment.examDate)} ·{" "}
              {formatScheduleTime(execution.appointment.examTime)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Started</dt>
            <dd>
              {execution.actualStartedAt
                ? examinationTimestamp(execution.actualStartedAt)
                : execution.state === "LEGACY_UNBOUND"
                  ? "Not recorded for this legacy examination"
                  : "Not started"}
            </dd>
          </div>
          {execution.deadlineAt && (
            <div>
              <dt className="text-muted-foreground">Ends</dt>
              <dd>{examinationTimestamp(execution.deadlineAt)}</dd>
            </div>
          )}
        </dl>
        {execution.canAuthorize && !execution.authorization && (
          <Button
            onClick={() => {
              mutation.reset();
              setOpen(true);
            }}
          >
            Authorize Start Now
          </Button>
        )}
        {execution.authorization && !execution.actualStartedAt && (
          <p className="text-sm text-muted-foreground">
            Authorized{actor ? ` by ${actor.firstName} ${actor.lastName}` : ""} ·{" "}
            {examinationTimestamp(execution.authorization.authorizedAt)}
          </p>
        )}
        <Dialog
          open={open}
          onOpenChange={(value) => {
            if (!busy.current) setOpen(value);
          }}
        >
          <DialogContent showCloseButton={!mutation.isPending}>
            <DialogHeader>
              <DialogTitle>
                Authorize Start Now for {applicantName}?
              </DialogTitle>
              <DialogDescription>
                The scheduled date and time stay unchanged. The timer begins only
                when this Applicant clicks Start Examination today.
              </DialogDescription>
            </DialogHeader>
            {mutation.isError && (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error.message}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={mutation.isPending}
                onClick={() => {
                  if (busy.current) return;
                  busy.current = true;
                  mutation.mutate();
                }}
              >
                {mutation.isPending ? "Authorizing…" : "Authorize Start Now"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
