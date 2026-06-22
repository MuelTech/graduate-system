"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle2, UserPlus, Eye, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AdviserRequestUI {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  requestDate: string;
  preferredAdviser: string | null;
  researchInterest: string;
  status: string;
}

interface ActiveAssignmentUI {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  adviserName: string;
  adviserType: string;
  assignedDate: string;
  thesisStage: string;
  lastActivity: string;
  progress: number;
}

interface AvailableAdviserUI {
  id: string;
  name: string;
  advisees: number;
  maxAdvisees: number;
  specialization: string;
}

export default function AdminAdviseesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"requests" | "assignments">(
    "requests",
  );
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAdviser, setSelectedAdviser] = useState("");

  const apiUrl =
    process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";

  // Fetch Requests
  const { data: fetchedRequests = [] } = useQuery({
    queryKey: ["adviserRequests"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/thesis/adviser/requests`, {
        headers: { Authorization: `Bearer ${session?.user?.accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
    enabled: !!session?.user?.accessToken,
  });

  // Fetch Assignments
  const { data: fetchedAssignments = [] } = useQuery({
    queryKey: ["activeAssignments"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/thesis/adviser/assignments`, {
        headers: { Authorization: `Bearer ${session?.user?.accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load assignments");
      return res.json();
    },
    enabled: !!session?.user?.accessToken,
  });

  // Fetch Available Advisers
  const { data: fetchedAdvisers = [] } = useQuery({
    queryKey: ["availableAdvisers"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/thesis/adviser/available`, {
        headers: { Authorization: `Bearer ${session?.user?.accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load available advisers");
      return res.json();
    },
    enabled: !!session?.user?.accessToken,
  });

  const assignAdviserMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiUrl}/api/thesis/adviser/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.user?.accessToken}`,
        },
        body: JSON.stringify({
          requestId: selectedRequest,
          adviserId: selectedAdviser,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to assign adviser");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Adviser assigned successfully!");
      queryClient.invalidateQueries({ queryKey: ["adviserRequests"] });
      queryClient.invalidateQueries({ queryKey: ["activeAssignments"] });
      setShowAssignModal(false);
      setSelectedAdviser("");
      setSelectedRequest(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Map Backend Data to UI structures
  const adviserRequests: AdviserRequestUI[] = fetchedRequests.map(
    (r: {
      id: string;
      student: {
        user: { firstName: string; lastName: string };
        studentNumber: string;
        program?: { programName: string };
      };
      requestDate: string;
      requestedAdviser?: { lastName: string };
      reason?: string;
      status: string;
    }) => ({
      id: r.id,
      studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
      studentNumber: r.student.studentNumber,
      program: r.student.program?.programName || "Program",
      requestDate: new Date(r.requestDate).toLocaleDateString(),
      preferredAdviser: r.requestedAdviser
        ? `Dr. ${r.requestedAdviser.lastName}`
        : null,
      researchInterest: r.reason || "N/A",
      status: r.status.toLowerCase(),
    }),
  );

  const activeAssignments: ActiveAssignmentUI[] = fetchedAssignments.map(
    (a: {
      id: string;
      student: {
        user: { firstName: string; lastName: string };
        studentNumber: string;
        program?: { programName: string };
      };
      adviser: { lastName: string };
      assignedDate: string;
      thesisRecords?: Array<{ stage: string; status: string }>;
    }) => {
      const latestRecord = a.thesisRecords?.[0];
      let mappedStage = "title_defense";
      let prog = 25;

      if (latestRecord) {
        if (latestRecord.stage === "TITLE") {
          mappedStage = "title_defense";
          prog = 25;
        } else if (latestRecord.stage === "PROPOSAL") {
          mappedStage = "proposal_defense";
          prog = 50;
        } else if (latestRecord.stage === "FINAL") {
          mappedStage =
            latestRecord.status === "APPROVED" ? "completed" : "final_defense";
          prog = latestRecord.status === "APPROVED" ? 100 : 75;
        }
      }

      return {
        id: a.id,
        studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
        studentNumber: a.student.studentNumber,
        program: a.student.program?.programName || "Program",
        adviserName: `Dr. ${a.adviser.lastName}`,
        adviserType: "internal",
        assignedDate: new Date(a.assignedDate).toLocaleDateString(),
        thesisStage: mappedStage,
        lastActivity: "Recent",
        progress: prog,
      };
    },
  );

  const availableAdvisers: AvailableAdviserUI[] = fetchedAdvisers.map(
    (adv: {
      id: string;
      firstName: string;
      lastName: string;
      panelist?: { maxAdvisees: number; specialization?: string };
    }) => ({
      id: adv.id,
      name: `Dr. ${adv.firstName} ${adv.lastName}`,
      advisees: 0, // Mock for now until counted
      maxAdvisees: adv.panelist?.maxAdvisees || 5,
      specialization: adv.panelist?.specialization || "General",
    }),
  );

  const pendingRequestCount = adviserRequests.filter(
    (r: AdviserRequestUI) => r.status === "pending",
  ).length;
  const totalAssignments = activeAssignments.length;
  const completedCount = activeAssignments.filter(
    (a: ActiveAssignmentUI) => a.thesisStage === "completed",
  ).length;

  const selectedRequestData = adviserRequests.find(
    (r: AdviserRequestUI) => r.id === selectedRequest,
  );

  const getThesisStageBadge = (stage: string) => {
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
          Manage Advisees
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Assign advisees to thesis advisers and monitor progress
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Pending Requests
            </p>
            <p className="text-lg font-bold text-amber-600">
              {pendingRequestCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Active Assignments
            </p>
            <p className="text-lg font-bold text-blue-600">
              {totalAssignments}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Completed</p>
            <p className="text-lg font-bold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("requests")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "requests" ? "bg-(--earist-primary) text-white" : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"}`}
        >
          Adviser Requests ({adviserRequests.length})
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "assignments" ? "bg-(--earist-primary) text-white" : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"}`}
        >
          Active Assignments ({activeAssignments.length})
        </button>
      </div>

      {/* Adviser Requests Tab */}
      {activeTab === "requests" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            {adviserRequests.map((request: AdviserRequestUI) => (
              <button
                key={request.id}
                onClick={() => setSelectedRequest(request.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${selectedRequest === request.id ? "border-(--earist-primary) bg-(--earist-surface-light-red)" : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {request.studentName}
                  </p>
                  <Badge
                    className={
                      request.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : request.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                    }
                  >
                    {request.status === "pending"
                      ? "Pending"
                      : request.status === "approved"
                        ? "Approved"
                        : "Rejected"}
                  </Badge>
                </div>
                <p className="text-xs text-(--earist-body-text)">
                  {request.program} &middot; {request.studentNumber}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  Requested: {request.requestDate}
                </p>
              </button>
            ))}
          </div>

          {selectedRequestData ? (
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                      Request Details
                    </CardTitle>
                    <button
                      onClick={() => setSelectedRequest(null)}
                      className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        {selectedRequestData.studentName}
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        {selectedRequestData.studentNumber} &middot;{" "}
                        {selectedRequestData.program}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-(--earist-body-text)">
                          Request Date
                        </p>
                        <p className="text-sm font-medium text-(--earist-primary)">
                          {selectedRequestData.requestDate}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-(--earist-body-text)">
                          Preferred Adviser
                        </p>
                        <p className="text-sm font-medium text-(--earist-primary)">
                          {selectedRequestData.preferredAdviser ||
                            "No preference"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-(--earist-body-text)">
                          Research Interest
                        </p>
                        <p className="text-sm font-medium text-(--earist-primary)">
                          {selectedRequestData.researchInterest}
                        </p>
                      </div>
                    </div>
                    {selectedRequestData.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setShowAssignModal(true)}
                          className="flex-1 bg-green-600 text-white hover:bg-green-700"
                        >
                          <UserPlus className="mr-1 h-3 w-3" />
                          Assign Adviser
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 text-red-600 hover:bg-red-50"
                        >
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
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                      <Users className="h-8 w-8 text-(--earist-body-text)/40" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                      Select a Request
                    </h3>
                    <p className="text-sm text-(--earist-body-text)">
                      Click a request from the queue to view details and assign
                      an adviser.
                    </p>
                  </div>
                </CardContent>
              </Card>
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
                  <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Adviser
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                      Thesis Stage
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Last Activity
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-(--earist-secondary)">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeAssignments.map((assignment: ActiveAssignmentUI) => (
                    <tr
                      key={assignment.id}
                      className="border-b border-(--earist-border-gray) last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-(--earist-primary)">
                            {assignment.studentName}
                          </p>
                          <p className="text-xs text-(--earist-body-text)">
                            {assignment.studentNumber} &middot;{" "}
                            {assignment.program}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-(--earist-primary)">
                          {assignment.adviserName}
                        </p>
                        <p className="text-xs text-(--earist-body-text)">
                          Since {assignment.assignedDate}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getThesisStageBadge(assignment.thesisStage)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-(--earist-primary)">
                            {assignment.progress}%
                          </span>
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-(--earist-border-gray)">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${assignment.progress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                        {assignment.lastActivity}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                            title="Reassign Adviser"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
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
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Assign Adviser
              </h3>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedAdviser("");
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {selectedRequestData.studentName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedRequestData.studentNumber} &middot;{" "}
                  {selectedRequestData.program}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  Research: {selectedRequestData.researchInterest}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Select Adviser
                </label>
                <select
                  value={selectedAdviser}
                  onChange={(e) => setSelectedAdviser(e.target.value)}
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                >
                  <option value="">Choose an adviser...</option>
                  {availableAdvisers.map((adviser: AvailableAdviserUI) => (
                    <option key={adviser.id} value={adviser.id}>
                      {adviser.name} ({adviser.advisees}/{adviser.maxAdvisees}{" "}
                      advisees) — {adviser.specialization}
                    </option>
                  ))}
                </select>
              </div>
              {selectedAdviser && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-xs font-semibold text-green-700">
                    Assignment Confirmation
                  </p>
                  <p className="text-xs text-green-600">
                    Both the student and adviser will be notified via email.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedAdviser("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedAdviser || assignAdviserMutation.isPending}
                onClick={() => assignAdviserMutation.mutate()}
                className={`flex-1 ${selectedAdviser ? "bg-green-600 text-white hover:bg-green-700" : "cursor-not-allowed bg-gray-200 text-gray-400"}`}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {assignAdviserMutation.isPending
                  ? "Assigning..."
                  : "Assign Adviser"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
