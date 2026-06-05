"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "lucide-react";

export default function AdminCORValidationPage() {
  const [selectedCor, setSelectedCor] = useState<number | null>(null);
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const corQueue = [
    {
      id: 1,
      name: "Maria Santos",
      email: "maria.santos@gmail.com",
      pinnacleId: "PIN-2026-002",
      studentNumber: "2026-GS-00456",
      program: "MSCS",
      uploadDate: "June 1, 2026",
      ocrStatus: "completed" as "pending" | "processing" | "completed",
      extractedData: {
        registrationNumber: "2026-1-00456",
        academicYear: "2025-2026",
        semester: "Second Semester",
        program: "Master of Science in Computer Science",
        yearLevel: "1st Year",
        studentNumber: "2026-GS-00456",
        totalUnits: 12,
        tuitionFee: "₱18,500.00",
        miscellaneousFee: "₱3,200.00",
        totalAssessment: "₱21,700.00",
      },
    },
    {
      id: 2,
      name: "Roberto Lim",
      email: "roberto.lim@gmail.com",
      pinnacleId: "PIN-2026-007",
      studentNumber: "2026-GS-00461",
      program: "DIT",
      uploadDate: "June 2, 2026",
      ocrStatus: "completed" as "pending" | "processing" | "completed",
      extractedData: {
        registrationNumber: "2026-1-00461",
        academicYear: "2025-2026",
        semester: "Second Semester",
        program: "Doctor of Information Technology",
        yearLevel: "1st Year",
        studentNumber: "2026-GS-00461",
        totalUnits: 9,
        tuitionFee: "₱22,000.00",
        miscellaneousFee: "₱3,500.00",
        totalAssessment: "₱25,500.00",
      },
    },
    {
      id: 3,
      name: "Juan Dela Cruz",
      email: "juan.delacruz@gmail.com",
      pinnacleId: "PIN-2026-001",
      studentNumber: "2026-GS-00455",
      program: "MSCS",
      uploadDate: "June 3, 2026",
      ocrStatus: "processing" as "pending" | "processing" | "completed",
      extractedData: null,
    },
  ];

  const selectedCorData = corQueue.find((c) => c.id === selectedCor);

  const getOcrBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-gray-100 text-gray-500">Pending</Badge>;
      case "processing":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          COR Validation
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Verify uploaded Certificates of Registration and promote applicants to
          students
        </p>
      </div>

      {/* Summary */}
      <div className="flex gap-2">
        <Badge className="bg-amber-100 text-amber-700">
          {corQueue.length} Pending
        </Badge>
        <Badge className="bg-green-100 text-green-700">
          {corQueue.filter((c) => c.ocrStatus === "completed").length} Ready to
          Verify
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* COR Pending Queue */}
        <div className="space-y-2 lg:col-span-1">
          {corQueue.map((cor) => (
            <button
              key={cor.id}
              onClick={() => setSelectedCor(cor.id)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                selectedCor === cor.id
                  ? "border-[var(--earist-primary)] bg-[var(--earist-surface-light-red)]"
                  : "border-[var(--earist-border-gray)] hover:bg-[var(--earist-surface-gray)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    {cor.name}
                  </p>
                  <p className="text-xs text-[var(--earist-body-text)]">
                    {cor.studentNumber} &middot; {cor.program}
                  </p>
                </div>
                {getOcrBadge(cor.ocrStatus)}
              </div>
              <p className="mt-2 text-xs text-[var(--earist-body-text)]">
                Uploaded: {cor.uploadDate}
              </p>
            </button>
          ))}
        </div>

        {/* COR Detail View */}
        {selectedCorData ? (
          <div className="space-y-4 lg:col-span-2">
            {/* COR Preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                  Uploaded COR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-48 items-center justify-center rounded-lg border border-[var(--earist-border-gray)] bg-[var(--earist-surface-gray)]">
                  <div className="text-center">
                    <FileText className="mx-auto mb-2 h-10 w-10 text-[var(--earist-body-text)]/40" />
                    <p className="text-sm text-[var(--earist-body-text)]">
                      Certificate of Registration
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      {selectedCorData.name} — {selectedCorData.studentNumber}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Extracted Data Fields */}
            {selectedCorData.extractedData && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                      Extracted Data (OCR)
                    </CardTitle>
                    {getOcrBadge(selectedCorData.ocrStatus)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: "Student Number",
                        value: selectedCorData.extractedData.studentNumber,
                      },
                      {
                        label: "Registration Number",
                        value: selectedCorData.extractedData.registrationNumber,
                      },
                      {
                        label: "Program",
                        value: selectedCorData.extractedData.program,
                      },
                      {
                        label: "Year Level",
                        value: selectedCorData.extractedData.yearLevel,
                      },
                      {
                        label: "Academic Year",
                        value: selectedCorData.extractedData.academicYear,
                      },
                      {
                        label: "Semester",
                        value: selectedCorData.extractedData.semester,
                      },
                      {
                        label: "Total Units",
                        value: selectedCorData.extractedData.totalUnits,
                      },
                      {
                        label: "Tuition Fee",
                        value: selectedCorData.extractedData.tuitionFee,
                      },
                      {
                        label: "Miscellaneous Fee",
                        value: selectedCorData.extractedData.miscellaneousFee,
                      },
                      {
                        label: "Total Assessment",
                        value: selectedCorData.extractedData.totalAssessment,
                      },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className="rounded-lg bg-[var(--earist-surface-gray)] p-3"
                      >
                        <p className="text-[11px] text-[var(--earist-body-text)]">
                          {field.label}
                        </p>
                        <p className="text-sm font-medium text-[var(--earist-primary)]">
                          {field.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => setShowVerifyConfirm(true)}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Verify & Promote to Student
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
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--earist-surface-gray)]">
                    <Upload className="h-8 w-8 text-[var(--earist-body-text)]/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">
                    Select a COR to Review
                  </h3>
                  <p className="text-sm text-[var(--earist-body-text)]">
                    Click an applicant from the queue to view their uploaded COR
                    and extracted data.
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
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Verify COR & Promote
              </h3>
              <button
                onClick={() => setShowVerifyConfirm(false)}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">
                    Promote to Student
                  </p>
                </div>
                <p className="mt-2 text-xs text-green-600">
                  This will verify the COR and grant full Student portal access.
                </p>
              </div>
              <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                <p className="text-sm font-semibold text-[var(--earist-primary)]">
                  {selectedCorData.name}
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  {selectedCorData.studentNumber} &middot;{" "}
                  {selectedCorData.program}
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-700">
                    Credential Dispatch
                  </p>
                </div>
                <p className="mt-1 text-xs text-blue-600">
                  Portal credentials will be automatically sent to the
                  applicant&apos;s email:
                </p>
                <div className="mt-2 space-y-1 text-xs text-blue-700">
                  <p>
                    <span className="font-medium">Username:</span>{" "}
                    {selectedCorData.studentNumber}
                  </p>
                  <p>
                    <span className="font-medium">Password:</span> Date of Birth
                    (MM/DD/YYYY)
                  </p>
                </div>
              </div>
              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowVerifyConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowVerifyConfirm(false)}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm & Dispatch
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
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Reject COR
              </h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
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
              <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                <p className="text-sm font-semibold text-[var(--earist-primary)]">
                  {selectedCorData.name}
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  {selectedCorData.studentNumber} &middot;{" "}
                  {selectedCorData.program}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none"
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
                disabled={!rejectReason.trim()}
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className={`flex-1 ${
                  rejectReason.trim()
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject COR
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
