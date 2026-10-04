"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  FileText,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  GraduationCap,
  X,
} from "lucide-react";
import { PendingCorUpload as PendingUpload, Program } from "@/types";
import { DocumentViewer } from "@/components/ui/document-viewer";

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

/** Resolves an extracted COR Program string to a unique existing Program id. */
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

function StatusBadge({ status }: { status: FieldStatus }) {
  switch (status) {
    case "MATCH":
      return <Badge className="bg-green-100 text-green-700">Match</Badge>;
    case "DIFFERENT":
      return <Badge className="bg-amber-100 text-amber-700">Different</Badge>;
    case "NO_DATA":
      return (
        <Badge className="bg-slate-100 text-slate-700">No existing data</Badge>
      );
    default:
      return (
        <Badge className="bg-slate-100 text-slate-600">Not extracted</Badge>
      );
  }
}

function MutedValue({ value, emptyLabel }: { value: string; emptyLabel: string }) {
  if (!value) {
    return (
      <span className="text-sm italic text-(--earist-body-text)">{emptyLabel}</span>
    );
  }
  return <span className="text-sm text-(--earist-secondary)">{value}</span>;
}

export default function AdminCORValidationPage() {
  const queryClient = useQueryClient();

  const { data: pendingUploads = [], isLoading: loading } = useQuery<
    PendingUpload[]
  >({
    queryKey: ["pendingCors"],
    queryFn: async () => {
      const data = await apiClientRequest("/cor/pending");
      return data || [];
    },
  });

  const {
    data: programsData,
    isLoading: programsLoading,
    isError: programsError,
  } = useQuery<{
    graduatePrograms: Program[];
    undergraduatePrograms: Program[];
  }>({
    queryKey: ["programs"],
    queryFn: async () =>
      (await apiClientRequest("/programs")) || { graduatePrograms: [] },
  });
  const graduatePrograms = programsData?.graduatePrograms ?? [];

  const [selectedCor, setSelectedCor] = useState<string | null>(null);
  const [form, setForm] = useState<ConfirmForm>(EMPTY_FORM);
  const [programSelection, setProgramSelection] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; title: string } | null>(null);

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
    if (formError) setFormError("");
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

  function closeVerify() {
    setShowVerifyConfirm(false);
  }

  function handleSelectCor(id: string) {
    const upload = corQueue.find((c) => c.id === id);
    setSelectedCor(id);
    // COR-AUTH-2: reinitialize every confirmation field for the newly selected
    // COR so values never leak between queued applicants.
    setForm(upload ? buildInitialForm(upload) : EMPTY_FORM);
    setProgramSelection(null);
    setFormError("");
    setShowVerifyConfirm(false);
    setShowRejectModal(false);
    setRejectReason("");
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
    graduatePrograms.find((p) => p.id === confirmedProgramId)?.programName ?? "—";

  const applicantName = selectedCorData
    ? collapse(`${selectedCorData.firstName} ${selectedCorData.lastName}`)
    : "";

  const nameStatus: FieldStatus = (() => {
    const hasSuggestion = Boolean(
      suggestions?.studentName?.surname ||
        suggestions?.studentName?.firstName ||
        suggestions?.studentName?.middleNameOrInitial,
    );
    if (!hasSuggestion) return "NOT_EXTRACTED";
    if (!normalizeForCompare(applicantName)) return "NO_DATA";
    return normalizeForCompare(applicantName) === normalizeForCompare(confirmedName)
      ? "MATCH"
      : "DIFFERENT";
  })();

  const emailStatus: FieldStatus = (() => {
    if (!collapse(suggestions?.emailAddress)) return "NOT_EXTRACTED";
    if (!normalizeForCompare(selectedCorData?.email)) return "NO_DATA";
    return normalizeForCompare(selectedCorData?.email) === normalizeForCompare(form.email)
      ? "MATCH"
      : "DIFFERENT";
  })();

  const programStatus: FieldStatus = (() => {
    if (!collapse(suggestions?.program)) return "NOT_EXTRACTED";
    if (!selectedCorData?.programId) return "NO_DATA";
    return selectedCorData.programId === confirmedProgramId ? "MATCH" : "DIFFERENT";
  })();

  function openVerify() {
    if (!selectedCorData) return;
    if (!canVerify) {
      setFormError(
        "Confirm the COR Surname, First Name, Email, Program, and Student Number before verifying.",
      );
      return;
    }
    setFormError("");
    setShowVerifyConfirm(true);
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
      setFormError("");
      alert("COR verified. The applicant has been promoted to Student.");
    },
    onError: (error: Error) => {
      // Keep the Admin's typed corrections/selections intact.
      setFormError(error.message || "Verification failed.");
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
      setSelectedCor(null);
      setForm(EMPTY_FORM);
      alert("COR rejected. The applicant may resubmit a new COR.");
    },
    onError: (error: Error) => {
      alert("Rejection failed: " + error.message);
    },
  });

  const getExtractionBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Extraction complete
          </Badge>
        );
      case "PROCESSING":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <Clock className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case "MANUAL_REQUIRED":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Manual review
          </Badge>
        );
      case "FAILED":
        return (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="mr-1 h-3 w-3" />
            Extraction failed
          </Badge>
        );
      default:
        return <Badge className="bg-gray-100 text-gray-600">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          COR Validation
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review the actual COR and confirm the values that will become the
          Student&apos;s system record.
        </p>
        <p className="mt-1 text-xs text-(--earist-body-text)">
          Applicant data is provisional. Confirmed COR values replace Name,
          Email, and Program after verification. Differences do not
          automatically reject the COR.
        </p>
      </div>

      <div className="flex gap-2">
        <Badge className="bg-amber-100 text-amber-700">
          {corQueue.length} Pending
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* COR Pending Queue */}
        <div className="space-y-2 lg:col-span-1">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-(--earist-primary)" />
            </div>
          ) : corQueue.length === 0 ? (
            <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-8 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
              <p className="text-sm text-(--earist-body-text)">
                All caught up! No pending CORs.
              </p>
            </div>
          ) : (
            corQueue.map((cor) => (
              <button
                key={cor.id}
                onClick={() => handleSelectCor(cor.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selectedCor === cor.id
                    ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                    : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate pr-2">
                    <p className="truncate text-sm font-semibold text-(--earist-primary)">
                      {cor.name}
                    </p>
                    <p className="truncate text-xs text-(--earist-body-text)">
                      {cor.programName ?? cor.programId}
                    </p>
                  </div>
                  {getExtractionBadge(cor.extractionStatus)}
                </div>
                <p className="mt-2 truncate text-xs text-(--earist-body-text)">
                  File: {cor.originalFilename}
                </p>
                <p className="mt-1 text-[10px] text-(--earist-body-text)">
                  Uploaded: {cor.uploadDate}
                </p>
              </button>
            ))
          )}
        </div>

        {/* COR Detail View */}
        {selectedCorData ? (
          <div className="space-y-4 lg:col-span-2">
            {/* Applicant summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-(--earist-primary)">
                  COR Verification — {applicantName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedCorData.email} ·{" "}
                  {selectedCorData.programName ?? selectedCorData.programId}
                </p>
              </div>
              {getExtractionBadge(selectedCorData.extractionStatus)}
            </div>

            {/* 1. Uploaded Document */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  1. Uploaded Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-(--earist-border-gray) px-3 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <FileText className="h-5 w-5 shrink-0 text-(--earist-body-text)/60" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-(--earist-secondary)">
                        {selectedCorData.originalFilename}
                      </p>
                      <p className="text-[10px] text-(--earist-body-text)">
                        Uploaded {selectedCorData.uploadDate}
                      </p>
                    </div>
                    {getExtractionBadge(selectedCorData.extractionStatus)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDoc({
                        url: `/api/documents/cor-upload/${selectedCorData.id}/file`,
                        title: `${applicantName} — COR`,
                      });
                      setViewerOpen(true);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" /> View COR
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 2. Review & Confirm COR Data */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  2. Review &amp; Confirm COR Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Name */}
                <div className="rounded-lg border border-(--earist-border-gray) p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-(--earist-primary)">Name</p>
                    <StatusBadge status={nameStatus} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
                        Current Applicant
                      </p>
                      <MutedValue value={applicantName} emptyLabel="No existing data" />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
                        Confirmed COR
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="surname" className="text-xs">Surname</Label>
                          <Input
                            id="surname"
                            value={form.surname}
                            onChange={(e) => setField("surname", e.target.value)}
                            placeholder="Surname"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="firstName" className="text-xs">First Name</Label>
                          <Input
                            id="firstName"
                            value={form.firstName}
                            onChange={(e) => setField("firstName", e.target.value)}
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
                              setField("middleNameOrInitial", e.target.value)
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
                    <p className="text-sm font-semibold text-(--earist-primary)">Email</p>
                    <StatusBadge status={emailStatus} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
                        Current Applicant
                      </p>
                      <MutedValue
                        value={selectedCorData.email}
                        emptyLabel="No existing data"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
                        Confirmed COR
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
                        <p className="mt-1 text-[10px] text-red-600">
                          Enter a valid email address.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Program */}
                <div className="rounded-lg border border-(--earist-border-gray) p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-(--earist-primary)">Program</p>
                    <StatusBadge status={programStatus} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
                        Current Applicant
                      </p>
                      <MutedValue
                        value={selectedCorData.programName ?? ""}
                        emptyLabel="No existing data"
                      />
                      <p className="mt-1 text-[11px] text-(--earist-body-text)">
                        COR extracted:{" "}
                        {collapse(suggestions?.program) || "Not extracted"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
                        Confirmed COR (existing Program)
                      </p>
                      <Select
                        value={confirmedProgramId || null}
                        onValueChange={(v) => setProgramSelection(v ?? "")}
                        disabled={programsLoading || programsError}
                      >
                        <SelectTrigger id="program" className="w-full">
                          <SelectValue
                            placeholder={
                              programsLoading
                                ? "Loading programs…"
                                : programsError
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
                      {programsLoading && (
                        <p className="mt-1 text-[10px] text-(--earist-body-text)">
                          Loading programs…
                        </p>
                      )}
                      {programsError && (
                        <p className="mt-1 text-[10px] text-red-600">
                          Could not load the Program list. Refresh and try again.
                        </p>
                      )}
                      {!programsLoading && !programsError && !confirmedProgramId && (
                        <p className="mt-1 text-[10px] text-(--earist-body-text)">
                          Select the existing program that matches the COR.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-(--earist-body-text)">
                  Confirmed COR Name, Email, and Program will replace the
                  provisional Applicant values when verification is completed.
                </p>
              </CardContent>
            </Card>

            {/* 3. Confirm Student Credentials */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  3. Confirm Student Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="studentNumber" className="text-xs">
                    Student Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="studentNumber"
                    value={form.studentNumber}
                    onChange={(e) => setField("studentNumber", e.target.value)}
                    placeholder="e.g. 2026-GS-00123"
                  />
                  <p className="text-[10px] text-(--earist-body-text)">
                    {collapse(suggestions?.studentNumber)
                      ? "Proposed from extraction — edit if needed."
                      : "No extracted value; enter the confirmed Student Number."}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="registrationNumber" className="text-xs">
                    Registration Number
                  </Label>
                  <Input
                    id="registrationNumber"
                    value={form.registrationNumber}
                    onChange={(e) => setField("registrationNumber", e.target.value)}
                    placeholder="Optional"
                  />
                  <p className="text-[10px] text-(--earist-body-text)">
                    {collapse(suggestions?.registrationNumber)
                      ? "Proposed from extraction — edit if needed."
                      : "No extracted value; optional."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 4. Extraction Details */}
            <details className="rounded-lg border border-(--earist-border-gray) bg-white px-4 py-3 text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-(--earist-secondary)">
                4. Extraction details
              </summary>
              <div className="mt-2 space-y-1 text-xs text-(--earist-body-text)">
                <p>Status: {selectedCorData.extractionStatus}</p>
                <p>Method: {selectedCorData.extractionMethod ?? "—"}</p>
                <p>Parser version: {selectedCorData.parserVersion ?? "—"}</p>
                <p>Extractor version: {selectedCorData.extractorVersion ?? "—"}</p>
                <p>
                  Processed:{" "}
                  {selectedCorData.processedAt
                    ? new Date(selectedCorData.processedAt).toLocaleString()
                    : "—"}
                </p>
                {selectedCorData.diagnostic && (
                  <p>Diagnostic: {selectedCorData.diagnostic}</p>
                )}
              </div>
            </details>

            {/* 5. Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(true)}
                className="text-red-600 hover:bg-red-50 sm:w-40"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject COR
              </Button>
              <Button
                onClick={openVerify}
                disabled={!canVerify}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Verify &amp; Promote to Student
              </Button>
            </div>
            {formError && (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <GraduationCap className="mb-3 h-10 w-10 text-(--earist-body-text)/40" />
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select a COR to Review
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Choose an applicant from the queue to open the actual COR and
                    confirm the values that will become their Student record.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Final verification confirmation dialog */}
      <Dialog open={showVerifyConfirm} onOpenChange={setShowVerifyConfirm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Verify this COR and promote the Applicant?</DialogTitle>
            <DialogDescription>
              These confirmed COR values will become the Student&apos;s system
              profile. The same account is retained and the existing password is
              kept — no password is generated or displayed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-sm">
            <SummaryRow label="Name" value={confirmedName} />
            <SummaryRow label="Email" value={form.email.trim()} />
            <SummaryRow label="Program" value={selectedProgramName} />
            <SummaryRow label="Student Number" value={form.studentNumber.trim()} />
            {form.registrationNumber.trim() && (
              <SummaryRow
                label="Registration Number"
                value={form.registrationNumber.trim()}
              />
            )}
          </div>
          <p className="text-xs text-(--earist-body-text)">
            The COR will be marked verified and the Applicant will become a
            Student. Differences from the provisional Applicant data are expected
            and are not errors.
          </p>
          {formError && (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeVerify}
              disabled={verifyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmVerify}
              disabled={verifyMutation.isPending || !canVerify}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {verifyMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirm Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      {showRejectModal && selectedCorData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">Reject COR</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-semibold text-red-700">
                    Reject COR Upload
                  </p>
                </div>
                <p className="mt-2 text-xs text-red-600">
                  The applicant will be notified and can resubmit their COR.
                </p>
              </div>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {applicantName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedCorData.programName ?? selectedCorData.programId}
                </p>
              </div>
              <div>
                <Label className="mb-1 block text-xs">
                  Reason for Rejection <span className="text-red-500">*</span>
                </Label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() => {
                  if (!selectedCor || !rejectReason.trim()) return;
                  rejectMutation.mutate({
                    uploadId: selectedCor,
                    reason: rejectReason.trim(),
                  });
                }}
                className={`flex-1 ${
                  rejectReason.trim()
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {rejectMutation.isPending ? "Rejecting..." : "Reject COR"}
              </Button>
            </div>
          </div>
        </div>
      )}

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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-(--earist-body-text)">{label}</span>
      <span className="text-right text-sm text-(--earist-secondary)">
        {value || "—"}
      </span>
    </div>
  );
}
