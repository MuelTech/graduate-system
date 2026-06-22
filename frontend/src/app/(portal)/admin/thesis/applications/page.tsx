"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  X,
  AlertTriangle,
  Check,
} from "lucide-react";

interface ThesisDocument {
  docType: string;
  filePath: string;
}

interface ThesisTitle {
  id: string;
  titleText: string;
  isSelected: boolean;
}

interface ThesisApplication {
  id: string;
  stage: string;
  status: string;
  createdAt: string;
  student: {
    programId: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  thesisDocuments?: ThesisDocument[];
  thesisTitles?: ThesisTitle[];
  assignment?: {
    adviser?: {
      firstName: string;
    };
  };
}

interface MappedApplication {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  stage: string;
  dateSubmitted: string;
  status: string;
  requirements: { name: string; met: boolean; path: string }[];
  proposedTitles: ThesisTitle[] | null;
  adviser: string | null;
}

export default function AdminDefenseApplicationsPage() {
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAppForView, setSelectedAppForView] =
    useState<MappedApplication | null>(null);

  const queryClient = useQueryClient();
  const apiUrl =
    process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";
  const [winningTitleId, setWinningTitleId] = useState<string>("");

  const { data: dbApplications = [] } = useQuery<ThesisApplication[]>({
    queryKey: ["pendingDefenses"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/pending");
      return res || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      thesisId,
      titleId,
    }: {
      thesisId: string;
      titleId: string;
    }) => {
      return await apiClientRequest(`/thesis/defense/${thesisId}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: "APPROVED",
          approvedTitleId: titleId,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingDefenses"] });
      setShowApproveConfirm(false);
      setWinningTitleId("");
      alert("Thesis Application Approved!");
    },
    onError: (error: Error) => {
      console.error("Approval failed: " + error.message);
    },
  });

  const handleConfirmApprove = () => {
    if (!selectedApp) return;
    const app = dbApplications.find(
      (a: ThesisApplication) => a.id === selectedApp,
    );
    if (app?.stage === "TITLE" && !winningTitleId) {
      alert("Please select a winning title.");
      return;
    }
    approveMutation.mutate({ thesisId: selectedApp, titleId: winningTitleId });
  };

  const applications: MappedApplication[] = dbApplications.map(
    (app: ThesisApplication) => ({
      id: app.id,
      studentName: `${app.student.user.firstName} ${app.student.user.lastName}`,
      studentNumber: app.student.user.email,
      program: app.student.programId || "N/A",
      stage:
        app.stage === "TITLE"
          ? "title_defense"
          : app.stage === "PROPOSAL"
            ? "proposal_defense"
            : "final_defense",
      dateSubmitted: new Date(app.createdAt).toLocaleDateString(),
      status: app.status.toLowerCase(),
      requirements:
        app.thesisDocuments?.map((doc: ThesisDocument) => ({
          name: doc.docType,
          met: true,
          path: doc.filePath,
        })) || [],
      proposedTitles: app.thesisTitles || null,
      adviser: app.assignment?.adviser?.firstName || "Pending",
    }),
  );

  const filteredApplications = applications.filter((app: MappedApplication) => {
    if (stageFilter !== "all" && app.stage !== stageFilter) return false;
    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    return true;
  });

  const selectedAppData = applications.find(
    (a: MappedApplication) => a.id === selectedApp,
  );

  const pendingCount = applications.filter(
    (a: MappedApplication) => a.status === "pending",
  ).length;
  const approvedCount = applications.filter(
    (a: MappedApplication) => a.status === "approved",
  ).length;
  const completedCount = applications.filter(
    (a: MappedApplication) => a.status === "completed",
  ).length;
  const rejectedCount = applications.filter(
    (a: MappedApplication) => a.status === "rejected",
  ).length;

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case "title_defense":
        return (
          <Badge className="bg-blue-100 text-blue-700">Title Defense</Badge>
        );
      case "proposal_defense":
        return (
          <Badge className="bg-purple-100 text-purple-700">
            Proposal Defense
          </Badge>
        );
      case "final_defense":
        return (
          <Badge className="bg-green-100 text-green-700">Final Defense</Badge>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="mr-1 h-3 w-3" />
            Pending Review
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
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
          Defense Application Review
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review Title, Proposal, and Final Defense applications
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Pending</p>
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Approved</p>
            <p className="text-lg font-bold text-blue-600">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Completed</p>
            <p className="text-lg font-bold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Rejected</p>
            <p className="text-lg font-bold text-red-600">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <span className="text-xs text-(--earist-body-text)">
                Stage:
              </span>
              <div className="flex gap-1">
                {[
                  { value: "all", label: "All" },
                  { value: "title_defense", label: "Title" },
                  { value: "proposal_defense", label: "Proposal" },
                  { value: "final_defense", label: "Final" },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStageFilter(f.value)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      stageFilter === f.value
                        ? "bg-(--earist-primary) text-white"
                        : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-(--earist-body-text)">
                Status:
              </span>
              <div className="flex gap-1">
                {[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "completed", label: "Completed" },
                  { value: "rejected", label: "Rejected" },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      statusFilter === f.value
                        ? "bg-(--earist-primary) text-white"
                        : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      <div className="space-y-3">
        {filteredApplications.map((app: MappedApplication) => {
          return (
            <Card key={app.id}>
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row">
                  {/* Application Info */}
                  <div className="flex-1 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      {getStageBadge(app.stage)}
                      {getStatusBadge(app.status)}
                    </div>
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        {app.studentName}
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        {app.studentNumber} &middot; {app.program}
                        {app.adviser && ` · Adviser: ${app.adviser}`}
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        Submitted: {app.dateSubmitted}
                      </p>
                    </div>

                    {/* Requirements Checklist */}
                    <div>
                      <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                        Requirements
                      </p>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {app.requirements.map(
                          (req: { name: string; met: boolean }, i: number) => (
                            <div key={i} className="flex items-center gap-1.5">
                              {req.met ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                              <span
                                className={`text-xs ${
                                  req.met
                                    ? "text-(--earist-body-text)"
                                    : "text-red-600"
                                }`}
                              >
                                {req.name}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Proposed Titles (Title Defense) */}
                    {app.proposedTitles && app.proposedTitles.length > 0 && (
                      <div className="mt-2">
                        <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                          Proposed Titles
                        </p>
                        <div className="space-y-0.5">
                          {app.proposedTitles.map(
                            (title: ThesisTitle, i: number) => (
                              <p
                                key={title.id}
                                className="text-xs text-(--earist-body-text)"
                              >
                                {i + 1}. {title.titleText}{" "}
                                {title.isSelected && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-green-600"
                                  >
                                    Approved
                                  </Badge>
                                )}
                              </p>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-(--earist-border-gray) p-4 lg:flex-col lg:border-t-0 lg:border-l lg:px-4">
                    {app.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app.id);
                            setShowApproveConfirm(true);
                          }}
                          className="bg-green-600 text-white hover:bg-green-700"
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRejectModal(true)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Reject
                        </Button>
                      </>
                    )}
                    {app.status === "approved" && (
                      <Button size="sm" variant="outline">
                        <FileCheck2 className="mr-1 h-3 w-3" />
                        Assign Panel
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAppForView(app);
                        setShowViewModal(true);
                      }}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Approve Application
              </h3>
              <button
                onClick={() => setShowApproveConfirm(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">
                    Approve Defense Application
                  </p>
                </div>
                <p className="mt-2 text-xs text-green-600">
                  The student will be notified. You can then assign panelists
                  and schedule the defense.
                </p>
              </div>

              {selectedAppData?.stage === "title_defense" &&
                selectedAppData.proposedTitles && (
                  <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                      Select Winning Title{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={winningTitleId}
                      onChange={(e) => setWinningTitleId(e.target.value)}
                      className="w-full rounded-md border border-(--earist-border-gray) px-3 py-2 text-sm"
                    >
                      <option value="">-- Choose Approved Title --</option>
                      {selectedAppData.proposedTitles.map((t: ThesisTitle) => (
                        <option key={t.id} value={t.id}>
                          {t.titleText}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowApproveConfirm(false)}
                className="flex-1"
                disabled={approveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmApprove}
                disabled={
                  approveMutation.isPending ||
                  (selectedAppData?.stage === "title_defense" &&
                    !winningTitleId)
                }
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                {approveMutation.isPending ? (
                  "Approving..."
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Approve
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Reject Application
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
                    Reject Defense Application
                  </p>
                </div>
                <p className="mt-2 text-xs text-red-600">
                  The student will be notified and can resubmit after fixing
                  issues.
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
              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
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
                Confirm Reject
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedAppForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Application Documents
              </h3>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedAppForView(null);
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {selectedAppForView.studentName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedAppForView.studentNumber} &middot;{" "}
                  {selectedAppForView.program}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-(--earist-secondary)">
                  Submitted Requirements
                </p>
                {selectedAppForView.requirements.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAppForView.requirements.map((req, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-(--earist-border-gray) p-3"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium text-(--earist-primary)">
                            {req.name.replace(/_/g, " ")}
                          </span>
                        </div>
                        <a
                          href={`${apiUrl}/${req.path.replace(/\\/g, "/")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View File
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-(--earist-body-text)">
                    No documents uploaded.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedAppForView(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
