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
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  X,
  AlertTriangle,
  Check,
  FileText,
} from "lucide-react";

export default function AdminDefenseApplicationsPage() {
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<number | null>(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const applications = [
    {
      id: 1,
      studentName: "Juan Dela Cruz",
      studentNumber: "2026-GS-00457",
      program: "MSCS",
      stage: "title_defense" as "title_defense" | "proposal_defense" | "final_defense",
      dateSubmitted: "June 5, 2026",
      status: "pending" as "pending" | "approved" | "rejected" | "completed",
      requirements: [
        { name: "Certificate of Comprehensive Exam", met: true },
        { name: "COR (Current Semester)", met: true },
        { name: "Application for Defense", met: true },
        { name: "Three Proposed Titles", met: true },
      ],
      proposedTitles: [
        "Machine Learning Approaches for Early Detection of Student Academic Risk",
        "Deep Learning Framework for Automated Thesis Document Analysis",
        "NLP-Based Chatbot System for Graduate School Student Support",
      ],
      adviser: null as string | null,
    },
    {
      id: 2,
      studentName: "Ana Garcia",
      studentNumber: "2026-GS-00459",
      program: "MAED",
      stage: "proposal_defense" as "title_defense" | "proposal_defense" | "final_defense",
      dateSubmitted: "June 3, 2026",
      status: "pending" as "pending" | "approved" | "rejected" | "completed",
      requirements: [
        { name: "COR (Current Semester)", met: true },
        { name: "Application for Defense", met: true },
        { name: "Adviser Certification", met: true },
        { name: "Approved RAP from Title Defense", met: true },
        { name: "Approved Research Variables", met: true },
      ],
      proposedTitles: null,
      adviser: "Dr. Pedro Lim",
    },
    {
      id: 3,
      studentName: "Elena Torres",
      studentNumber: "2026-GS-00460",
      program: "MSCS",
      stage: "title_defense" as "title_defense" | "proposal_defense" | "final_defense",
      dateSubmitted: "June 1, 2026",
      status: "approved" as "pending" | "approved" | "rejected" | "completed",
      requirements: [
        { name: "Certificate of Comprehensive Exam", met: true },
        { name: "COR (Current Semester)", met: true },
        { name: "Application for Defense", met: true },
        { name: "Three Proposed Titles", met: true },
      ],
      proposedTitles: [
        "Effectiveness of Blended Learning in Graduate Education",
        "Student Engagement Strategies in Online Thesis Advising",
        "Curriculum Mapping for Industry-Aligned Graduate Programs",
      ],
      adviser: "Dr. Ana Garcia",
    },
    {
      id: 4,
      studentName: "Roberto Lim",
      studentNumber: "2026-GS-00461",
      program: "DIT",
      stage: "final_defense" as "title_defense" | "proposal_defense" | "final_defense",
      dateSubmitted: "May 28, 2026",
      status: "pending" as "pending" | "approved" | "rejected" | "completed",
      requirements: [
        { name: "COR (Current Semester)", met: true },
        { name: "Application for Defense", met: true },
        { name: "Adviser Certification", met: true },
        { name: "Rapporteur's Report (Proposal Defense)", met: true },
        { name: "Manuscript — Chapters 1–5 (PDF)", met: true },
      ],
      proposedTitles: null,
      adviser: "Dr. Juan Dela Cruz",
    },
    {
      id: 5,
      studentName: "Maria Santos",
      studentNumber: "2026-GS-00456",
      program: "MSCS",
      stage: "proposal_defense" as "title_defense" | "proposal_defense" | "final_defense",
      dateSubmitted: "May 25, 2026",
      status: "completed" as "pending" | "approved" | "rejected" | "completed",
      requirements: [
        { name: "COR (Current Semester)", met: true },
        { name: "Application for Defense", met: true },
        { name: "Adviser Certification", met: true },
        { name: "Approved RAP from Title Defense", met: true },
        { name: "Approved Research Variables", met: true },
      ],
      proposedTitles: null,
      adviser: "Dr. Roberto Reyes",
    },
    {
      id: 6,
      studentName: "Pedro Reyes",
      studentNumber: "2026-GS-00458",
      program: "MIT",
      stage: "title_defense" as "title_defense" | "proposal_defense" | "final_defense",
      dateSubmitted: "May 20, 2026",
      status: "rejected" as "pending" | "approved" | "rejected" | "completed",
      requirements: [
        { name: "Certificate of Comprehensive Exam", met: false },
        { name: "COR (Current Semester)", met: true },
        { name: "Application for Defense", met: true },
        { name: "Three Proposed Titles", met: true },
      ],
      proposedTitles: [
        "AI-Driven Student Performance Prediction Model",
        "Blockchain for Academic Credential Verification",
        "IoT-Based Smart Campus Management System",
      ],
      adviser: null,
    },
  ];

  const filteredApplications = applications.filter((app) => {
    if (stageFilter !== "all" && app.stage !== stageFilter) return false;
    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    return true;
  });

  const selectedAppData = applications.find((a) => a.id === selectedApp);

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;
  const completedCount = applications.filter((a) => a.status === "completed").length;
  const rejectedCount = applications.filter((a) => a.status === "rejected").length;

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case "title_defense":
        return <Badge className="bg-blue-100 text-blue-700">Title Defense</Badge>;
      case "proposal_defense":
        return <Badge className="bg-purple-100 text-purple-700">Proposal Defense</Badge>;
      case "final_defense":
        return <Badge className="bg-green-100 text-green-700">Final Defense</Badge>;
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
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Defense Application Review
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Review Title, Proposal, and Final Defense applications
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Pending</p>
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Approved</p>
            <p className="text-lg font-bold text-blue-600">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Completed</p>
            <p className="text-lg font-bold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Rejected</p>
            <p className="text-lg font-bold text-red-600">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--earist-body-text)]" />
              <span className="text-xs text-[var(--earist-body-text)]">
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
                        ? "bg-[var(--earist-primary)] text-white"
                        : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)] hover:bg-[var(--earist-border-gray)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--earist-body-text)]">
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
                        ? "bg-[var(--earist-primary)] text-white"
                        : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)] hover:bg-[var(--earist-border-gray)]"
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
        {filteredApplications.map((app) => {
          const allRequirementsMet = app.requirements.every((r) => r.met);
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
                      <p className="text-sm font-semibold text-[var(--earist-primary)]">
                        {app.studentName}
                      </p>
                      <p className="text-xs text-[var(--earist-body-text)]">
                        {app.studentNumber} &middot; {app.program}
                        {app.adviser && ` · Adviser: ${app.adviser}`}
                      </p>
                      <p className="text-xs text-[var(--earist-body-text)]">
                        Submitted: {app.dateSubmitted}
                      </p>
                    </div>

                    {/* Requirements Checklist */}
                    <div>
                      <p className="mb-1 text-xs font-semibold text-[var(--earist-secondary)]">
                        Requirements
                      </p>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {app.requirements.map((req, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            {req.met ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span
                              className={`text-xs ${
                                req.met
                                  ? "text-[var(--earist-body-text)]"
                                  : "text-red-600"
                              }`}
                            >
                              {req.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Proposed Titles (Title Defense) */}
                    {app.proposedTitles && (
                      <div className="mt-2">
                        <p className="mb-1 text-xs font-semibold text-[var(--earist-secondary)]">
                          Proposed Titles
                        </p>
                        <div className="space-y-0.5">
                          {app.proposedTitles.map((title, i) => (
                            <p key={i} className="text-xs text-[var(--earist-body-text)]">
                              {i + 1}. {title}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-[var(--earist-border-gray)] p-4 lg:flex-col lg:border-t-0 lg:border-l lg:px-4">
                    {app.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setShowApproveConfirm(true)}
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
                    <Button size="sm" variant="outline">
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
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Approve Application
              </h3>
              <button
                onClick={() => setShowApproveConfirm(false)}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
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
              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowApproveConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowApproveConfirm(false)}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Approve
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
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Reject Application
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
                    Reject Defense Application
                  </p>
                </div>
                <p className="mt-2 text-xs text-red-600">
                  The student will be notified and can resubmit after fixing
                  issues.
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
    </div>
  );
}
