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
  CalendarClock,
  Users,
  CheckCircle2,
  X,
  Send,
  ExternalLink,
  Mail,
  Eye,
  Plus,
  Trash2,
} from "lucide-react";

export default function AdminSchedulingPage() {
  const [selectedApp, setSelectedApp] = useState<number | null>(null);
  const [defenseDate, setDefenseDate] = useState("");
  const [defenseTime, setDefenseTime] = useState("");
  const [teamsLink, setTeamsLink] = useState("");
  const [selectedPanelists, setSelectedPanelists] = useState<number[]>([]);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const approvedApplications = [
    {
      id: 1,
      studentName: "Elena Torres",
      studentNumber: "2026-GS-00460",
      program: "MSCS",
      stage: "title_defense",
      dateApproved: "June 3, 2026",
      proposedTitles: [
        "Effectiveness of Blended Learning in Graduate Education",
        "Student Engagement Strategies in Online Thesis Advising",
        "Curriculum Mapping for Industry-Aligned Graduate Programs",
      ],
    },
    {
      id: 2,
      studentName: "Ana Garcia",
      studentNumber: "2026-GS-00459",
      program: "MAED",
      stage: "proposal_defense",
      dateApproved: "June 4, 2026",
      proposedTitles: null,
    },
    {
      id: 3,
      studentName: "Roberto Lim",
      studentNumber: "2026-GS-00461",
      program: "DIT",
      stage: "final_defense",
      dateApproved: "June 2, 2026",
      proposedTitles: null,
    },
  ];

  const availablePanelists = [
    { id: 1, name: "Dr. Roberto Reyes", type: "internal", specialization: "Machine Learning" },
    { id: 2, name: "Dr. Ana Garcia", type: "internal", specialization: "Education" },
    { id: 3, name: "Dr. Juan Dela Cruz", type: "internal", specialization: "Mathematics" },
    { id: 4, name: "Dr. Pedro Lim", type: "internal", specialization: "Educational Management" },
    { id: 5, name: "Dr. Maria Santos", type: "external", specialization: "IT" },
  ];

  const selectedAppData = approvedApplications.find((a) => a.id === selectedApp);

  const togglePanelist = (id: number) => {
    setSelectedPanelists((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

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

  const canSchedule = selectedPanelists.length >= 2 && defenseDate && defenseTime && teamsLink;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Panel Assignment & Defense Scheduling
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Assign panelists and schedule defense sessions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Approved Applications List */}
        <div className="space-y-2 lg:col-span-1">
          <p className="text-xs font-semibold text-[var(--earist-secondary)]">
            Approved Applications ({approvedApplications.length})
          </p>
          {approvedApplications.map((app) => (
            <button
              key={app.id}
              onClick={() => {
                setSelectedApp(app.id);
                setSelectedPanelists([]);
                setDefenseDate("");
                setDefenseTime("");
                setTeamsLink("");
              }}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                selectedApp === app.id
                  ? "border-[var(--earist-primary)] bg-[var(--earist-surface-light-red)]"
                  : "border-[var(--earist-border-gray)] hover:bg-[var(--earist-surface-gray)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--earist-primary)]">
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
              <p className="text-xs text-[var(--earist-body-text)]">
                {app.studentNumber} &middot; {app.program}
              </p>
              <p className="text-xs text-[var(--earist-body-text)]">
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
                <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                  {getStageLabel(selectedAppData.stage)} —{" "}
                  {selectedAppData.studentName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    {selectedAppData.studentName}
                  </p>
                  <p className="text-xs text-[var(--earist-body-text)]">
                    {selectedAppData.studentNumber} &middot;{" "}
                    {selectedAppData.program}
                  </p>
                  {selectedAppData.proposedTitles && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-[var(--earist-secondary)]">
                        Proposed Titles:
                      </p>
                      {selectedAppData.proposedTitles.map((title, i) => (
                        <p
                          key={i}
                          className="text-xs text-[var(--earist-body-text)]"
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                    Assign Panelists
                  </CardTitle>
                  <Badge
                    className={
                      selectedPanelists.length >= 2
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }
                  >
                    {selectedPanelists.length} selected (min 2)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {availablePanelists.map((panelist) => {
                    const isSelected = selectedPanelists.includes(panelist.id);
                    return (
                      <button
                        key={panelist.id}
                        onClick={() => togglePanelist(panelist.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-[var(--earist-primary)] bg-[var(--earist-surface-light-red)]"
                            : "border-[var(--earist-border-gray)] hover:bg-[var(--earist-surface-gray)]"
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            isSelected
                              ? "border-[var(--earist-primary)] bg-[var(--earist-primary)]"
                              : "border-[var(--earist-border-gray)]"
                          }`}
                        >
                          {isSelected && (
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[var(--earist-primary)]">
                            {panelist.name}
                          </p>
                          <p className="text-xs text-[var(--earist-body-text)]">
                            {panelist.specialization} &middot;{" "}
                            {panelist.type === "internal"
                              ? "Faculty"
                              : "External"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Defense Schedule */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                  Defense Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                      Date
                    </label>
                    <input
                      type="date"
                      value={defenseDate}
                      onChange={(e) => setDefenseDate(e.target.value)}
                      className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                      Time
                    </label>
                    <input
                      type="time"
                      value={defenseTime}
                      onChange={(e) => setDefenseTime(e.target.value)}
                      className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                      MS Teams Link
                    </label>
                    <input
                      type="url"
                      value={teamsLink}
                      onChange={(e) => setTeamsLink(e.target.value)}
                      placeholder="https://teams.microsoft.com/l/meetup-join/..."
                      className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none"
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
                  ? "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              <CalendarClock className="mr-2 h-5 w-5" />
              Schedule Defense & Notify
            </Button>
            {!canSchedule && (
              <p className="text-center text-xs text-[var(--earist-body-text)]">
                Select at least 2 panelists and fill in date, time, and Teams
                link.
              </p>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--earist-surface-gray)]">
                    <CalendarClock className="h-8 w-8 text-[var(--earist-body-text)]/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">
                    Select an Application
                  </h3>
                  <p className="text-sm text-[var(--earist-body-text)]">
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
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Email Preview
              </h3>
              <button
                onClick={() => setShowEmailPreview(false)}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {/* Recipients */}
              <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                <p className="text-xs font-semibold text-[var(--earist-secondary)]">
                  Recipients
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    <Mail className="mr-1 h-3 w-3" />
                    {selectedAppData.studentName}
                  </Badge>
                  {selectedPanelists.map((id) => {
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
              <div className="rounded-lg border border-[var(--earist-border-gray)] p-4">
                <p className="mb-2 text-sm font-semibold text-[var(--earist-primary)]">
                  Subject: Defense Schedule — {getStageLabel(selectedAppData.stage)}
                </p>
                <div className="space-y-2 text-sm text-[var(--earist-body-text)]">
                  <p>Dear [Recipient],</p>
                  <p>
                    This is to inform you that a{" "}
                    <span className="font-semibold">
                      {getStageLabel(selectedAppData.stage)}
                    </span>{" "}
                    has been scheduled.
                  </p>
                  <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                    <p className="font-semibold text-[var(--earist-primary)]">
                      Defense Details
                    </p>
                    <p>Researcher: {selectedAppData.studentName}</p>
                    <p>Program: {selectedAppData.program}</p>
                    <p>
                      Date: {defenseDate || "[Date]"} at{" "}
                      {defenseTime || "[Time]"}
                    </p>
                    <p>
                      MS Teams: {teamsLink || "[Link]"}
                    </p>
                  </div>
                  {selectedAppData.proposedTitles && (
                    <div>
                      <p className="font-semibold text-[var(--earist-primary)]">
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
                    <p className="font-semibold text-[var(--earist-primary)]">
                      Panel Members:
                    </p>
                    {selectedPanelists.map((id, i) => {
                      const p = availablePanelists.find((ap) => ap.id === id);
                      return p ? (
                        <p key={id}>
                          {i + 1}. {p.name} ({p.specialization})
                        </p>
                      ) : null;
                    })}
                  </div>
                  <p>
                    Please review the materials before the defense date.
                  </p>
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
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Confirm Scheduling
              </h3>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                <p className="text-sm font-semibold text-[var(--earist-primary)]">
                  {getStageLabel(selectedAppData.stage)} —{" "}
                  {selectedAppData.studentName}
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  {defenseDate} at {defenseTime}
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  {selectedPanelists.length} panelist(s) assigned
                </p>
              </div>
              <p className="text-sm text-[var(--earist-body-text)]">
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
                  setShowConfirm(false);
                  setSelectedApp(null);
                  setSelectedPanelists([]);
                  setDefenseDate("");
                  setDefenseTime("");
                  setTeamsLink("");
                }}
                className="flex-1 bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
              >
                <Send className="mr-2 h-4 w-4" />
                Schedule & Notify
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
