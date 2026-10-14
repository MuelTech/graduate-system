"use client";

import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExamSlot, Program } from "@/types";
import {
  EXAM_AVAILABILITY_LABEL,
  formatScheduleDate,
  formatScheduleTime,
  hasFormErrors,
  isPastExamSchedule,
  matchesAvailabilityFilter,
  matchesTemporalFilter,
  paginationWindow,
  resolveExamCapacity,
  resolveExamScheduleAvailability,
  toDateInputValue,
  toSchedulePayload,
  toTimeInputValue,
  validateExamScheduleForm,
  type ExamAvailabilityFilter,
  type ExamScheduleAvailability,
  type ExamScheduleFormErrors,
  type ExamTemporalFilter,
} from "@/lib/admin-exam-schedules";
import {
  AlertCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";

const PAGE_SIZE = 10;
const ALL = "ALL";

/* ----------------------------------------------------------- presentation */

const TEMPORAL_OPTIONS: { value: ExamTemporalFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

const AVAILABILITY_OPTIONS: {
  value: ExamAvailabilityFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "full", label: "Full" },
  { value: "closed", label: "Closed" },
];

const AVAILABILITY_BADGE_CLASS: Record<ExamScheduleAvailability, string> = {
  OPEN: "text-(--earist-success)",
  FULL: "text-(--earist-warning)",
  CLOSED: "text-(--earist-body-text)/70",
  PAST: "text-(--earist-body-text)/70",
};

function AvailabilityBadge({
  availability,
}: {
  availability: ExamScheduleAvailability;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", AVAILABILITY_BADGE_CLASS[availability])}
    >
      {EXAM_AVAILABILITY_LABEL[availability]}
    </Badge>
  );
}

function CapacityCell({
  slotsTaken,
  maxSlots,
}: {
  slotsTaken: number;
  maxSlots: number;
}) {
  const capacity = resolveExamCapacity(slotsTaken, maxSlots);
  if (!capacity.hasCapacity) {
    return (
      <div className="min-w-0">
        <p className="text-sm break-words text-foreground">
          No capacity configured
        </p>
        <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
          Capacity unavailable
        </p>
      </div>
    );
  }
  const barClass = capacity.isFull
    ? "bg-(--earist-warning)"
    : capacity.percent >= 80
      ? "bg-(--earist-warning)"
      : "bg-(--earist-success)";
  return (
    <div className="min-w-0">
      <p className="text-sm break-words text-foreground">
        {capacity.booked} / {capacity.maximum} booked
      </p>
      <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
        {capacity.isFull
          ? "No seats available"
          : `${capacity.available} seat${capacity.available === 1 ? "" : "s"} available`}
      </p>
      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-(--earist-border-gray)">
        <div
          className={cn("h-full rounded-full", barClass)}
          style={{ width: `${capacity.percent}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ states */

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[21%]" />
          <col className="w-[21%]" />
          <col className="w-[13%]" />
          <col className="w-[19%]" />
        </colgroup>
        {children}
      </table>
    </div>
  );
}

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Program
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Schedule
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Capacity
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-(--earist-body-text)">
          Availability
        </th>
        <th className="px-4 py-3 text-right text-xs font-semibold text-(--earist-body-text)">
          Action
        </th>
      </tr>
    </thead>
  );
}

function TableSkeleton() {
  return (
    <TableShell>
      <TableHead />
      <tbody aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <tr
            key={index}
            className="border-b border-(--earist-border-gray) last:border-0"
          >
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-40" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-4 w-20" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-2 h-1.5 w-24 rounded-full" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="h-5 w-16 rounded-full" />
            </td>
            <td className="px-4 py-3 align-top">
              <Skeleton className="ml-auto h-8 w-28 rounded-md" />
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function EmptyState({
  hasAnySchedules,
  onClear,
  onCreate,
}: {
  hasAnySchedules: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <CalendarClock
        className="h-8 w-8 text-(--earist-body-text)/40"
        aria-hidden="true"
      />
      {hasAnySchedules ? (
        <>
          <p className="text-sm font-medium text-(--earist-primary)">
            No schedules match the current filters.
          </p>
          <p className="max-w-sm text-sm text-(--earist-body-text)">
            Try a different time range, program, or availability.
          </p>
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear Filters
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-(--earist-primary)">
            No entrance exam schedules yet.
          </p>
          <p className="max-w-sm text-sm text-(--earist-body-text)">
            Create a schedule to make an entrance exam date available to
            applicants.
          </p>
          <Button size="sm" onClick={onCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Create Schedule
          </Button>
        </>
      )}
    </div>
  );
}

function ErrorState({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <AlertCircle
        className="h-8 w-8 text-(--earist-secondary)"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--earist-primary)">
          Unable to load entrance exam schedules
        </p>
        <p className="text-sm text-(--earist-body-text)">
          The schedule list for the current view could not be loaded. Please try
          again.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        <RefreshCw
          className={cn("mr-2 h-4 w-4", retrying && "animate-spin")}
          aria-hidden="true"
        />
        Retry
      </Button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------- page */

export default function AdminExamSchedulesPage() {
  const queryClient = useQueryClient();

  const [temporal, setTemporal] = useState<ExamTemporalFilter>("upcoming");
  const [programId, setProgramId] = useState<string>(ALL);
  const [availability, setAvailability] =
    useState<ExamAvailabilityFilter>("all");
  const [page, setPage] = useState(1);

  // Create / edit dialog state.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExamSlot | null>(null);
  const [formProgramId, setFormProgramId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formErrors, setFormErrors] = useState<ExamScheduleFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Booking-state confirmation state (close / reopen for booking).
  const [confirmTarget, setConfirmTarget] = useState<ExamSlot | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const slotsQuery = useQuery<ExamSlot[]>({
    queryKey: ["examSlots"],
    queryFn: async () => apiClientRequest("/exam/slots", { method: "GET" }),
    placeholderData: keepPreviousData,
  });

  const programsQuery = useQuery<{ graduatePrograms: Program[] }>({
    queryKey: ["programs"],
    queryFn: async () => apiClientRequest("/programs", { method: "GET" }),
  });

  const graduatePrograms = programsQuery.data?.graduatePrograms ?? [];

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      programId: string;
      examDate: string;
      examTime: string;
      maxSlots: number;
    }) => {
      if (editing) {
        return apiClientRequest(`/exam/slots/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return apiClientRequest("/exam/slots", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examSlots"] });
      closeDialog();
    },
    onError: (error: unknown) => {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to save the schedule. Please try again.",
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (target: { id: string; isActive: boolean }) =>
      apiClientRequest(`/exam/slots/${target.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: target.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examSlots"] });
      setConfirmTarget(null);
      closeDialog();
    },
    onError: (error: unknown) => {
      setStatusError(
        error instanceof Error
          ? error.message
          : "Failed to update the schedule availability. Please try again.",
      );
    },
  });

  const now = new Date();
  const slots = slotsQuery.data ?? [];

  const filteredSlots = slots.filter(
    (slot) =>
      matchesTemporalFilter(slot, temporal, now) &&
      (programId === ALL || slot.programId === programId) &&
      matchesAvailabilityFilter(slot, availability, now),
  );

  const total = filteredSlots.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const rangeStart = (effectivePage - 1) * PAGE_SIZE;
  const pageItems = filteredSlots.slice(rangeStart, rangeStart + PAGE_SIZE);
  const pageNumbers = paginationWindow(effectivePage, totalPages);

  const hasAnySchedules = slots.length > 0;
  const isFiltered =
    temporal !== "upcoming" || programId !== ALL || availability !== "all";

  const isLoading = slotsQuery.isLoading;
  const hasData = slotsQuery.data != null;
  const isFetching = slotsQuery.isFetching;
  const loadFailedWithoutData = slotsQuery.isError && !hasData;
  const refetchFailed = slotsQuery.isError && hasData;
  const programsFailed = programsQuery.isError;

  const editingBookedCount = editing?.slotsTaken ?? 0;
  const isEditingBooked = editingBookedCount > 0;
  const isEditingPast =
    editing !== null &&
    isPastExamSchedule(editing.examDate, editing.examTime, now);

  const programFilterLabel =
    programId === ALL
      ? "All Programs"
      : (graduatePrograms.find((program) => program.id === programId)
          ?.programName ?? "All Programs");

  const formProgramLabel =
    graduatePrograms.find((program) => program.id === formProgramId)
      ?.programName ?? "Select program";

  function resetForm() {
    setEditing(null);
    setFormProgramId("");
    setFormDate("");
    setFormTime("");
    setFormCapacity("");
    setFormErrors({});
    setSubmitError(null);
  }

  function closeDialog() {
    setDialogOpen(false);
    resetForm();
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(slot: ExamSlot) {
    setEditing(slot);
    setFormProgramId(slot.programId);
    setFormDate(toDateInputValue(slot.examDate));
    setFormTime(toTimeInputValue(slot.examTime));
    setFormCapacity(String(slot.maxSlots));
    setFormErrors({});
    setSubmitError(null);
    setDialogOpen(true);
  }

  function clearFilters() {
    setTemporal("upcoming");
    setProgramId(ALL);
    setAvailability("all");
    setPage(1);
  }

  function handleSubmit() {
    const errors = validateExamScheduleForm(
      {
        programId: formProgramId,
        examDate: formDate,
        examTime: formTime,
        capacity: formCapacity,
      },
      { bookedCount: editingBookedCount },
    );
    setFormErrors(errors);
    if (hasFormErrors(errors)) return;

    setSubmitError(null);
    saveMutation.mutate({
      programId: formProgramId,
      maxSlots: Number(formCapacity),
      ...toSchedulePayload(formDate, formTime),
    });
  }

  function handleConfirmToggle() {
    if (!confirmTarget) return;
    toggleMutation.mutate({
      id: confirmTarget.id,
      isActive: !confirmTarget.isActive,
    });
  }

  const availabilityFilterLabel =
    AVAILABILITY_OPTIONS.find((option) => option.value === availability)
      ?.label ?? "All";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrance Exam Schedules"
        description="Create and manage entrance exam schedules and capacity."
        actions={
          <Button
            onClick={openCreate}
            className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Create Schedule
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div>
              <span className="mb-1 block text-sm font-medium text-(--earist-body-text)">
                Time range
              </span>
              <div
                role="group"
                aria-label="Time range"
                className="inline-flex rounded-lg border border-(--earist-border-gray) p-0.5"
              >
                {TEMPORAL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={temporal === option.value}
                    onClick={() => {
                      setTemporal(option.value);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none",
                      temporal === option.value
                        ? "bg-(--earist-primary) text-white"
                        : "text-(--earist-body-text) hover:bg-(--earist-surface-gray)",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full sm:w-72">
              <label
                htmlFor="filter-program"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Program
              </label>
              <Select
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value ?? ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-program" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={programFilterLabel}
                  >
                    {programFilterLabel}
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[min(92vw,24rem)]">
                  <SelectItem
                    value={ALL}
                    className="items-start [&>div]:shrink [&>div]:whitespace-normal"
                  >
                    All Programs
                  </SelectItem>
                  {graduatePrograms.map((program) => (
                    <SelectItem
                      key={program.id}
                      value={program.id}
                      className="items-start [&>div]:shrink [&>div]:whitespace-normal"
                    >
                      {program.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-44">
              <label
                htmlFor="filter-availability"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Availability
              </label>
              <Select
                value={availability}
                onValueChange={(value) => {
                  setAvailability(
                    (value ?? "all") as ExamAvailabilityFilter,
                  );
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-availability" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={availabilityFilterLabel}
                  >
                    {availabilityFilterLabel}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 lg:ml-auto lg:pb-0.5">
              {isFetching && !isLoading && (
                <span
                  className="text-xs text-(--earist-body-text)"
                  role="status"
                >
                  Updating…
                </span>
              )}
              {isFiltered && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {programsFailed && (
            <p className="mt-3 text-xs text-(--earist-body-text)" role="status">
              Program list could not be loaded. Program filtering and schedule
              creation are temporarily unavailable.
            </p>
          )}
        </CardContent>
      </Card>

      {refetchFailed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-light-red) px-4 py-2.5">
          <p className="text-sm text-(--earist-body-text)">
            Couldn&apos;t refresh the schedules. Showing the most recent results.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => slotsQuery.refetch()}
            disabled={isFetching}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden py-0">
        <CardContent className="min-w-0 p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : loadFailedWithoutData ? (
            <ErrorState
              onRetry={() => slotsQuery.refetch()}
              retrying={isFetching}
            />
          ) : filteredSlots.length === 0 ? (
            <EmptyState
              hasAnySchedules={hasAnySchedules}
              onClear={clearFilters}
              onCreate={openCreate}
            />
          ) : (
            <TableShell>
              <TableHead />
              <tbody>
                {pageItems.map((slot) => {
                  const slotAvailability = resolveExamScheduleAvailability(
                    slot,
                    now,
                  );
                  return (
                    <tr
                      key={slot.id}
                      className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-medium break-words text-foreground">
                          {slot.program?.programName ?? "Program unavailable"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm font-medium break-words text-foreground">
                          {formatScheduleDate(slot.examDate)}
                        </p>
                        <p className="mt-0.5 text-sm break-words text-(--earist-body-text)">
                          {formatScheduleTime(slot.examTime)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <CapacityCell
                          slotsTaken={slot.slotsTaken}
                          maxSlots={slot.maxSlots}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <AvailabilityBadge availability={slotAvailability} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(slot)}
                          >
                            <Pencil
                              className="mr-1.5 h-4 w-4"
                              aria-hidden="true"
                            />
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-(--earist-body-text)">
            Showing {rangeStart + 1}–{Math.min(rangeStart + PAGE_SIZE, total)} of{" "}
            {total} {total === 1 ? "schedule" : "schedules"}
          </p>
          {totalPages > 1 && (
            <nav
              aria-label="pagination"
              className="flex items-center gap-1"
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go to previous page"
                onClick={() => setPage(Math.max(1, effectivePage - 1))}
                disabled={effectivePage === 1}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              {pageNumbers.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={effectivePage === pageNumber ? "outline" : "ghost"}
                  size="icon"
                  aria-label={`Go to page ${pageNumber}`}
                  aria-current={
                    effectivePage === pageNumber ? "page" : undefined
                  }
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go to next page"
                onClick={() =>
                  setPage(Math.min(totalPages, effectivePage + 1))
                }
                disabled={effectivePage === totalPages}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Schedule" : "Create Schedule"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this entrance exam schedule."
                : "Add an entrance exam schedule for a graduate program."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isEditingBooked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                This schedule already has booked applicants. Program, date, and
                start time can no longer be changed.
              </div>
            )}

            <div>
              <label
                htmlFor="schedule-program"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Program
              </label>
              <Select
                value={formProgramId}
                onValueChange={(value) => setFormProgramId(value ?? "")}
                disabled={isEditingBooked}
              >
                <SelectTrigger id="schedule-program" className="w-full">
                  <span
                    className="flex-1 truncate text-left"
                    title={formProgramLabel}
                  >
                    {formProgramLabel}
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[min(92vw,24rem)]">
                  {graduatePrograms.map((program) => (
                    <SelectItem
                      key={program.id}
                      value={program.id}
                      className="items-start [&>div]:shrink [&>div]:whitespace-normal"
                    >
                      {program.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={formErrors.programId} />
            </div>

            <div>
              <label
                htmlFor="schedule-date"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Exam Date
              </label>
              <Input
                id="schedule-date"
                type="date"
                value={formDate}
                onChange={(event) => setFormDate(event.target.value)}
                disabled={isEditingBooked}
                aria-invalid={Boolean(formErrors.examDate)}
              />
              <FieldError message={formErrors.examDate} />
            </div>

            <div>
              <label
                htmlFor="schedule-time"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Start Time
              </label>
              <Input
                id="schedule-time"
                type="time"
                value={formTime}
                onChange={(event) => setFormTime(event.target.value)}
                disabled={isEditingBooked}
                aria-invalid={Boolean(formErrors.examTime)}
              />
              <FieldError message={formErrors.examTime} />
            </div>

            <div>
              <label
                htmlFor="schedule-capacity"
                className="mb-1 block text-sm font-medium text-(--earist-body-text)"
              >
                Capacity
              </label>
              <Input
                id="schedule-capacity"
                type="number"
                min={isEditingBooked ? editingBookedCount : 1}
                value={formCapacity}
                onChange={(event) => setFormCapacity(event.target.value)}
                placeholder="e.g., 30"
                aria-invalid={Boolean(formErrors.capacity)}
              />
              <FieldError message={formErrors.capacity} />
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}
          </div>

          {/* Primary actions */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
            >
              {saveMutation.isPending
                ? editing
                  ? "Saving…"
                  : "Creating…"
                : editing
                  ? "Save Changes"
                  : "Create Schedule"}
            </Button>
          </div>

          {/*
            Secondary booking-state management: kept visually separate from the
            ordinary form submission. Only for an existing future schedule; a
            past schedule is no longer a meaningful booking target.
          */}
          {editing && !isEditingPast && (
            <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray)/50 p-4">
              <h3 className="text-sm font-semibold text-(--earist-secondary)">
                Booking availability
              </h3>
              <p className="mt-1 text-xs text-(--earist-body-text)">
                {editing.isActive
                  ? "This schedule is open for new applicant bookings. Closing it stops new applicants from selecting it; it does not delete the schedule or affect already-booked applicants."
                  : "This schedule is closed to new applicant bookings. Reopening it lets new applicants select it again, subject to its remaining capacity."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={toggleMutation.isPending}
                onClick={() => {
                  setStatusError(null);
                  setConfirmTarget(editing);
                }}
              >
                {editing.isActive ? "Close for Booking" : "Reopen for Booking"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking-state confirmation (close / reopen for booking) */}
      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmTarget && !confirmTarget.isActive
                ? "Reopen this schedule for booking?"
                : "Close this schedule for booking?"}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget && !confirmTarget.isActive
                ? "New applicants will be able to select this schedule again, subject to its remaining capacity."
                : "New applicants will no longer be able to select this schedule. Existing booked applicants will remain assigned."}
            </DialogDescription>
          </DialogHeader>

          {statusError && (
            <p role="alert" className="text-sm text-destructive">
              {statusError}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmTarget(null)}
              disabled={toggleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmToggle}
              disabled={toggleMutation.isPending}
              className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
            >
              {toggleMutation.isPending
                ? confirmTarget && !confirmTarget.isActive
                  ? "Reopening…"
                  : "Closing…"
                : confirmTarget && !confirmTarget.isActive
                  ? "Reopen for Booking"
                  : "Close for Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
