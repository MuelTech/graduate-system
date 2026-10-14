"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { PendingCorUpload as PendingUpload, Program } from "@/types";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";

type FieldStatus = "MATCH" | "DIFFERENT" | "NO_DATA" | "NOT_EXTRACTED";

type ConfirmForm = {
  surname: string;
  firstName: string;
  middleNameOrInitial: string;
  email: string;
  studentNumber: string;
  registrationNumber: string;
};

const EMPTY_FORM: ConfirmForm = {
  surname: "",
  firstName: "",
  middleNameOrInitial: "",
  email: "",
  studentNumber: "",
  registrationNumber: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Collapses repeated whitespace and trims. */
function collapse(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Lower-cased, whitespace-collapsed form for comparison only. */
function normalizeForCompare(value: string | null | undefined): string {
  return collapse(value).toLowerCase();
}

/**
 * Resolves an extracted COR Program string to a unique EXISTING Program id.
 * Exact match only — the parser never authoritatively selects or creates a
 * Program; ambiguous or absent matches yield no preselection.
 */
function resolveProgramId(
  corProgram: string | null | undefined,
  programs: Program[],
): string {
  const target = normalizeForCompare(corProgram);
  if (!target) return "";
  const matches = programs.filter(
    (p) => normalizeForCompare(p.programName) === target,
  );
  return matches.length === 1 ? matches[0].id : "";
}

/* ---------------------------------------------------- extraction projection */

const EXTRACTION_LABEL: Record<string, string> = {
  COMPLETED: "Extraction complete",
  PROCESSING: "Processing",
  MANUAL_REQUIRED: "Manual review",
  FAILED: "Extraction failed",
  PENDING: "Pending",
};

const EXTRACTION_BADGE_CLASS: Record<string, string> = {
  COMPLETED: "text-(--earist-success)",
  PROCESSING: "text-(--earist-secondary)",
  MANUAL_REQUIRED: "text-(--earist-warning)",
  FAILED: "text-destructive",
  PENDING: "text-(--earist-body-text)/70",
};

/** Extraction status is assistive context; it is never verification authority. */
function ExtractionStatusBadge({ status }: { status: string }) {
  const key = EXTRACTION_LABEL[status] ? status : "PENDING";
  const Icon =
    key === "COMPLETED"
      ? CheckCircle2
      : key === "MANUAL_REQUIRED"
        ? AlertTriangle
        : key === "FAILED"
          ? XCircle
          : Clock;
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", EXTRACTION_BADGE_CLASS[key])}
    >
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {EXTRACTION_LABEL[key]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: FieldStatus }) {
  switch (status) {
    case "MATCH":
      return (
        <Badge variant="outline" className="font-medium text-(--earist-success)">
          Match
        </Badge>
      );
    case "DIFFERENT":
      return (
        <Badge variant="outline" className="font-medium text-(--earist-warning)">
          Different
        </Badge>
      );
    case "NO_DATA":
      return (
        <Badge
          variant="outline"
          className="font-medium text-(--earist-body-text)/70"
        >
          No existing data
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="font-medium text-(--earist-body-text)/70"
        >
          Not extracted
        </Badge>
      );
  }
}

function MutedValue({
  value,
  emptyLabel,
}: {
  value: string;
  emptyLabel: string;
}) {
  if (!value) {
    return (
      <span className="text-sm italic text-(--earist-body-text)">
        {emptyLabel}
      </span>
    );
  }
  return <span className="text-sm break-words text-(--earist-secondary)">{value}</span>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-(--earist-body-text)">
        {label}
      </span>
      <span className="text-right text-sm break-words text-(--earist-secondary)">
        {value || "—"}
      </span>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-(--earist-border-gray) p-3"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-28" />
          <Skeleton className="mt-3 h-3 w-48" />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function AdminCorVerificationPage() {
  const queryClient = useQueryClient();

  const pendingQuery = useQuery<PendingUpload[]>({
    queryKey: ["pendingCors"],
    queryFn: async () => {
      const data = await apiClientRequest("/cor/pending");
      return data || [];
    },
  });
  const pendingUploads = pendingQuery.data ?? [];

  const programsQuery = useQuery<{
    graduatePrograms: Program[];
    undergraduatePrograms: Program[];
  }>({
    queryKey: ["programs"],
    queryFn: async () =>
      (await apiClientRequest("/programs")) || { graduatePrograms: [] },
  });
  const graduatePrograms = programsQuery.data?.graduatePrograms ?? [];

  const [selectedCor, setSelectedCor] = useState<string | null>(null);
  const [form, setForm] = useState<ConfirmForm>(EMPTY_FORM);
  const [programSelection, setProgramSelection] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const corQueue = pendingUploads.map((u) => ({
    id: u.id,
    firstName: u.student.user.firstName,
    lastName: u.student.user.lastName,
    name: `${u.student.user.firstName} ${u.student.user.lastName}`.trim(),
    email: u.student.user.email,
    programId: u.student.programId,
    programName: u.student.program?.programName ?? null,
    uploadDate: new Date(u.createdAt).toLocaleDateString(),
    originalFilename: u.originalFilename,
    extractionStatus: String(u.extraction?.status ?? "PENDING"),
    extractionMethod: u.extraction?.method ?? null,
    extractorVersion: u.extraction?.extractorVersion ?? null,
    parserVersion: u.extraction?.parserVersion ?? null,
    processedAt: u.extraction?.processedAt ?? null,
    diagnostic: u.extraction?.diagnostic ?? null,
    suggestions: u.extraction?.suggestions ?? null,
  }));

  const selectedCorData = corQueue.find((c) => c.id === selectedCor);
  const suggestions = selectedCorData?.suggestions ?? null;

  // COR-AUTH-2 FIX1: preselect a uniquely, exactly matched existing Program by
  // DERIVING it during render — so it applies whenever the graduate Program list
  // finishes loading — while a manual Admin selection always takes precedence.
  // No effect (avoids cascading setState), no fuzzy matching, no Program
  // creation, and no other edited field is ever reset.
  const autoProgramId = resolveProgramId(suggestions?.program, graduatePrograms);
  const confirmedProgramId = programSelection ?? autoProgramId;

  function setField<K extends keyof ConfirmForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldError) setFieldError("");
  }

  function buildInitialForm(upload: (typeof corQueue)[number]): ConfirmForm {
    const s = upload.suggestions;
    return {
      surname: s?.studentName?.surname ?? "",
      firstName: s?.studentName?.firstName ?? "",
      middleNameOrInitial: s?.studentName?.middleNameOrInitial ?? "",
      email: s?.emailAddress ?? "",
      studentNumber: s?.studentNumber ?? "",
      registrationNumber: s?.registrationNumber ?? "",
    };
  }

  function handleSelectCor(id: string) {
    const upload = corQueue.find((c) => c.id === id);
    setSelectedCor(id);
    // Reinitialize every confirmation field for the newly selected COR so values
    // never leak between queued applicants.
    setForm(upload ? buildInitialForm(upload) : EMPTY_FORM);
    setProgramSelection(null);
    setFieldError("");
    setVerifyError("");
    setRejectError("");
    setShowVerifyConfirm(false);
    setShowRejectModal(false);
    setRejectReason("");
    // A new selection supersedes any prior success/failure banner.
    setFeedback(null);
  }

  const emailValid = EMAIL_PATTERN.test(form.email.trim());
  const canVerify = Boolean(
    form.surname.trim() &&
      form.firstName.trim() &&
      emailValid &&
      confirmedProgramId &&
      form.studentNumber.trim(),
  );

  const confirmedName = collapse(
    `${form.firstName} ${form.middleNameOrInitial} ${form.surname}`,
  );
  const selectedProgramName =
    graduatePrograms.find((p) => p.id === confirmedProgramId)?.programName ??
    "—";

  const applicantName = selectedCorData
    ? collapse(`${selectedCorData.firstName} ${selectedCorData.lastName}`)
    : "";
  const applicantProgramLabel =
    selectedCorData?.programName ?? "Program unavailable";

  const nameStatus: FieldStatus = (() => {
    const hasSuggestion = Boolean(
      suggestions?.studentName?.surname ||
        suggestions?.studentName?.firstName ||
        suggestions?.studentName?.middleNameOrInitial,
    );
    if (!hasSuggestion) return "NOT_EXTRACTED";
    if (!normalizeForCompare(applicantName)) return "NO_DATA";
    return normalizeForCompare(applicantName) ===
      normalizeForCompare(confirmedName)
      ? "MATCH"
      : "DIFFERENT";
  })();

  const emailStatus: FieldStatus = (() => {
    if (!collapse(suggestions?.emailAddress)) return "NOT_EXTRACTED";
    if (!normalizeForCompare(selectedCorData?.email)) return "NO_DATA";
    return normalizeForCompare(selectedCorData?.email) ===
      normalizeForCompare(form.email)
      ? "MATCH"
      : "DIFFERENT";
  })();

  const programStatus: FieldStatus = (() => {
    if (!collapse(suggestions?.program)) return "NOT_EXTRACTED";
    if (!selectedCorData?.programId) return "NO_DATA";
    return selectedCorData.programId === confirmedProgramId
      ? "MATCH"
      : "DIFFERENT";
  })();

  function openVerify() {
    if (!selectedCorData) return;
    if (!canVerify) {
      setFieldError(
        "Confirm the COR Surname, First Name, Email, Program, and Student Number before verifying.",
      );
      return;
    }
    setFieldError("");
    setVerifyError("");
    setShowVerifyConfirm(true);
  }

  function openReject() {
    setRejectError("");
    setShowRejectModal(true);
  }

  function closeReject() {
    setShowRejectModal(false);
    setRejectReason("");
    setRejectError("");
  }

  const verifyMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) =>
      // COR-AUTH-1 authority payload only — the confirmed Student Number,
      // Registration Number, name, email and existing Program id. No deferred
      // fields and no client-chosen verification method.
      apiClientRequest(`/cor/verify/${selectedCor}`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingCors"] });
      setShowVerifyConfirm(false);
      setSelectedCor(null);
      setForm(EMPTY_FORM);
      setProgramSelection(null);
      setFieldError("");
      setVerifyError("");
      setFeedback({
        type: "success",
        message: "COR verified. Student record created successfully.",
      });
    },
    onError: (error: Error) => {
      // Keep the Admin's typed corrections/selections intact; show the error
      // inside the confirmation dialog next to the action that failed.
      setVerifyError(error.message || "Verification failed. Please try again.");
    },
  });

  function handleConfirmVerify() {
    if (!selectedCorData) return;
    verifyMutation.mutate({
      studentNumber: form.studentNumber.trim(),
      registrationNumber: form.registrationNumber.trim(),
      surname: form.surname.trim(),
      firstName: form.firstName.trim(),
      middleNameOrInitial: form.middleNameOrInitial.trim(),
      email: form.email.trim(),
      programId: confirmedProgramId,
    });
  }

  const rejectMutation = useMutation({
    mutationFn: async ({
      uploadId,
      reason,
    }: {
      uploadId: string;
      reason: string;
    }) =>
      apiClientRequest(`/cor/reject/${uploadId}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingCors"] });
      setShowRejectModal(false);
      setRejectReason("");
      setRejectError("");
      setSelectedCor(null);
      setForm(EMPTY_FORM);
      setProgramSelection(null);
      setFeedback({
        type: "success",
        message: "COR rejected. The applicant may submit a new COR.",
      });
    },
    onError: (error: Error) => {
      setRejectError(error.message || "Rejection failed. Please try again.");
    },
  });

  function handleConfirmReject() {
    if (!selectedCor || !rejectReason.trim()) return;
    rejectMutation.mutate({
      uploadId: selectedCor,
      reason: rejectReason.trim(),
    });
  }

  function handleViewCor() {
    if (!selectedCorData) return;
    setSelectedDoc({
      url: `/api/documents/cor-upload/${selectedCorData.id}/file`,
      title: `${applicantName} — COR`,
    });
    setViewerOpen(true);
  }

  const studentNumberExtracted = Boolean(collapse(suggestions?.studentNumber));
  const registrationExtracted = Boolean(
    collapse(suggestions?.registrationNumber),
  );

  const isQueueLoading = pendingQuery.isLoading;
  const isQueueError = pendingQuery.isError;
  const isQueueFetching = pendingQuery.isFetching;

  return (
    <div className="space-y-6">
      <PageHeader
        title="COR Verification"
        description="Review uploaded Certificates of Registration and confirm the information that will become the student's official record in this system."
      />

      {feedback && (
        <div
          role="status"
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-4 py-3",
            feedback.type === "success"
              ? "border-(--earist-success)/30 bg-(--earist-surface-gray)"
              : "border-destructive/30 bg-destructive/5",
          )}
        >
          <p
            className={cn(
              "flex items-start gap-2 text-sm",
              feedback.type === "success"
                ? "text-(--earist-success)"
                : "text-destructive",
            )}
          >
            {feedback.type === "success" ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            )}
            {feedback.message}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss message"
            onClick={() => setFeedback(null)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left — pending COR review queue */}
        <section aria-label="Pending COR reviews" className="space-y-3 lg:col-span-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-(--earist-primary)">
              Pending COR Reviews
            </h2>
            {!isQueueLoading && !isQueueError && (
              <Badge
                variant="outline"
                className="font-medium text-(--earist-warning)"
              >
                {corQueue.length} pending
              </Badge>
            )}
          </div>

          {isQueueLoading ? (
            <QueueSkeleton />
          ) : isQueueError ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-(--earist-border-gray) p-6 text-center">
              <AlertCircle
                className="h-8 w-8 text-(--earist-secondary)"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  Unable to load pending COR reviews
                </p>
                <p className="text-sm text-(--earist-body-text)">
                  The review queue could not be loaded. Please try again.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pendingQuery.refetch()}
                disabled={isQueueFetching}
              >
                <RefreshCw
                  className={cn(
                    "mr-2 h-4 w-4",
                    isQueueFetching && "animate-spin",
                  )}
                  aria-hidden="true"
                />
                Retry
              </Button>
            </div>
          ) : corQueue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-(--earist-border-gray) p-6 text-center">
              <CheckCircle2
                className="h-8 w-8 text-(--earist-success)"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-(--earist-primary)">
                All COR reviews are complete.
              </p>
              <p className="text-sm text-(--earist-body-text)">
                There are no pending COR submissions at this time.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {corQueue.map((cor) => {
                const isSelected = selectedCor === cor.id;
                return (
                  <li key={cor.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectCor(cor.id)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none",
                        isSelected
                          ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                          : "border-(--earist-border-gray) bg-white hover:bg-(--earist-surface-gray)",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold break-words text-(--earist-primary)">
                            {cor.name}
                          </p>
                          <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                            {cor.programName ?? "Program unavailable"}
                          </p>
                        </div>
                        {isSelected ? (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-(--earist-primary)"
                            aria-label="Selected"
                          />
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs break-words text-(--earist-body-text)">
                        {cor.originalFilename}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-(--earist-body-text)">
                          Uploaded {cor.uploadDate}
                        </span>
                        <ExtractionStatusBadge
                          status={cor.extractionStatus}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right — selected COR review workspace */}
        <div className="lg:col-span-2">
          {selectedCorData ? (
            <div className="space-y-4">
              {/* A. Applicant / review summary */}
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-(--earist-primary)">
                    Review COR — {applicantName}
                  </h2>
                  <p className="mt-0.5 text-sm break-words text-(--earist-body-text)">
                    {selectedCorData.email}
                  </p>
                  <p className="text-sm break-words text-(--earist-body-text)">
                    {applicantProgramLabel}
                  </p>
                </div>
                <ExtractionStatusBadge status={selectedCorData.extractionStatus} />
              </div>

              {/* B. Uploaded COR */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Uploaded COR
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-(--earist-border-gray) px-3 py-2.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <FileText
                        className="h-5 w-5 shrink-0 text-(--earist-body-text)/60"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm break-words text-(--earist-secondary)">
                          {selectedCorData.originalFilename}
                        </p>
                        <p className="text-xs text-(--earist-body-text)">
                          Uploaded {selectedCorData.uploadDate}
                        </p>
                      </div>
                      <ExtractionStatusBadge
                        status={selectedCorData.extractionStatus}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewCor}
                    >
                      <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                      View COR
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-(--earist-body-text)">
                    Extraction is assistive only. Review the actual COR before
                    confirming.
                  </p>
                </CardContent>
              </Card>

              {/* C. Confirm COR Information */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Confirm COR Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-(--earist-body-text)">
                    The confirmed COR information will become the official
                    Student information in this system.
                  </p>

                  {/* Name */}
                  <div className="rounded-lg border border-(--earist-border-gray) p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        Name
                      </p>
                      <StatusBadge status={nameStatus} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-(--earist-body-text)">
                          Current Applicant Record
                        </p>
                        <MutedValue
                          value={applicantName}
                          emptyLabel="No existing data"
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-(--earist-body-text)">
                          Confirmed COR Information
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="surname" className="text-xs">
                              Surname
                            </Label>
                            <Input
                              id="surname"
                              value={form.surname}
                              onChange={(e) =>
                                setField("surname", e.target.value)
                              }
                              placeholder="Surname"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="firstName" className="text-xs">
                              First Name
                            </Label>
                            <Input
                              id="firstName"
                              value={form.firstName}
                              onChange={(e) =>
                                setField("firstName", e.target.value)
                              }
                              placeholder="First name"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label htmlFor="middleName" className="text-xs">
                              Middle Name / Initial
                            </Label>
                            <Input
                              id="middleName"
                              value={form.middleNameOrInitial}
                              onChange={(e) =>
                                setField(
                                  "middleNameOrInitial",
                                  e.target.value,
                                )
                              }
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="rounded-lg border border-(--earist-border-gray) p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        Email
                      </p>
                      <StatusBadge status={emailStatus} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-(--earist-body-text)">
                          Current Applicant Record
                        </p>
                        <MutedValue
                          value={selectedCorData.email}
                          emptyLabel="No existing data"
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-(--earist-body-text)">
                          Confirmed COR Information
                        </p>
                        <Input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(e) => setField("email", e.target.value)}
                          placeholder="name@example.com"
                          aria-invalid={form.email.length > 0 && !emailValid}
                        />
                        {form.email.length > 0 && !emailValid && (
                          <p className="mt-1 text-xs text-destructive">
                            Enter a valid email address.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Program */}
                  <div className="rounded-lg border border-(--earist-border-gray) p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        Program
                      </p>
                      <StatusBadge status={programStatus} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-(--earist-body-text)">
                          Current Applicant Record
                        </p>
                        <MutedValue
                          value={selectedCorData.programName ?? ""}
                          emptyLabel="No existing data"
                        />
                        <p className="mt-1 text-xs break-words text-(--earist-body-text)">
                          COR extracted:{" "}
                          {collapse(suggestions?.program) || "Not extracted"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-(--earist-body-text)">
                          Confirmed COR Information (existing Program)
                        </p>
                        <Select
                          value={confirmedProgramId || null}
                          onValueChange={(v) => setProgramSelection(v ?? "")}
                          disabled={
                            programsQuery.isLoading || programsQuery.isError
                          }
                        >
                          <SelectTrigger id="program" className="w-full">
                            <SelectValue
                              placeholder={
                                programsQuery.isLoading
                                  ? "Loading programs…"
                                  : programsQuery.isError
                                    ? "Programs unavailable"
                                    : "Select existing program…"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {graduatePrograms.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.programName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {programsQuery.isLoading && (
                          <p className="mt-1 text-xs text-(--earist-body-text)">
                            Loading programs…
                          </p>
                        )}
                        {programsQuery.isError && (
                          <p className="mt-1 text-xs text-destructive">
                            Could not load the Program list. Refresh and try
                            again.
                          </p>
                        )}
                        {!programsQuery.isLoading &&
                          !programsQuery.isError &&
                          !confirmedProgramId && (
                            <p className="mt-1 text-xs text-(--earist-body-text)">
                              Select the existing program that matches the COR.
                              Programs are never created here.
                            </p>
                          )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-(--earist-body-text)">
                    Differences from the current Applicant record are expected
                    and do not automatically mean the COR is invalid. Your
                    confirmation is authoritative.
                  </p>
                </CardContent>
              </Card>

              {/* D. Student Record Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Student Record Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="studentNumber" className="text-xs">
                      Student Number{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="studentNumber"
                      value={form.studentNumber}
                      onChange={(e) =>
                        setField("studentNumber", e.target.value)
                      }
                      placeholder="e.g. 2026-GS-00123"
                    />
                    <p className="text-xs text-(--earist-body-text)">
                      {studentNumberExtracted
                        ? "Suggested from the COR. Confirm or correct before verification."
                        : "Enter the confirmed Student Number."}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="registrationNumber" className="text-xs">
                      Registration Number
                    </Label>
                    <Input
                      id="registrationNumber"
                      value={form.registrationNumber}
                      onChange={(e) =>
                        setField("registrationNumber", e.target.value)
                      }
                      placeholder="Optional"
                    />
                    <p className="text-xs text-(--earist-body-text)">
                      {registrationExtracted
                        ? "Suggested from the COR. Confirm or correct before verification."
                        : "Optional."}
                    </p>
                  </div>
                  <p className="text-xs text-(--earist-body-text) sm:col-span-2">
                    These identify the student&apos;s record in this system. The
                    existing account and password are unchanged.
                  </p>
                </CardContent>
              </Card>

              {/* E. Extraction Details (secondary / collapsed) */}
              <details className="rounded-lg border border-(--earist-border-gray) bg-white px-4 py-3 text-sm">
                <summary className="cursor-pointer text-xs font-semibold text-(--earist-secondary)">
                  Extraction Details
                </summary>
                <div className="mt-2 space-y-1 text-xs text-(--earist-body-text)">
                  <p>
                    Status:{" "}
                    {EXTRACTION_LABEL[selectedCorData.extractionStatus] ??
                      selectedCorData.extractionStatus}
                  </p>
                  <p>Method: {selectedCorData.extractionMethod ?? "—"}</p>
                  <p>Parser version: {selectedCorData.parserVersion ?? "—"}</p>
                  <p>
                    Extractor version: {selectedCorData.extractorVersion ?? "—"}
                  </p>
                  <p>
                    Processed:{" "}
                    {selectedCorData.processedAt
                      ? new Date(selectedCorData.processedAt).toLocaleString()
                      : "—"}
                  </p>
                  {selectedCorData.diagnostic && (
                    <p>Diagnostic: {selectedCorData.diagnostic}</p>
                  )}
                  <p className="pt-1">
                    Extraction metadata is support context only and is not
                    verification authority.
                  </p>
                </div>
              </details>

              {/* F. Review Actions */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={openReject}
                  className="text-destructive hover:bg-destructive/10 sm:w-44"
                >
                  <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reject COR
                </Button>
                <Button
                  onClick={openVerify}
                  className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                >
                  <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
                  Verify COR &amp; Create Student Record
                </Button>
              </div>
              {fieldError && (
                <p className="text-sm text-destructive" role="alert">
                  {fieldError}
                </p>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <GraduationCap
                    className="mb-3 h-8 w-8 text-(--earist-body-text)/40"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    Select a COR to review
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-(--earist-body-text)">
                    Choose an applicant from Pending COR Reviews to inspect the
                    uploaded COR and confirm the information for their Student
                    record.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Verification confirmation */}
      <Dialog
        open={showVerifyConfirm}
        onOpenChange={(open) => {
          if (!open && !verifyMutation.isPending) {
            setShowVerifyConfirm(false);
            setVerifyError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Verify COR and create this Student record?
            </DialogTitle>
            <DialogDescription>
              The confirmed COR details will become the student&apos;s official
              information in this system. The existing account will be retained.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-sm">
            <SummaryRow label="Name" value={confirmedName} />
            <SummaryRow label="Email" value={form.email.trim()} />
            <SummaryRow label="Program" value={selectedProgramName} />
            <SummaryRow
              label="Student Number"
              value={form.studentNumber.trim()}
            />
            {form.registrationNumber.trim() && (
              <SummaryRow
                label="Registration Number"
                value={form.registrationNumber.trim()}
              />
            )}
          </div>
          <p className="text-xs text-(--earist-body-text)">
            The existing account and password are retained. No new password is
            generated or displayed. Differences from the provisional Applicant
            information do not automatically mean the COR is invalid.
          </p>
          {verifyError && (
            <p className="text-sm text-destructive" role="alert">
              {verifyError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVerifyConfirm(false);
                setVerifyError("");
              }}
              disabled={verifyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmVerify}
              disabled={verifyMutation.isPending}
              className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
            >
              {verifyMutation.isPending ? "Verifying…" : "Confirm Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection confirmation */}
      <Dialog
        open={showRejectModal}
        onOpenChange={(open) => {
          if (!open && !rejectMutation.isPending) closeReject();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this COR?</DialogTitle>
            <DialogDescription>
              The current COR submission will be rejected and the applicant may
              submit a new COR.
            </DialogDescription>
          </DialogHeader>
          {selectedCorData && (
            <div className="rounded-lg bg-(--earist-surface-gray) p-3">
              <p className="text-sm font-semibold text-(--earist-primary)">
                {applicantName}
              </p>
              <p className="text-xs text-(--earist-body-text)">
                {applicantProgramLabel}
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="reject-reason" className="mb-1 block text-xs">
              Reason for Rejection{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError("");
              }}
              placeholder="Enter reason for rejection..."
              rows={3}
            />
          </div>
          {rejectError && (
            <p className="text-sm text-destructive" role="alert">
              {rejectError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeReject}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={handleConfirmReject}
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject COR"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedDoc && (
        <DocumentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          fetchUrl={selectedDoc.url}
          title={selectedDoc.title}
        />
      )}
    </div>
  );
}
