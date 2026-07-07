"use client";

import { useState, useEffect } from "react";
import { AuditLogItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  Settings,
  Calendar,
  Save,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Shield,
  FileText,
  Mail,
  Lock,
} from "lucide-react";

type EmailTemplateItem = {
  key: string;
  subject: string;
  bodyHtml: string;
  description?: string;
  variables?: string;
};

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("academic_year");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateItem | null>(null);

  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [semester, setSemester] = useState("second");
  const [enrollmentStart, setEnrollmentStart] = useState("");
  const [enrollmentEnd, setEnrollmentEnd] = useState("");
  const [titleDefenseStart, setTitleDefenseStart] = useState("");
  const [titleDefenseEnd, setTitleDefenseEnd] = useState("");
  const [proposalDefenseStart, setProposalDefenseStart] = useState("");
  const [proposalDefenseEnd, setProposalDefenseEnd] = useState("");
  const [finalDefenseStart, setFinalDefenseStart] = useState("");
  const [finalDefenseEnd, setFinalDefenseEnd] = useState("");

  const tabs = [
    { id: "programs", label: "Programs", icon: BookOpen },
    { id: "chatbot", label: "AI Chatbot FAQ", icon: GraduationCap },
    { id: "email", label: "Email Templates", icon: Mail },
    { id: "strike", label: "STRIKE Settings", icon: Shield },
    { id: "academic_year", label: "Academic Year", icon: Calendar },
    { id: "session", label: "Session & Security", icon: Lock },
    { id: "audit", label: "Audit Logs", icon: FileText },
  ];

  // 1. Fetch Settings
  const { data: settingsData } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: async () => {
      const res = await apiClientRequest("/settings");
      const map: Record<string, string> = {};
      res.forEach((s: { settingKey: string, settingValue: string }) => {
        map[s.settingKey] = s.settingValue;
      });
      return map;
    },
  });

  // Fetch Audit Logs (Only when the tab is clicked)
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: async () => {
      return await apiClientRequest("/settings/audit-logs");
    },
    enabled: activeTab === "audit", 
  });

  // Fetch Email Templates
  const { data: emailTemplates = [] } = useQuery({
    queryKey: ["emailTemplates"],
    queryFn: async () => {
      return await apiClientRequest("/settings/email-templates");
    },
    enabled: activeTab === "email",
  });

  // Helper to safely populate state without triggering the useEffect linter
  const populateForm = (data: Record<string, string>) => {
    if (data["ACADEMIC_YEAR"]) setAcademicYear(data["ACADEMIC_YEAR"]);
    if (data["SEMESTER"]) setSemester(data["SEMESTER"]);
    if (data["ENROLLMENT_START"]) setEnrollmentStart(data["ENROLLMENT_START"]);
    if (data["ENROLLMENT_END"]) setEnrollmentEnd(data["ENROLLMENT_END"]);
    if (data["TITLE_DEFENSE_START"]) setTitleDefenseStart(data["TITLE_DEFENSE_START"]);
    if (data["TITLE_DEFENSE_END"]) setTitleDefenseEnd(data["TITLE_DEFENSE_END"]);
    if (data["PROPOSAL_DEFENSE_START"]) setProposalDefenseStart(data["PROPOSAL_DEFENSE_START"]);
    if (data["PROPOSAL_DEFENSE_END"]) setProposalDefenseEnd(data["PROPOSAL_DEFENSE_END"]);
    if (data["FINAL_DEFENSE_START"]) setFinalDefenseStart(data["FINAL_DEFENSE_START"]);
    if (data["FINAL_DEFENSE_END"]) setFinalDefenseEnd(data["FINAL_DEFENSE_END"]);
  };

  // 2. Populate form when data loads
  useEffect(() => {
    if (settingsData) {
      setTimeout(() => {
        populateForm(settingsData);
      }, 0);
    }
  }, [settingsData]);

  // Save Email Template Mutation
  const emailMutation = useMutation({
    mutationFn: async (payload: { key: string; subject: string; bodyHtml: string }) => {
      await apiClientRequest(`/settings/email-templates/${payload.key}`, {
        method: "PUT",
        body: JSON.stringify({ subject: payload.subject, bodyHtml: payload.bodyHtml }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
      alert("Email template saved successfully!");
      setEditingTemplate(null);
    },
    onError: (error: Error) => {
      alert(error.message);
    }
  });

  // 3. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const promises = Object.entries(payload).map(([key, value]) =>
        apiClientRequest(`/settings/${key}`, {
          method: "PUT",
          body: JSON.stringify({ settingValue: value }),
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
      setShowSaveConfirm(false);
      alert("Settings saved successfully!");
    },
    onError: (error: Error) => {
      alert(error.message);
      setShowSaveConfirm(false);
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      "ACADEMIC_YEAR": academicYear,
      "SEMESTER": semester,
      "ENROLLMENT_START": enrollmentStart,
      "ENROLLMENT_END": enrollmentEnd,
      "TITLE_DEFENSE_START": titleDefenseStart,
      "TITLE_DEFENSE_END": titleDefenseEnd,
      "PROPOSAL_DEFENSE_START": proposalDefenseStart,
      "PROPOSAL_DEFENSE_END": proposalDefenseEnd,
      "FINAL_DEFENSE_START": finalDefenseStart,
      "FINAL_DEFENSE_END": finalDefenseEnd,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          System Settings
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Configure system-wide parameters and settings
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-2">
              <div className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-(--earist-primary) text-white"
                        : "text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                    }`}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {activeTab === "academic_year" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Current Academic Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                        Academic Year
                      </label>
                      <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      >
                        <option value="2024-2025">2024-2025</option>
                        <option value="2025-2026">2025-2026</option>
                        <option value="2026-2027">2026-2027</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                        Current Semester
                      </label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      >
                        <option value="first">First Semester</option>
                        <option value="second">Second Semester</option>
                        <option value="summer">Summer</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Enrollment Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={enrollmentStart}
                        onChange={(e) => setEnrollmentStart(e.target.value)}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={enrollmentEnd}
                        onChange={(e) => setEnrollmentEnd(e.target.value)}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Defense Period Windows
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-(--earist-border-gray) p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-(--earist-primary)">
                            Title Defense
                          </p>
                          <p className="text-xs text-(--earist-body-text)">
                            Period for filing Title Defense applications
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">Start Date</label>
                          <input
                            type="date"
                            value={titleDefenseStart}
                            onChange={(e) => setTitleDefenseStart(e.target.value)}
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">End Date</label>
                          <input
                            type="date"
                            value={titleDefenseEnd}
                            onChange={(e) => setTitleDefenseEnd(e.target.value)}
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-(--earist-border-gray) p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-50">
                          <FileText className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-(--earist-primary)">
                            Proposal Defense
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">Start Date</label>
                          <input
                            type="date"
                            value={proposalDefenseStart}
                            onChange={(e) => setProposalDefenseStart(e.target.value)}
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">End Date</label>
                          <input
                            type="date"
                            value={proposalDefenseEnd}
                            onChange={(e) => setProposalDefenseEnd(e.target.value)}
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-(--earist-border-gray) p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-green-50">
                          <FileText className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-(--earist-primary)">
                            Final Defense
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">Start Date</label>
                          <input
                            type="date"
                            value={finalDefenseStart}
                            onChange={(e) => setFinalDefenseStart(e.target.value)}
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">End Date</label>
                          <input
                            type="date"
                            value={finalDefenseEnd}
                            onChange={(e) => setFinalDefenseEnd(e.target.value)}
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={() => setShowSaveConfirm(true)}
                className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Academic Year Settings
              </Button>
            </div>
          )}

          {/* Email Templates Tab */}
          {activeTab === "email" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-(--earist-primary)">Email Templates</CardTitle>
                <p className="text-sm text-(--earist-body-text)">Customize the automated emails sent by the system.</p>
              </CardHeader>
              <CardContent>
                {editingTemplate ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-(--earist-primary)">Editing: {editingTemplate.key}</h4>
                      <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Subject</label>
                      <input 
                        type="text" 
                        value={editingTemplate.subject} 
                        onChange={(e) => setEditingTemplate({...editingTemplate, subject: e.target.value})}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Email Body (HTML)</label>
                      <textarea 
                        rows={10}
                        value={editingTemplate.bodyHtml} 
                        onChange={(e) => setEditingTemplate({...editingTemplate, bodyHtml: e.target.value})}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm font-mono focus:border-(--earist-primary) focus:outline-none"
                      />
                    </div>
                    {editingTemplate.variables && (
                      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                        <strong>Available Variables:</strong> {JSON.parse(editingTemplate.variables).join(", ")}
                      </div>
                    )}
                    <Button 
                      className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                      onClick={() => emailMutation.mutate({ 
                        key: editingTemplate.key, 
                        subject: editingTemplate.subject, 
                        bodyHtml: editingTemplate.bodyHtml 
                      })}
                      disabled={emailMutation.isPending}
                    >
                      {emailMutation.isPending ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Template</>}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emailTemplates.length === 0 ? (
                      <div className="py-8 text-center text-sm text-(--earist-body-text)">No email templates found.</div>
                    ) : (
                      emailTemplates.map((template: EmailTemplateItem) => (
                        <div key={template.key} className="flex items-center justify-between rounded-lg border border-(--earist-border-gray) p-4 hover:border-(--earist-primary)/50">
                          <div>
                            <p className="font-semibold text-(--earist-primary)">{template.key}</p>
                            <p className="text-xs text-(--earist-body-text)">{template.description}</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setEditingTemplate(template)}>
                            Edit
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Audit Logs Tab */}
          {activeTab === "audit" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-(--earist-primary)">System Audit Logs</CardTitle>
                <p className="text-sm text-(--earist-body-text)">Read-only record of all critical system modifications.</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-(--earist-border-gray)">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-(--earist-surface-gray) text-xs uppercase text-(--earist-secondary)">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Timestamp</th>
                        <th className="px-4 py-3 font-semibold">User</th>
                        <th className="px-4 py-3 font-semibold">Action</th>
                        <th className="px-4 py-3 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--earist-border-gray) bg-white">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-(--earist-body-text)">
                            No audit logs recorded yet.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log: AuditLogItem) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System"}
                              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                {log.actor?.role || "SYSTEM"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-800">
                                {log.actionType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {log.description || `Modified ${log.targetTable || 'record'}`}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other Tabs Placeholder */}
          {activeTab !== "academic_year" && activeTab !== "audit" && activeTab !== "email" && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <Settings className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    {tabs.find((t) => t.id === activeTab)?.label}
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    This settings tab is not yet wired, but the backend architecture is ready!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Save Settings
              </h3>
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">
                    Confirm Save
                  </p>
                </div>
                <p className="mt-2 text-xs text-green-600">
                  This will update the academic year parameters for all system users.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1"
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
