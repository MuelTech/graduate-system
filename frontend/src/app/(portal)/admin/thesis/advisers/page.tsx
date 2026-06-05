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
  Users,
  Clock,
  CheckCircle2,
  UserPlus,
  Eye,
  Filter,
  X,
  GraduationCap,
  AlertTriangle,
  FileCheck2,
} from "lucide-react";

export default function AdminAdviseesPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "assignments">("requests");
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAdviser, setSelectedAdviser] = useState("");

  const adviserRequests = [
    {
      id: 1,
      studentName: "Juan Dela Cruz",
      studentNumber: "2026-GS-00457",
      program: "MSCS",
      requestDate: "June 1, 2026",
      preferredAdviser: "Dr. Roberto Reyes",
      researchInterest: "Machine Learning, Data Science",
      status: "pending" as "pending" | "approved" | "rejected",
    },
    {
      id: 2,
      studentName: "Pedro Reyes",
      studentNumber: "2026-GS-00458",
      program: "MIT",
      requestDate: "June 3, 2026",
      preferredAdviser: null,
      researchInterest: "Software Engineering, AI",
      status: "pending" as "pending" | "approved" | "rejected",
    },
    {
      id: 3,
      studentName: "Elena Torres",
      studentNumber: "2026-GS-00460",
      program: "MSCS",
      requestDate: "May 28, 2026",
      preferredAdviser: "Dr. Ana Garcia",
      researchInterest: "Educational Technology",
      status: "approved" as "pending" | "approved" | "rejected",
    },
  ];

  const activeAssignments = [
    {
      id: 1,
      studentName: "Maria Santos",
      studentNumber: "2026-GS-00456",
      program: "MSCS",
      adviserName: "Dr. Roberto Reyes",
      adviserType: "internal",
      assignedDate: "May 15, 2026",
      thesisStage: "proposal_defense",
      lastActivity: "June 5, 2026",
      progress: 50,
    },
    {
      id: 2,
      studentName: "Ana Garcia",
      studentNumber: "2026-GS-00459",
      program: "MAED",
      adviserName: "Dr. Pedro Lim",
      adviserType: "internal",
      assignedDate: "May 20, 2026",
      thesisStage: "title_defense",
      lastActivity: "June 3, 2026",
      progress: 25,
    },
    {
      id: 3,
      studentName: "Carlos Luna",
      studentNumber: "2025-GS-00289",
      program: "PhD Education",
      adviserName: "Dr. Roberto Reyes",
      adviserType: "internal",
      assignedDate: "January 15, 2025",
      thesisStage: "completed",
      lastActivity: "May 28, 2026",
      progress: 100,
    },
    {
      id: 4,
      studentName: "Roberto Lim",
      studentNumber: "2026-GS-00461",
      program: "DIT",
      adviserName: "Dr. Juan Dela Cruz",
      adviserType: "internal",
      assignedDate: "April 10, 2026",
      thesisStage: "proposal_defense",
      lastActivity: "June 1, 2026",
      progress: 50,
    },
    {
      id: 5,
      studentName: "Elena Torres",
      studentNumber: "2026-GS-00460",
      program: "MSCS",
      adviserName: "Dr. Ana Garcia",
      adviserType: "internal",
      assignedDate: "May 30, 2026",
      thesisStage: "title_defense",
      lastActivity: "June 3, 2026",
      progress: 25,
    },
  ];

  const availableAdvisers = [
    { id: "1", name: "Dr. Roberto Reyes", advisees: 2, maxAdvisees: 5, specialization: "Machine Learning, Data Science" },
    { id: "2", name: "Dr. Ana Garcia", advisees: 2, maxAdvisees: 5, specialization: "Education, EdTech" },
    { id: "3", name: "Dr. Juan Dela Cruz", advisees: 1, maxAdvisees: 5, specialization: "Mathematics, Statistics" },
    { id: "4", name: "Dr. Pedro Lim", advisees: 1, maxAdvisees: 5, specialization: "Educational Management" },
    { id: "5", name: "Dr. Maria Santos", advisees: 0, maxAdvisees: 3, specialization: "IT, Software Engineering" },
  ];

  const pendingRequestCount = adviserRequests.filter((r) => r.status === "pending").length;
  const totalAssignments = activeAssignments.length;
  const completedCount = activeAssignments.filter((a) => a.thesisStage === "completed").length;

  const selectedRequestData = adviserRequests.find((r) => r.id === selectedRequest);

  const getThesisStageBadge = (stage: string) => {
    switch (stage) {
      case "title_defense": return <Badge className="bg-blue-100 text-blue-700">Title Defense</Badge>;
      case "proposal_defense": return <Badge className="bg-purple-100 text-purple-700">Proposal Defense</Badge>;
      case "final_defense": return <Badge className="bg-green-100 text-green-700">Final Defense</Badge>;
      case "completed": return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="mr-1 h-3 w-3" />Completed</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--earist-primary)]" style={{ fontFamily: '"Calibri", sans-serif' }}>
          Manage Advisees
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Assign advisees to thesis advisers and monitor progress
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--earist-body-text)]">Pending Requests</p><p className="text-lg font-bold text-amber-600">{pendingRequestCount}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--earist-body-text)]">Active Assignments</p><p className="text-lg font-bold text-blue-600">{totalAssignments}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--earist-body-text)]">Completed</p><p className="text-lg font-bold text-green-600">{completedCount}</p></CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab("requests")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "requests" ? "bg-[var(--earist-primary)] text-white" : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)] hover:bg-[var(--earist-border-gray)]"}`}>
          Adviser Requests ({adviserRequests.length})
        </button>
        <button onClick={() => setActiveTab("assignments")} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "assignments" ? "bg-[var(--earist-primary)] text-white" : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)] hover:bg-[var(--earist-border-gray)]"}`}>
          Active Assignments ({activeAssignments.length})
        </button>
      </div>

      {/* Adviser Requests Tab */}
      {activeTab === "requests" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            {adviserRequests.map((request) => (
              <button key={request.id} onClick={() => setSelectedRequest(request.id)} className={`w-full rounded-lg border p-4 text-left transition-colors ${selectedRequest === request.id ? "border-[var(--earist-primary)] bg-[var(--earist-surface-light-red)]" : "border-[var(--earist-border-gray)] hover:bg-[var(--earist-surface-gray)]"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">{request.studentName}</p>
                  <Badge className={request.status === "pending" ? "bg-amber-100 text-amber-700" : request.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                    {request.status === "pending" ? "Pending" : request.status === "approved" ? "Approved" : "Rejected"}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--earist-body-text)]">{request.program} &middot; {request.studentNumber}</p>
                <p className="text-xs text-[var(--earist-body-text)]">Requested: {request.requestDate}</p>
              </button>
            ))}
          </div>

          {selectedRequestData ? (
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">Request Details</CardTitle>
                    <button onClick={() => setSelectedRequest(null)} className="rounded p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"><X className="h-4 w-4" /></button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                      <p className="text-sm font-semibold text-[var(--earist-primary)]">{selectedRequestData.studentName}</p>
                      <p className="text-xs text-[var(--earist-body-text)]">{selectedRequestData.studentNumber} &middot; {selectedRequestData.program}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-[var(--earist-body-text)]">Request Date</p><p className="text-sm font-medium text-[var(--earist-primary)]">{selectedRequestData.requestDate}</p></div>
                      <div><p className="text-xs text-[var(--earist-body-text)]">Preferred Adviser</p><p className="text-sm font-medium text-[var(--earist-primary)]">{selectedRequestData.preferredAdviser || "No preference"}</p></div>
                      <div className="col-span-2"><p className="text-xs text-[var(--earist-body-text)]">Research Interest</p><p className="text-sm font-medium text-[var(--earist-primary)]">{selectedRequestData.researchInterest}</p></div>
                    </div>
                    {selectedRequestData.status === "pending" && (
                      <div className="flex gap-2">
                        <Button onClick={() => setShowAssignModal(true)} className="flex-1 bg-green-600 text-white hover:bg-green-700">
                          <UserPlus className="mr-1 h-3 w-3" />
                          Assign Adviser
                        </Button>
                        <Button variant="outline" className="flex-1 text-red-600 hover:bg-red-50">
                          <X className="mr-1 h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="lg:col-span-2">
              <Card><CardContent className="py-12"><div className="flex flex-col items-center text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--earist-surface-gray)]"><Users className="h-8 w-8 text-[var(--earist-body-text)]/40" /></div><h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">Select a Request</h3><p className="text-sm text-[var(--earist-body-text)]">Click a request from the queue to view details and assign an adviser.</p></div></CardContent></Card>
            </div>
          )}
        </div>
      )}

      {/* Active Assignments Tab */}
      {activeTab === "assignments" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--earist-border-gray)] bg-[var(--earist-surface-gray)]">
                    <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">Student</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">Adviser</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">Thesis Stage</th>
                    <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">Progress</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">Last Activity</th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--earist-secondary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAssignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-[var(--earist-border-gray)] last:border-0">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-[var(--earist-primary)]">{assignment.studentName}</p>
                          <p className="text-xs text-[var(--earist-body-text)]">{assignment.studentNumber} &middot; {assignment.program}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[var(--earist-primary)]">{assignment.adviserName}</p>
                        <p className="text-xs text-[var(--earist-body-text)]">Since {assignment.assignedDate}</p>
                      </td>
                      <td className="px-4 py-3 text-center">{getThesisStageBadge(assignment.thesisStage)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-[var(--earist-primary)]">{assignment.progress}%</span>
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--earist-border-gray)]">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${assignment.progress}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--earist-body-text)]">{assignment.lastActivity}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button className="rounded p-1.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]" title="View Details"><Eye className="h-4 w-4" /></button>
                          <button className="rounded p-1.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]" title="Reassign Adviser"><UserPlus className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign Adviser Modal */}
      {showAssignModal && selectedRequestData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">Assign Adviser</h3>
              <button onClick={() => { setShowAssignModal(false); setSelectedAdviser(""); }} className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                <p className="text-sm font-semibold text-[var(--earist-primary)]">{selectedRequestData.studentName}</p>
                <p className="text-xs text-[var(--earist-body-text)]">{selectedRequestData.studentNumber} &middot; {selectedRequestData.program}</p>
                <p className="text-xs text-[var(--earist-body-text)]">Research: {selectedRequestData.researchInterest}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">Select Adviser</label>
                <select value={selectedAdviser} onChange={(e) => setSelectedAdviser(e.target.value)} className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none">
                  <option value="">Choose an adviser...</option>
                  {availableAdvisers.map((adviser) => (
                    <option key={adviser.id} value={adviser.id}>{adviser.name} ({adviser.advisees}/{adviser.maxAdvisees} advisees) — {adviser.specialization}</option>
                  ))}
                </select>
              </div>
              {selectedAdviser && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-xs font-semibold text-green-700">Assignment Confirmation</p>
                  <p className="text-xs text-green-600">Both the student and adviser will be notified via email.</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => { setShowAssignModal(false); setSelectedAdviser(""); }} className="flex-1">Cancel</Button>
              <Button disabled={!selectedAdviser} onClick={() => { setShowAssignModal(false); setSelectedAdviser(""); setSelectedRequest(null); }} className={`flex-1 ${selectedAdviser ? "bg-green-600 text-white hover:bg-green-700" : "cursor-not-allowed bg-gray-200 text-gray-400"}`}>
                <UserPlus className="mr-2 h-4 w-4" />
                Assign Adviser
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
