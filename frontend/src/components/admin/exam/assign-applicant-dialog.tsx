"use client";
import { AdminDialogContent as DialogContent } from "@/components/admin/access/admin-dialog";
import { useAdminAccess } from "@/components/admin/access/admin-access-provider";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest } from "@/lib/api.client";
import {
  formatScheduleDate,
  formatScheduleTime,
} from "@/lib/admin-exam-schedules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AdminApplicantListRow } from "@/types";

interface AssignmentOptions {
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    pinnacleApplicantId: string | null;
    program: { id: string; programName: string };
    alignmentStatus: string | null;
  };
  eligible: boolean;
  reason: string | null;
  date: string;
  timeZone: string;
  slots: {
    id: string;
    examDate: string;
    examTime: string;
    slotsTaken: number;
    maxSlots: number;
    remainingSeats: number;
  }[];
}

// Presentation only: eligibility and assignment remain server-authoritative.
function assignmentMessage(reason: string | null) {
  switch (reason) {
    case "This Applicant already has an examination record that prevents another assignment.":
      return "This Applicant already has an examination record.";
    case "Program alignment or bridging waiver clearance is required before assignment.":
      return "Program alignment or waiver clearance is required before assignment.";
    case "This slot is fully booked.":
      return "This schedule is full.";
    case "This schedule's booked-seat information needs review. Contact the schedule administrator.":
      return "This schedule's booked-seat information needs review.";
    default:
      return reason;
  }
}

export function AssignApplicantDialog({
  onAssigned,
}: {
  onAssigned: () => void;
}) {
  const { allows } = useAdminAccess();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef(false);
  if (!allows("exam.schedules.manage") || !allows("applicants.view")) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pendingRef.current) setOpen(next);
      }}
    >
      <DialogTrigger render={<Button />}>Assign Applicant</DialogTrigger>
      {open && (
        <AssignmentForm
          pendingRef={pendingRef}
          onClose={() => setOpen(false)}
          onAssigned={onAssigned}
        />
      )}
    </Dialog>
  );
}

function AssignmentForm({
  pendingRef,
  onClose,
  onAssigned,
}: {
  pendingRef: { current: boolean };
  onClose: () => void;
  onAssigned: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [studentId, setStudentId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const applicants = useQuery<{
    applicants: AdminApplicantListRow[];
    total: number;
  }>({
    queryKey: ["assignmentApplicantSearch", debouncedSearch, page],
    queryFn: () =>
      apiClientRequest(
        `/admin/applicants?${new URLSearchParams({ search: debouncedSearch, page: String(page), pageSize: "10" })}`,
      ),
    enabled: debouncedSearch.length > 0 && !studentId,
  });
  const options = useQuery<AssignmentOptions>({
    queryKey: ["examAssignmentOptions", studentId],
    queryFn: () => apiClientRequest(`/exam/assignment-options/${studentId}`),
    enabled: !!studentId,
    staleTime: 0,
  });
  const data = options.data;
  const selectedSlot = data?.slots.find((slot) => slot.id === slotId);
  const canConfirm =
    !!data?.eligible &&
    !!selectedSlot &&
    !options.isFetching &&
    !options.isError;

  const assignment = useMutation({
    mutationFn: () =>
      apiClientRequest("/exam/assignments", {
        method: "POST",
        body: JSON.stringify({ studentId, slotId }),
      }),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["examRecords"] });
      void queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
      void queryClient.invalidateQueries({
        queryKey: ["examAssignmentOptions"],
      });
      onAssigned();
      toast.success("Applicant assigned to the examination schedule.");
      pendingRef.current = false;
      onClose();
    },
    onError: (failure: Error) => {
      setError(
        assignmentMessage(failure.message) ||
          "Assignment could not be completed. Review the Applicant and schedule again.",
      );
      setReview(false);
      setSlotId("");
      void options.refetch();
    },
    onSettled: () => {
      pendingRef.current = false;
    },
  });

  function confirm() {
    if (pendingRef.current || assignment.isPending || !review || !canConfirm)
      return;
    pendingRef.current = true; // Synchronous guard also covers two clicks before rerender.
    setError("");
    assignment.mutate();
  }

  function changeApplicant() {
    setStudentId("");
    setSlotId("");
    setReview(false);
    setError("");
  }

  return (
    <DialogContent
      className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
      showCloseButton={!assignment.isPending}
    >
      <DialogHeader>
        <DialogTitle>
          {review ? "Confirm Applicant Assignment" : "Assign Applicant"}
        </DialogTitle>
        <DialogDescription>
          Assign a registered Applicant to an existing schedule for today.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!studentId ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignment-search">Find registered Applicant</Label>
            <Input
              id="assignment-search"
              value={search}
              placeholder="Name, email, or Pinnacle Applicant ID"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {search.trim() !== debouncedSearch ||
          (debouncedSearch && applicants.isLoading) ? (
            <p role="status">Searching Applicants…</p>
          ) : applicants.isError ? (
            <div role="alert" className="space-y-2">
              <p>Applicants could not be loaded.</p>
              <Button variant="outline" onClick={() => applicants.refetch()}>
                Retry search
              </Button>
            </div>
          ) : debouncedSearch && applicants.data ? (
            <>
              <ul className="space-y-2" aria-label="Registered Applicants">
                {applicants.data.applicants.map((applicant) => (
                  <li key={applicant.id}>
                    <button
                      type="button"
                      className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => {
                        setStudentId(applicant.id);
                        setSlotId("");
                        setError("");
                      }}
                    >
                      <span className="block font-semibold">
                        {applicant.firstName} {applicant.lastName}
                      </span>
                      <span className="block break-words">
                        {applicant.pinnacleApplicantId ||
                          "Pinnacle ID unavailable"}{" "}
                        · {applicant.email}
                      </span>
                      <span className="block break-words text-muted-foreground">
                        {applicant.program?.programName ||
                          "Program unavailable"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {applicants.data.total === 0 && (
                <p>No registered Applicants match this search.</p>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <span>Page {page}</span>
                <Button
                  variant="outline"
                  disabled={page * 10 >= applicants.data.total}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Search for an Applicant to begin.
            </p>
          )}
        </div>
      ) : options.isError ? (
        <div role="alert" className="space-y-2">
          <p>
            {options.error.message ||
              "Applicant eligibility could not be loaded."}
          </p>
          <Button variant="outline" onClick={() => options.refetch()}>
            Retry eligibility check
          </Button>
        </div>
      ) : options.isFetching || !data ? (
        <p role="status">Checking Applicant and today&apos;s schedules…</p>
      ) : (
        <div className="space-y-4">
          <dl className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Applicant</dt>
              <dd className="font-semibold break-words">
                {data.applicant.firstName} {data.applicant.lastName}
              </dd>
              <dd className="break-words">{data.applicant.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pinnacle Applicant ID</dt>
              <dd>{data.applicant.pinnacleApplicantId || "Unavailable"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Program</dt>
              <dd className="break-words">
                {data.applicant.program.programName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Program alignment</dt>
              <dd>
                {data.applicant.alignmentStatus === "ALIGNED"
                  ? "Aligned"
                  : data.applicant.alignmentStatus === "CLEARED"
                    ? "Cleared"
                    : "Clearance required"}
              </dd>
            </div>
          </dl>
          <p role="status">
            {data.eligible
              ? "Eligible for assignment."
              : assignmentMessage(data.reason)}
          </p>
          {data.eligible && !review && (
            <fieldset className="space-y-2">
              <legend className="mb-2 font-medium">
                Today&apos;s available schedules
              </legend>
              {data.slots.length === 0 && (
                <p>
                  No schedules are available for this Applicant’s Program.
                </p>
              )}
              {data.slots.map((slot) => (
                <label
                  key={slot.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                >
                  <input
                    type="radio"
                    name="assignment-slot"
                    value={slot.id}
                    checked={slotId === slot.id}
                    onChange={() => {
                      setSlotId(slot.id);
                      setError("");
                    }}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block font-medium">
                      {formatScheduleDate(slot.examDate)} ·{" "}
                      {formatScheduleTime(slot.examTime)}
                    </span>
                    <span className="block text-muted-foreground">
                      {slot.slotsTaken} / {slot.maxSlots} booked ·{" "}
                      {slot.remainingSeats} seats remaining
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {review && selectedSlot && (
            <div className="space-y-2 rounded-md border p-4">
              <p className="font-medium">Scheduled Examination</p>
              <p>
                {formatScheduleDate(selectedSlot.examDate)} ·{" "}
                {formatScheduleTime(selectedSlot.examTime)}
              </p>
              <p>
                {selectedSlot.slotsTaken} / {selectedSlot.maxSlots} booked ·{" "}
                {selectedSlot.remainingSeats} seats remaining
              </p>
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button
          variant="outline"
          disabled={assignment.isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
        {studentId && (
          <Button
            variant="outline"
            disabled={assignment.isPending}
            onClick={review ? () => setReview(false) : changeApplicant}
          >
            {review ? "Go Back" : "Change Applicant"}
          </Button>
        )}
        {review ? (
          <Button
            disabled={!canConfirm || assignment.isPending}
            onClick={confirm}
          >
            {assignment.isPending ? "Assigning…" : "Confirm Assignment"}
          </Button>
        ) : (
          <Button
            disabled={!canConfirm || assignment.isPending}
            onClick={() => setReview(true)}
          >
            Review Assignment
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
