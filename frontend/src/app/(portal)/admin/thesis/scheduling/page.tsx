"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, X, Send, Mail, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";

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
  thesisTitles?: { id: string; titleText: string; isSelected: boolean }[];
}

interface Panelist {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
}

export default function AdminSchedulingPage() {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [defenseDate, setDefenseDate] = useState("");
  const [defenseTime, setDefenseTime] = useState("");
  const [teamsLink, setTeamsLink] = useState("");
  const [chairmanId, setChairmanId] = useState("");
  const [leadPanelistId, setLeadPanelistId] = useState("");
  const [externalPanelistId, setExternalPanelistId] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const queryClient = useQueryClient();

  const { data: approvedDefenses = [] } = useQuery<ThesisApplication[]>({
    queryKey: ["approvedDefenses"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/approved");
      return res || [];
    },
  });

  const { data: dbPanelists = [] } = useQuery<Panelist[]>({
    queryKey: ["availablePanelists"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/adviser/available");
      return res || [];
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({
      thesisId,
      payload,
    }: {
      thesisId: string;
      payload: {
        defenseDate: string;
        defenseTime: string;
        venueOrLink: string;
        defenseType: string;
        chairmanId: string;
        leadPanelistId: string;
        externalPanelistId: string;
      };
    }) => {
      return await apiClientRequest(`/thesis/defense/${thesisId}/schedule`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvedDefenses"] });
      setShowConfirm(false);
      setSelectedApp(null);
      setChairmanId("");
      setLeadPanelistId("");
      setExternalPanelistId("");
      setDefenseDate("");
      setDefenseTime("");
      setTeamsLink("");
      alert("Defense scheduled successfully!");
    },
    onError: (error: Error) => {
      console.error("Scheduling failed: " + error.message);
    },
  });

  const approvedApplications = approvedDefenses.map((app) => ({
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
    dateApproved: new Date(app.createdAt).toLocaleDateString(),
    proposedTitles:
      app.thesisTitles?.filter((t) => t.isSelected).map((t) => t.titleText) ||
      null,
  }));

  const availablePanelists = dbPanelists.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    type: "internal", // Mocked type since we only have one type in db right now
    specialization: p.department || "Faculty",
  }));

  const selectedAppData = approvedApplications.find(
    (a) => a.id === selectedApp,
  );

  const canSchedule =
    chairmanId && leadPanelistId && externalPanelistId && defenseDate && defenseTime && teamsLink;

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case "title_defense":
        return "Title Defense";
      case "proposal_defense":
        return "Proposal Defense";
      case "final_defense":
        return "Final Defense";
      default:
        return stage;
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
          Panel Assignment & Defense Scheduling
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Assign panelists and schedule defense sessions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Approved Applications List */}
        <div className="space-y-2 lg:col-span-1">
          <p className="text-xs font-semibold text-(--earist-secondary)">
            Approved Applications ({approvedApplications.length})
          </p>
          {approvedApplications.map((app) => (
            <button
              key={app.id}
              onClick={() => {
                setSelectedApp(app.id);
                setChairmanId("");
                setLeadPanelistId("");
                setExternalPanelistId("");
                setDefenseDate("");
                setDefenseTime("");
                setTeamsLink("");
              }}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                selectedApp === app.id
                  ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                  : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {app.studentName}
                </p>
                <Badge
                  className={
                    app.stage === "title_defense"
                      ? "bg-blue-100 text-blue-700"
                      : app.stage === "proposal_defense"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-green-100 text-green-700"
                  }
                >
                  {getStageLabel(app.stage)}
                </Badge>
              </div>
              <p className="text-xs text-(--earist-body-text)">
                {app.studentNumber} &middot; {app.program}
              </p>
              <p className="text-xs text-(--earist-body-text)">
                Approved: {app.dateApproved}
              </p>
            </button>
          ))}
        </div>

        {/* Scheduling Form */}
        {selectedAppData ? (
          <div className="space-y-4 lg:col-span-2">
            {/* Student Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  {getStageLabel(selectedAppData.stage)} —{" "}
                  {selectedAppData.studentName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                  <p className="text-sm font-medium text-(--earist-primary)">
                    {selectedAppData.studentName}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    {selectedAppData.studentNumber} &middot;{" "}
                    {selectedAppData.program}
                  </p>
                  {selectedAppData.proposedTitles && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-(--earist-secondary)">
                        Proposed Titles:
                      </p>
                      {selectedAppData.proposedTitles.map((title, i) => (
                        <p
                          key={i}
                          className="text-xs text-(--earist-body-text)"
                        >
                          {i + 1}. {title}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Panel Assignment */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Assign Panelists
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Chairman</label>
                    <select value={chairmanId} onChange={(e) => setChairmanId(e.target.value)} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none">
                      <option value="">Select Chairman...</option>
                      {availablePanelists.map(p => <option key={p.id} value={p.id}>{p.name} - {p.specialization}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Lead Panelist</label>
                    <select value={leadPanelistId} onChange={(e) => setLeadPanelistId(e.target.value)} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none">
                      <option value="">Select Lead Panelist...</option>
                      {availablePanelists.map(p => <option key={p.id} value={p.id}>{p.name} - {p.specialization}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">External Panelist</label>
                    <select value={externalPanelistId} onChange={(e) => setExternalPanelistId(e.target.value)} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none">
                      <option value="">Select External Panelist...</option>
                      {availablePanelists.map(p => <option key={p.id} value={p.id}>{p.name} - {p.specialization}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Defense Schedule */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                  Defense Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                      Date
                    </label>
                    <input
                      type="date"
                      value={defenseDate}
                      onChange={(e) => setDefenseDate(e.target.value)}
                      className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                      Time
                    </label>
                    <input
                      type="time"
                      value={defenseTime}
                      onChange={(e) => setDefenseTime(e.target.value)}
                      className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                      MS Teams Link
                    </label>
                    <input
                      type="url"
                      value={teamsLink}
                      onChange={(e) => setTeamsLink(e.target.value)}
                      placeholder="https://teams.microsoft.com/l/meetup-join/..."
                      className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Preview Button */}
            <Button
              variant="outline"
              onClick={() => setShowEmailPreview(true)}
              className="w-full"
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview Email Notification
            </Button>

            {/* Schedule Button */}
            <Button
              disabled={!canSchedule}
              onClick={() => setShowConfirm(true)}
              className={`w-full py-6 text-base font-semibold ${
                canSchedule
                  ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              <CalendarClock className="mr-2 h-5 w-5" />
              Schedule Defense & Notify
            </Button>
            {!canSchedule && (
              <p className="text-center text-xs text-(--earist-body-text)">
                Select all 3 panelist roles and fill in date, time, and Teams
                link.
              </p>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <CalendarClock className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select an Application
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Click an approved application to assign panelists and
                    schedule the defense.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      {showEmailPreview && selectedAppData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Email Preview
              </h3>
              <button
                onClick={() => setShowEmailPreview(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {/* Recipients */}
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-xs font-semibold text-(--earist-secondary)">
                  Recipients
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    <Mail className="mr-1 h-3 w-3" />
                    {selectedAppData.studentName}
                  </Badge>
                  {[chairmanId, leadPanelistId, externalPanelistId].filter(Boolean).map((id) => {
                    const p = availablePanelists.find((ap) => ap.id === id);
                    return p ? (
                      <Badge key={id} variant="outline" className="text-xs">
                        <Mail className="mr-1 h-3 w-3" />
                        {p.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Email Content */}
              <div className="rounded-lg border border-(--earist-border-gray) p-4">
                <p className="mb-2 text-sm font-semibold text-(--earist-primary)">
                  Subject: Defense Schedule —{" "}
                  {getStageLabel(selectedAppData.stage)}
                </p>
                <div className="space-y-2 text-sm text-(--earist-body-text)">
                  <p>Dear [Recipient],</p>
                  <p>
                    This is to inform you that a{" "}
                    <span className="font-semibold">
                      {getStageLabel(selectedAppData.stage)}
                    </span>{" "}
                    has been scheduled.
                  </p>
                  <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                    <p className="font-semibold text-(--earist-primary)">
                      Defense Details
                    </p>
                    <p>Researcher: {selectedAppData.studentName}</p>
                    <p>Program: {selectedAppData.program}</p>
                    <p>
                      Date: {defenseDate || "[Date]"} at{" "}
                      {defenseTime || "[Time]"}
                    </p>
                    <p>MS Teams: {teamsLink || "[Link]"}</p>
                  </div>
                  {selectedAppData.proposedTitles && (
                    <div>
                      <p className="font-semibold text-(--earist-primary)">
                        Proposed Titles:
                      </p>
                      {selectedAppData.proposedTitles.map((title, i) => (
                        <p key={i}>
                          {i + 1}. {title}
                        </p>
                      ))}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-(--earist-primary)">
                      Panel Members:
                    </p>
                    {[chairmanId, leadPanelistId, externalPanelistId].filter(Boolean).map((id, i) => {
                      const roles = ["Chairman", "Lead Panelist", "External Panelist"];
                      const p = availablePanelists.find((ap) => ap.id === id);
                      return p ? (
                        <p key={id}>
                          {i + 1}. {p.name} - {roles[i]} ({p.specialization})
                        </p>
                      ) : null;
                    })}
                  </div>
                  <p>Please review the materials before the defense date.</p>
                  <p>Thank you.</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => setShowEmailPreview(false)}
                className="w-full"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && selectedAppData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Confirm Scheduling
              </h3>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {getStageLabel(selectedAppData.stage)} —{" "}
                  {selectedAppData.studentName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {defenseDate} at {defenseTime}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  3 panelist(s) assigned
                </p>
              </div>
              <p className="text-sm text-(--earist-body-text)">
                Email notifications will be sent to the researcher and all
                assigned panelists with the defense schedule and MS Teams link.
              </p>
              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedApp) return;
                  scheduleMutation.mutate({
                    thesisId: selectedApp,
                    payload: {
                      defenseDate,
                      defenseTime,
                      venueOrLink: teamsLink,
                      defenseType: selectedAppData.stage,
                      chairmanId,
                      leadPanelistId,
                      externalPanelistId,
                    },
                  });
                }}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Send className="mr-2 h-4 w-4" />
                {scheduleMutation.isPending
                  ? "Scheduling..."
                  : "Schedule & Notify"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
