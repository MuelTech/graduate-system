"use client";

import { useState, useEffect, useRef } from "react";
import { AuditLogItem } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ESignaturePad } from "@/components/defense-workspace/e-signature-pad";
import { normalizeUploadedSignatureImage } from "@/lib/user-signature";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  Search,
  Trash2,
  Award,
  Upload,
  PenTool,
  X,
} from "lucide-react";

type EmailTemplateItem = {
  key: string;
  subject: string;
  bodyHtml: string;
  description?: string;
  variables?: string;
};

type OfficialRoleKey = "dean" | "vpaa" | "president";

type InstitutionalOfficialEntry = {
  name: string;
  signatureData: string | null;
  updatedAt: string | null;
};

type InstitutionalOfficialsState = Record<OfficialRoleKey, InstitutionalOfficialEntry>;

const EMPTY_OFFICIALS: InstitutionalOfficialsState = {
  dean: { name: "", signatureData: null, updatedAt: null },
  vpaa: { name: "", signatureData: null, updatedAt: null },
  president: { name: "", signatureData: null, updatedAt: null },
};

const OFFICIAL_ROLE_META: Array<{
  key: OfficialRoleKey;
  title: string;
  forms: string;
  placeholder: string;
}> = [
  {
    key: "dean",
    title: "Dean, Graduate School",
    forms: "Appears on Defense Application (GS-006/007), Oral Exam Summary (GS-011), and Adviser Request (GS-020).",
    placeholder: "e.g., DR. JUAN DELA CRUZ",
  },
  {
    key: "vpaa",
    title: "Vice President for Academic Affairs (VPAA)",
    forms: "Appears on Defense Application (GS-006/007) Recommending Approval.",
    placeholder: "e.g., DR. MARIA SANTOS",
  },
  {
    key: "president",
    title: "University President",
    forms: "Appears on Defense Application (GS-006/007) Approved section.",
    placeholder: "e.g., ENGR. ROGELIO REYES",
  },
];

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

  // Audit Logs filters
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);

  // Institutional Officials state
  const [officialsDraft, setOfficialsDraft] =
    useState<InstitutionalOfficialsState | null>(null);
  const [activeSignaturePadRole, setActiveSignaturePadRole] =
    useState<OfficialRoleKey | null>(null);
  const [padDraftSignature, setPadDraftSignature] = useState("");
  const officialFileInputRefs = useRef<
    Partial<Record<OfficialRoleKey, HTMLInputElement | null>>
  >({});

  const tabs = [
    { id: "programs", label: "Programs", icon: BookOpen },
    { id: "chatbot", label: "AI Chatbot FAQ", icon: GraduationCap },
    { id: "email", label: "Email Templates", icon: Mail },
    { id: "strike", label: "STRIKE Settings", icon: Shield },
    { id: "academic_year", label: "Academic Year", icon: Calendar },
    { id: "officials", label: "Institutional Officials", icon: Award },
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
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["auditLogs", auditPage, auditSearch, auditActionFilter, auditStartDate, auditEndDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: auditPage.toString(),
        pageSize: "20",
        search: auditSearch,
        actionType: auditActionFilter,
        startDate: auditStartDate,
        endDate: auditEndDate,
      });
      return await apiClientRequest(`/settings/audit-logs?${params.toString()}`);
    },
    enabled: activeTab === "audit",
  });

  const auditLogs = auditData?.logs || [];
  const auditTotal = auditData?.total || 0;
  const auditTotalPages = Math.ceil(auditTotal / 20);

  // Delete single audit log
  const deleteLogMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClientRequest(`/settings/audit-logs/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Audit log deleted.");
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
      setSelectedLogs([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Bulk delete audit logs
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiClientRequest("/settings/audit-logs/delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
      setSelectedLogs([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Fetch Email Templates
  const { data: emailTemplates = [] } = useQuery({
    queryKey: ["emailTemplates"],
    queryFn: async () => {
      return await apiClientRequest("/settings/email-templates");
    },
    enabled: activeTab === "email",
  });

  // Fetch Institutional Officials
  const { data: officialsData, isLoading: officialsLoading } =
    useQuery<InstitutionalOfficialsState>({
      queryKey: ["institutionalOfficials"],
      queryFn: async () =>
        (await apiClientRequest(
          "/settings/institutional-officials",
        )) as InstitutionalOfficialsState,
      enabled: activeTab === "officials",
    });

  const effectiveOfficials: InstitutionalOfficialsState =
    officialsDraft ?? officialsData ?? EMPTY_OFFICIALS;

  const updateOfficialField = (
    role: OfficialRoleKey,
    patch: Partial<InstitutionalOfficialEntry>,
  ) => {
    setOfficialsDraft((prev) => {
      const base = prev ?? officialsData ?? EMPTY_OFFICIALS;
      return {
        ...base,
        [role]: {
          ...base[role],
          ...patch,
        },
      };
    });
  };

  const handleUploadOfficialSignature = async (
    role: OfficialRoleKey,
    file: File,
  ) => {
    try {
      const cleanedPng = await normalizeUploadedSignatureImage(file, {
        removeBackground: true,
        strength: "standard",
      });
      updateOfficialField(role, { signatureData: cleanedPng });
      setActiveSignaturePadRole(null);
      setPadDraftSignature("");
      toast.success("Signature image uploaded and paper background removed.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to process signature image.",
      );
    }
  };

  const saveOfficialsMutation = useMutation({
    mutationFn: async (state: InstitutionalOfficialsState) =>
      apiClientRequest("/settings/institutional-officials", {
        method: "PUT",
        body: JSON.stringify({
          dean: {
            name: state.dean.name,
            signatureData: state.dean.signatureData,
          },
          vpaa: {
            name: state.vpaa.name,
            signatureData: state.vpaa.signatureData,
          },
          president: {
            name: state.president.name,
            signatureData: state.president.signatureData,
          },
        }),
      }),
    onSuccess: (updated: InstitutionalOfficialsState) => {
      queryClient.setQueryData(["institutionalOfficials"], updated);
      setOfficialsDraft(null);
      setActiveSignaturePadRole(null);
      setPadDraftSignature("");
      toast.success("Institutional officials saved successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save institutional officials.");
    },
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
      toast.success("Email template saved successfully.");
      setEditingTemplate(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save email template.");
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
      toast.success("Settings saved successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings.");
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
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure system-wide parameters and settings"
      />

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
                        ? "bg-[#e02b20] text-white"
                        : "text-gray-600 hover:bg-gray-50 hover:text-[#333333]"
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

          {/* Institutional Officials Tab */}
          {activeTab === "officials" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold text-[#333333]">
                        Institutional Officials &amp; E-Signatures
                      </CardTitle>
                      <p className="mt-0.5 text-sm text-gray-500">
                        Configure the printed names and official e-signatures used on generated Defense Applications, Oral Examination Summaries, and Adviser Request forms.
                      </p>
                    </div>
                    {officialsDraft && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                        Unsaved changes
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {officialsLoading ? (
                    <div className="py-8 text-center text-sm text-gray-500">
                      Loading institutional officials...
                    </div>
                  ) : (
                    <>
                      {OFFICIAL_ROLE_META.map((meta) => {
                        const entry = effectiveOfficials[meta.key];
                        const isPadOpen = activeSignaturePadRole === meta.key;

                        return (
                          <div
                            key={meta.key}
                            className="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
                          >
                            <div>
                              <h3 className="text-sm font-bold text-[#333333]">
                                {meta.title}
                              </h3>
                              <p className="text-xs text-gray-500">{meta.forms}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label
                                  htmlFor={`official-name-${meta.key}`}
                                  className="text-xs font-semibold text-gray-700"
                                >
                                  Printed Full Name &amp; Title
                                </Label>
                                <Input
                                  id={`official-name-${meta.key}`}
                                  type="text"
                                  maxLength={120}
                                  value={entry.name}
                                  onChange={(e) =>
                                    updateOfficialField(meta.key, {
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder={meta.placeholder}
                                />
                                {entry.updatedAt && (
                                  <p className="text-[11px] text-gray-400">
                                    Last updated:{" "}
                                    {new Date(entry.updatedAt).toLocaleString()}
                                  </p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-700">
                                  Official E-Signature (PNG / JPEG)
                                </Label>
                                <div className="flex min-h-[76px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50/70 p-2">
                                  {entry.signatureData ? (
                                    <img
                                      src={entry.signatureData}
                                      alt={`${meta.title} signature preview`}
                                      className="max-h-14 w-auto object-contain"
                                    />
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      No signature configured (printed blank)
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      officialFileInputRefs.current[
                                        meta.key
                                      ]?.click()
                                    }
                                  >
                                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                                    Upload Image
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (isPadOpen) {
                                        setActiveSignaturePadRole(null);
                                        setPadDraftSignature("");
                                      } else {
                                        setActiveSignaturePadRole(meta.key);
                                        setPadDraftSignature("");
                                      }
                                    }}
                                  >
                                    <PenTool className="mr-1.5 h-3.5 w-3.5" />
                                    {isPadOpen
                                      ? "Close Pad"
                                      : "Draw Signature"}
                                  </Button>
                                  {entry.signatureData && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                      onClick={() =>
                                        updateOfficialField(meta.key, {
                                          signatureData: null,
                                        })
                                      }
                                    >
                                      <X className="mr-1 h-3.5 w-3.5" />
                                      Remove
                                    </Button>
                                  )}
                                  <input
                                    ref={(el) => {
                                      officialFileInputRefs.current[meta.key] = el;
                                    }}
                                    type="file"
                                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        void handleUploadOfficialSignature(
                                          meta.key,
                                          file,
                                        );
                                      }
                                      e.target.value = "";
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {isPadOpen && (
                              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                                <ESignaturePad
                                  value={padDraftSignature}
                                  onChange={setPadDraftSignature}
                                  allowUpload={false}
                                  enableProfileVault={false}
                                  readyText="Signature ready — click Apply Signature below."
                                  requiredText="Draw the official's signature above."
                                />
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setActiveSignaturePadRole(null);
                                      setPadDraftSignature("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={!padDraftSignature}
                                    onClick={() => {
                                      updateOfficialField(meta.key, {
                                        signatureData: padDraftSignature,
                                      });
                                      setActiveSignaturePadRole(null);
                                      setPadDraftSignature("");
                                    }}
                                  >
                                    Apply Signature
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        {officialsDraft && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={saveOfficialsMutation.isPending}
                            onClick={() => {
                              setOfficialsDraft(null);
                              setActiveSignaturePadRole(null);
                              setPadDraftSignature("");
                            }}
                          >
                            Discard Changes
                          </Button>
                        )}
                        <Button
                          type="button"
                          disabled={saveOfficialsMutation.isPending}
                          onClick={() =>
                            saveOfficialsMutation.mutate(effectiveOfficials)
                          }
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {saveOfficialsMutation.isPending
                            ? "Saving..."
                            : "Save Institutional Officials"}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Audit Logs Tab */}
          {activeTab === "audit" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-(--earist-primary)">System Audit Logs</CardTitle>
                    <p className="text-sm text-(--earist-body-text)">Track and manage all critical system modifications.</p>
                  </div>
                  <div className="flex gap-2">
                    {selectedLogs.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${selectedLogs.length} selected log(s)?`)) {
                            bulkDeleteMutation.mutate(selectedLogs);
                          }
                        }}
                        disabled={bulkDeleteMutation.isPending}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete ({selectedLogs.length})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="mb-4 flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400 -translate-y-1/2" />
                    <Input
                      placeholder="Search logs..."
                      value={auditSearch}
                      onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                      className="pl-9"
                    />
                  </div>
                  <select
                    value={auditActionFilter}
                    onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPage(1); }}
                    className="px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">All Actions</option>
                    <option value="setting_changed">Setting Changed</option>
                    <option value="user_promoted">User Promoted</option>
                    <option value="waiver_validated">Waiver Validated</option>
                    <option value="waiver_rejected">Waiver Rejected</option>
                    <option value="cor_verified">COR Verified</option>
                    <option value="cor_rejected">COR Rejected</option>
                    <option value="role_assigned">Role Assigned</option>
                    <option value="strikes_reset">Strikes Reset</option>
                  </select>
                  <Input
                    type="date"
                    value={auditStartDate}
                    onChange={(e) => { setAuditStartDate(e.target.value); setAuditPage(1); }}
                    className="w-[150px]"
                    placeholder="Start date"
                  />
                  <Input
                    type="date"
                    value={auditEndDate}
                    onChange={(e) => { setAuditEndDate(e.target.value); setAuditPage(1); }}
                    className="w-[150px]"
                    placeholder="End date"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAuditSearch("");
                      setAuditActionFilter("");
                      setAuditStartDate("");
                      setAuditEndDate("");
                      setAuditPage(1);
                    }}
                  >
                    Clear
                  </Button>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-lg border border-(--earist-border-gray)">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-(--earist-surface-gray)">
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLogs(auditLogs.map((l: AuditLogItem) => l.id));
                              } else {
                                setSelectedLogs([]);
                              }
                            }}
                            checked={selectedLogs.length === auditLogs.length && auditLogs.length > 0}
                          />
                        </TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-gray-500 animate-pulse">
                            Loading audit logs...
                          </TableCell>
                        </TableRow>
                      ) : auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-(--earist-body-text)">
                            No audit logs found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log: AuditLogItem) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedLogs.includes(log.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLogs([...selectedLogs, log.id]);
                                  } else {
                                    setSelectedLogs(selectedLogs.filter(id => id !== log.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-(--earist-body-text)">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System"}
                              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                {log.actor?.role || "SYSTEM"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-800">
                                {log.actionType}
                              </span>
                            </TableCell>
                            <TableCell className="text-(--earist-body-text)">
                              {log.description || `Modified ${log.targetTable || 'record'}`}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm("Delete this audit log?")) {
                                    deleteLogMutation.mutate(log.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {auditTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Showing {(auditPage - 1) * 20 + 1} to {Math.min(auditPage * 20, auditTotal)} of {auditTotal} logs
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setAuditPage(auditPage - 1)}
                            className={auditPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, auditTotalPages) }, (_, i) => {
                          let pageNum: number;
                          if (auditTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (auditPage <= 3) {
                            pageNum = i + 1;
                          } else if (auditPage >= auditTotalPages - 2) {
                            pageNum = auditTotalPages - 4 + i;
                          } else {
                            pageNum = auditPage - 2 + i;
                          }
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setAuditPage(pageNum)}
                                isActive={auditPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setAuditPage(auditPage + 1)}
                            className={auditPage === auditTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Other Tabs Placeholder */}
          {activeTab !== "academic_year" &&
            activeTab !== "audit" &&
            activeTab !== "email" &&
            activeTab !== "officials" && (
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
