"use client";
import { AdminDialogContent as DialogContent } from "@/components/admin/access/admin-dialog";

import type { RefObject } from "react";
import { AdminLink as Link } from "@/components/admin/access/admin-access-provider";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  formatScheduleDate,
  formatScheduleTime,
} from "@/lib/admin-exam-schedules";
import { examinationTimestamp } from "@/lib/exam-execution";
import { deriveExamState } from "@/lib/exam-record-state";
import { ExamStateBadge } from "@/components/admin/exam/exam-state-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExamScheduleBooking, ExamSlot } from "@/types";

export function ScheduleBookingsDialog({
  slot,
  onClose,
  returnFocusRef,
}: {
  slot: ExamSlot | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog
      open={slot !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"
        finalFocus={returnFocusRef}
      >
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle>Schedule bookings</DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            {slot?.program?.programName || "Unknown Program"}
            {slot && (
              <>
                {" "}
                · {formatScheduleDate(slot.examDate)} ·{" "}
                {formatScheduleTime(slot.examTime)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {slot && <BookingList key={slot.id} slotId={slot.id} />}
      </DialogContent>
    </Dialog>
  );
}

function BookingList({ slotId }: { slotId: string }) {
  const bookings = useQuery<ExamScheduleBooking[]>({
    queryKey: ["examSlotBookings", slotId],
    queryFn: () =>
      apiClientRequest(`/exam/slots/${encodeURIComponent(slotId)}/bookings`, {
        method: "GET",
      }),
    // Always reread on opening; never display an earlier occupancy snapshot while refreshing.
    gcTime: 0,
  });

  if (bookings.isLoading || bookings.isFetching) {
    return (
      <div role="status" aria-label="Loading bookings" className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (bookings.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p>Could not load schedule bookings.</p>
        <Button variant="outline" size="sm" onClick={() => bookings.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!bookings.data?.length) {
    return (
      <p className="py-6 text-center text-muted-foreground">
        No current bookings for this schedule.
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <ul className="space-y-3">
        {bookings.data.map((booking) => (
          <li
            key={booking.id}
            className="min-w-0 space-y-3 rounded-lg border p-4 [overflow-wrap:anywhere]"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {booking.student.user.firstName}{" "}
                  {booking.student.user.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Pinnacle Applicant ID:{" "}
                  {booking.student.pinnacleApplicantId || "—"}
                </p>
              </div>
              <Link
                href={`/admin/exam/applications/${booking.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                View Exam Record
              </Link>
            </div>
            <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  Booking recorded
                </dt>
                <dd className="mt-1 text-sm">
                  <time dateTime={booking.createdAt}>
                    {examinationTimestamp(booking.createdAt)}
                  </time>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Exam State</dt>
                <dd className="mt-1 [&_[data-slot=badge]]:h-auto [&_[data-slot=badge]]:min-h-5 [&_[data-slot=badge]]:max-w-full [&_[data-slot=badge]]:whitespace-normal">
                  <ExamStateBadge
                    state={deriveExamState(
                      booking.status,
                      booking.essayEvaluationCompleted,
                      booking.reconsidered,
                    )}
                  />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
