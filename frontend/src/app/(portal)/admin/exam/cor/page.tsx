"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Upload,
  X,
  GraduationCap,
  AlertTriangle,
  Shield,
  Loader2,
} from "lucide-react";
import { PendingCorUpload as PendingUpload } from "@/types";
import { DocumentViewer } from "@/components/ui/document-viewer";

function normalizeForDisplay(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function CompareValue({
  value,
  emptyLabel,
}: {
  value: string | null | undefined;
  emptyLabel: string;
}) {
  const text = normalizeForDisplay(value);
  if (!text) {
    return (
      <span className="text-sm italic text-(--earist-body-text)">
        {emptyLabel}
      </span>
    );
  }
  return <span className="text-sm text-(--earist-secondary)">{text}</span>;
}

function ComparisonRow({
  label,
  baseline,
  cor,
}: {
  label: string;
  baseline: string | null;
  cor: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-(--earist-border-gray) py-3 sm:grid-cols-[7rem_1fr_1fr] sm:gap-4">
      <p className="text-xs font-semibold text-(--earist-body-text)">{label}</p>
      <div>
        <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
          Applicant / System
        </p>
        <CompareValue value={baseline} emptyLabel="Not available" />
      </div>
      <div>
        <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
          COR suggestion
        </p>
        <CompareValue value={cor} emptyLabel="Not extracted" />
      </div>
    </div>
  );
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

  const [selectedCor, setSelectedCor] = useState<string | null>(null);
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; title: string } | null>(null);

  /**
   * COR-4: editable Admin confirmation values only. Initialized from the
   * selected COR's extraction suggestions when the verification form opens, so
   * values never leak between applicants and are never auto-submitted.
   */
  const [formData, setFormData] = useState({
    studentNumber: "",
    registrationNumber: "",
  });

  const corQueue = pendingUploads.map((u) => ({
    id: u.id,
    firstName: u.student.user.firstName,
    lastName: u.student.user.lastName,
    name: `${u.student.user.firstName} ${u.student.user.lastName}`,
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

  function closeVerify() {
    setShowVerifyConfirm(false);
    setFormData({ studentNumber: "", registrationNumber: "" });
  }

  function handleSelectCor(id: string) {
    setSelectedCor(id);
    setShowVerifyConfirm(false);
    setShowRejectModal(false);
    setRejectReason("");
    setFormData({ studentNumber: "", registrationNumber: "" });
  }

  function openVerify() {
    if (!selectedCorData) return;
    const suggestions = selectedCorData.suggestions;
    // Initialize strictly from the selected COR; never reuse previous values.
    setFormData({
      studentNumber: suggestions?.studentNumber ?? "",
      registrationNumber: suggestions?.registrationNumber ?? "",
    });
    setShowVerifyConfirm(true);
  }

  const verifyMutation = useMutation({
    mutationFn: async (payload: {
      uploadId: string;
      studentNumber: string;
      registrationNumber: string;
    }) => {
      // COR-4: only the Admin-confirmed v1 values are sent. Academic Year,
      // Semester, term/year inferences, DOB, password and extracted identity
      // fields are intentionally omitted.
      return await apiClientRequest(`/cor/verify/${payload.uploadId}`, {
        method: "POST",
        body: JSON.stringify({
          studentNumber: payload.studentNumber,
          registrationNumber: payload.registrationNumber,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingCors"] });
      closeVerify();
      setSelectedCor(null);
      alert("COR verified. The applicant has been promoted to Student.");
    },
    onError: (error: Error) => {
      // Keep the form and its typed corrections intact on failure.
      alert("Verification failed: " + error.message);
    },
  });

  function handleVerify() {
    if (!selectedCorData) return;
    verifyMutation.mutate({
      uploadId: selectedCorData.id,
      studentNumber: formData.studentNumber.trim(),
      registrationNumber: formData.registrationNumber.trim(),
    });
  }

  const rejectMutation = useMutation({
    mutationFn: async ({
      uploadId,
      reason,
    }: {
      uploadId: string;
      reason: string;
    }) => {
      return await apiClientRequest(`/cor/reject/${uploadId}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingCors"] });
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedCor(null);
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
            Text ready
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
          Review the uploaded Certificate of Registration, compare it with the
          applicant record, and verify enrollment.
        </p>
      </div>

      {/* Summary */}
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
                <div className="flex items-center justify-between">
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
            {/* COR Preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Uploaded COR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-40 items-center justify-center rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray)">
                  <div className="text-center">
                    <FileText className="mx-auto mb-2 h-10 w-10 text-(--earist-body-text)/40" />
                    <p className="text-sm text-(--earist-body-text)">
                      {selectedCorData.originalFilename}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {selectedCorData.name}
                    </p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => {
                        setSelectedDoc({
                          url: `/api/documents/cor-upload/${selectedCorData.id}/file`,
                          title: `${selectedCorData.name} — COR`,
                        });
                        setViewerOpen(true);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" /> View Document
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Applicant vs COR extraction */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Applicant vs COR extraction
                  </CardTitle>
                  {getExtractionBadge(selectedCorData.extractionStatus)}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-1 text-xs text-(--earist-body-text)">
                  The Applicant / System column is existing account data. The COR
                  suggestion column is assistive extraction output and is never
                  authoritative.
                </p>
                <ComparisonRow
                  label="Name"
                  baseline={selectedCorData.name}
                  cor={selectedCorData.suggestions?.studentName?.raw ?? null}
                />
                <ComparisonRow
                  label="Program"
                  baseline={selectedCorData.programName}
                  cor={selectedCorData.suggestions?.program ?? null}
                />
                <ComparisonRow
                  label="College"
                  baseline={null}
                  cor={selectedCorData.suggestions?.college ?? null}
                />
                <ComparisonRow
                  label="Email"
                  baseline={selectedCorData.email}
                  cor={selectedCorData.suggestions?.emailAddress ?? null}
                />

                <div className="border-t border-(--earist-border-gray) pt-3 text-xs text-(--earist-body-text)">
                  <p>
                    Student Number and Registration Number are proposed in the
                    verification form and become authoritative only after you
                    confirm.
                  </p>
                  {(selectedCorData.extractionMethod ||
                    selectedCorData.processedAt ||
                    selectedCorData.parserVersion) && (
                    <p className="mt-1">
                      Extraction: {selectedCorData.extractionMethod ?? "—"}
                      {selectedCorData.parserVersion
                        ? ` · parser ${selectedCorData.parserVersion}`
                        : ""}
                      {selectedCorData.extractorVersion
                        ? ` · extractor ${selectedCorData.extractorVersion}`
                        : ""}
                      {selectedCorData.processedAt
                        ? ` · ${new Date(selectedCorData.processedAt).toLocaleString()}`
                        : ""}
                    </p>
                  )}
                  {selectedCorData.diagnostic && (
                    <p className="mt-1">{selectedCorData.diagnostic}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={openVerify}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Verify &amp; Promote to Student
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(true)}
                className="flex-1 text-red-600 hover:bg-red-50"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject COR
              </Button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <Upload className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select a COR to Review
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Click an applicant from the queue to view their uploaded COR
                    and compare it with the applicant record.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Verify Confirmation Modal */}
      {showVerifyConfirm && selectedCorData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Verify COR &amp; Promote
              </h3>
              <button
                onClick={closeVerify}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">
                    Admin verification
                  </p>
                </div>
                <p className="mt-2 text-xs text-green-600">
                  You are the verification authority. Review the actual COR
                  document, then confirm the values below. Extracted values are
                  proposals until you confirm them.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                    Student Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.studentNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        studentNumber: e.target.value,
                      })
                    }
                    placeholder="e.g. 2026-GS-00123"
                    className="w-full rounded-md border border-(--earist-border-gray) px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[10px] text-(--earist-body-text)">
                    {selectedCorData.suggestions?.studentNumber
                      ? "Proposed from COR extraction — edit if needed."
                      : "No extracted value; enter the confirmed Student Number."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={formData.registrationNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        registrationNumber: e.target.value,
                      })
                    }
                    placeholder="Enter registration number if available"
                    className="w-full rounded-md border border-(--earist-border-gray) px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[10px] text-(--earist-body-text)">
                    {selectedCorData.suggestions?.registrationNumber
                      ? "Proposed from COR extraction — edit if needed."
                      : "No extracted value; optional."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-700">
                    Account credentials
                  </p>
                </div>
                <p className="mt-1 text-xs text-blue-600">
                  This form does not generate, reset, or display a password.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={closeVerify}
                className="flex-1"
                disabled={verifyMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerify}
                disabled={
                  verifyMutation.isPending || !formData.studentNumber.trim()
                }
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Confirm Verification
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedCorData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Reject COR
              </h3>
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
                  {selectedCorData.name}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedCorData.programName ?? selectedCorData.programId}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
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
