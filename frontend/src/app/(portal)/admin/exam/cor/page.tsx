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
import { PendingCorUpload as PendingUpload} from "@/types";

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
  const [isVerifying, setIsVerifying] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [formData, setFormData] = useState({
    studentNumber: "",
    academicYear: "2026-2027",
    semester: "FIRST_SEM",
  });

  const verifyMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      return await apiClientRequest(`/cor/verify/${uploadId}`, {
        method: "POST",
        body: JSON.stringify({
          studentNumber: formData.studentNumber,
          academicYear: formData.academicYear,
          semester: formData.semester,
          method: "ADMIN_MANUAL",
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingCors"] });
      setShowVerifyConfirm(false);
      setSelectedCor(null);
      alert("COR Verified and Applicant Promoted to Student!");
    },
    onError: (error: Error) => {
      console.error("Verification failed: " + error.message);
    },
  });

  const handleVerify = () => {
    if (!selectedCor) return;
    verifyMutation.mutate(selectedCor);
  };

  const corQueue = pendingUploads.map((u) => ({
    id: u.id,
    name: `${u.student.user.firstName} ${u.student.user.lastName}`,
    email: u.student.user.email,
    program: u.student.programId || "N/A",
    uploadDate: new Date(u.createdAt).toLocaleDateString(),
    ocrStatus: "pending" as const, // Currently manual verification
    extractedData: null,
    originalFilename: u.originalFilename,
    filePath: u.filePath,
  }));

  const selectedCorData = corQueue.find((c) => c.id === selectedCor);

  const getOcrBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700">Manual Review</Badge>
        );
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
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          COR Validation
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Verify uploaded Certificates of Registration and promote applicants to
          students
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
                onClick={() => setSelectedCor(cor.id)}
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
                      {cor.program}
                    </p>
                  </div>
                  {getOcrBadge(cor.ocrStatus)}
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
                <div className="flex h-48 items-center justify-center rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray)">
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
                      onClick={() =>
                        window.open(
                          `${process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000"}/${selectedCorData.filePath.replace(/\\/g, "/")}`,
                          "_blank",
                        )
                      }
                    >
                      <Eye className="mr-2 h-4 w-4" /> View Document
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <Upload className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select a COR to Review
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Click an applicant from the queue to view their uploaded COR
                    and assign credentials.
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
                Verify COR & Promote
              </h3>
              <button
                onClick={() => setShowVerifyConfirm(false)}
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
                    Promote to Student
                  </p>
                </div>
                <p className="mt-2 text-xs text-green-600">
                  This will verify the COR and grant full Student portal access.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                    Assign Student Number{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.academicYear}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          academicYear: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-(--earist-border-gray) px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                      Semester
                    </label>
                    <select
                      required
                      value={formData.semester}
                      onChange={(e) =>
                        setFormData({ ...formData, semester: e.target.value })
                      }
                      className="w-full rounded-md border border-(--earist-border-gray) px-3 py-2 text-sm"
                    >
                      <option value="FIRST_SEM">First Semester</option>
                      <option value="SECOND_SEM">Second Semester</option>
                      <option value="SUMMER">Summer</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-700">
                    Credential Dispatch
                  </p>
                </div>
                <p className="mt-1 text-xs text-blue-600">
                  Portal credentials will be automatically sent to:{" "}
                  <span className="font-semibold">{selectedCorData.email}</span>
                </p>
                <div className="mt-2 space-y-1 text-xs text-blue-700">
                  <p>
                    <span className="font-medium">Username:</span>{" "}
                    {formData.studentNumber || "[Pending]"}
                  </p>
                  <p>
                    <span className="font-medium">Password:</span> Date of Birth
                    (MM/DD/YYYY)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowVerifyConfirm(false)}
                className="flex-1"
                disabled={isVerifying}
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
                  {selectedCorData.program}
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
                disabled={!rejectReason.trim()}
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                  // Handle reject logic here later
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
