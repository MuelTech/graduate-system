"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { RefreshCw, RotateCcw, Send, Search, Eye, CheckCircle2 } from "lucide-react";

type TabId = "logs" | "templates" | "triggers";

interface DeliveryStats {
  total: number;
  sent: number;
  queued: number;
  processing: number;
  failed: number;
  deliveryRate: number;
  last24hSent: number;
  last24hFailed: number;
}

interface DeliveryHealth {
  mode: "smtp" | "dry_run" | "disabled";
  queueEngine: string;
  smtpConfigured: boolean;
  smtpHost: string | null;
  smtpPort: number;
  fromAddress: string;
  publicUrl: string;
  workerRunning: boolean;
}

interface EmailLogRow {
  id: string;
  recipient: string;
  recipientName: string | null;
  subject: string;
  templateKey: string | null;
  category: string | null;
  batchId: string | null;
  status: "QUEUED" | "PROCESSING" | "SENT" | "FAILED";
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface EmailLogDetail extends EmailLogRow {
  htmlBody: string | null;
  textBody: string | null;
  templateName: string | null;
  suggestedCurrentEmail?: string | null;
  triggeredBy?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface EmailTemplateRow {
  templateKey: string;
  name: string;
  category: string;
  categoryLabel: string;
  triggerEvent: string;
  recipientRole: string;
  variables: string[];
  subject: string;
  bodyHtml: string;
  isActive: boolean;
  isCustomized: boolean;
  updatedAt: string | null;
}

interface AutomatedTriggerRow {
  templateKey: string;
  name: string;
  category: string;
  categoryLabel: string;
  triggerEvent: string;
  recipientRole: string;
  isActive: boolean;
  deliveryType: string;
}

interface ScheduledJobRow {
  id: string;
  name: string;
  cronExpression: string;
  timezone: string;
  scheduleDescription: string;
  isActive: boolean;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "SENT", label: "Sent" },
  { value: "QUEUED", label: "Queued" },
  { value: "PROCESSING", label: "Processing" },
  { value: "FAILED", label: "Failed" },
];

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "All Categories" },
  { value: "ACCOUNTS", label: "Accounts & Security" },
  { value: "ADMISSIONS_EXAM", label: "Entrance Exam & COR" },
  { value: "ACADEMIC", label: "Academic & Comprehensive Exam" },
  { value: "THESIS_DEFENSE", label: "Thesis & Dissertation" },
  { value: "SYSTEM_TEST", label: "System Test" },
];

const DATE_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "ALL", label: "All Time" },
];

const STATUS_BADGE_STYLES: Record<EmailLogRow["status"], string> = {
  SENT: "border-emerald-200 bg-emerald-50 text-emerald-800",
  QUEUED: "border-amber-200 bg-amber-50 text-amber-800",
  PROCESSING: "border-blue-200 bg-blue-50 text-blue-800",
  FAILED: "border-red-200 bg-red-50 text-red-800",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRetryTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatModeLabel(mode?: DeliveryHealth["mode"]): string {
  if (mode === "smtp") return "Live SMTP";
  if (mode === "dry_run") return "Dry Run";
  if (mode === "disabled") return "Disabled";
  return "Checking...";
}

export default function AdminEmailManagerPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("logs");

  // Delivery Logs filters
  const [logPage, setLogPage] = useState(1);
  const [logStatus, setLogStatus] = useState("ALL");
  const [logCategory, setLogCategory] = useState("ALL");
  const [logDays, setLogDays] = useState("30");
  const [logSearch, setLogSearch] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // Resend Email Dialog
  const [resendTarget, setResendTarget] = useState<EmailLogRow | null>(null);
  const [resendRecipient, setResendRecipient] = useState("");

  // Templates filters & editor
  const [templateCategory, setTemplateCategory] = useState("ALL");
  const [templateSearch, setTemplateSearch] = useState("");
  const [editingTemplate, setEditingTemplate] =
    useState<EmailTemplateRow | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBodyHtml, setDraftBodyHtml] = useState("");
  const [draftIsActive, setDraftIsActive] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Test Email Dialog
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testTemplateKey, setTestTemplateKey] = useState<string>("NONE");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: healthData, refetch: refetchHealth } = useQuery<{
    health: DeliveryHealth;
    stats: DeliveryStats;
  }>({
    queryKey: ["adminEmailHealth"],
    queryFn: () => apiClientRequest("/admin/emails/health"),
    refetchInterval: 30_000,
  });

  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery<{
    data: EmailLogRow[];
    meta: { total: number; page: number; limit: number; totalPages: number };
    stats: DeliveryStats;
  }>({
    queryKey: ["adminEmailLogs", logPage, logStatus, logCategory, logDays, logSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(logPage),
        limit: "20",
      });
      if (logStatus !== "ALL") params.set("status", logStatus);
      if (logCategory !== "ALL") params.set("category", logCategory);
      if (logDays !== "ALL") params.set("days", logDays);
      if (logSearch.trim()) params.set("search", logSearch.trim());
      return apiClientRequest(`/admin/emails/logs?${params.toString()}`);
    },
    enabled: activeTab === "logs",
  });

  const activeDetailId = selectedLogId ?? resendTarget?.id ?? null;
  const { data: logDetail, isLoading: logDetailLoading } =
    useQuery<EmailLogDetail>({
      queryKey: ["adminEmailLogDetail", activeDetailId],
      queryFn: () => apiClientRequest(`/admin/emails/logs/${activeDetailId}`),
      enabled: Boolean(activeDetailId),
    });

  const { data: templatesData, isLoading: templatesLoading } = useQuery<{
    templates: EmailTemplateRow[];
  }>({
    queryKey: ["adminEmailTemplates"],
    queryFn: () => apiClientRequest("/admin/emails/templates"),
    enabled: activeTab === "templates" || testModalOpen,
  });

  const { data: triggersData, isLoading: triggersLoading } = useQuery<{
    health: DeliveryHealth;
    scheduledJobs: ScheduledJobRow[];
    triggers: AutomatedTriggerRow[];
  }>({
    queryKey: ["adminEmailTriggers"],
    queryFn: () => apiClientRequest("/admin/emails/triggers"),
    enabled: activeTab === "triggers",
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const verifySmtpMutation = useMutation({
    mutationFn: () =>
      apiClientRequest("/admin/emails/verify-smtp", { method: "POST" }),
    onSuccess: (res: { ok: boolean; message: string }) => {
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendTestMutation = useMutation({
    mutationFn: (payload: { to: string; templateKey?: string }) =>
      apiClientRequest("/admin/emails/test", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (res: { status: string; message: string }) => {
      if (res.status === "SENT") {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      setTestModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["adminEmailLogs"] });
      queryClient.invalidateQueries({ queryKey: ["adminEmailHealth"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const retrySingleMutation = useMutation({
    mutationFn: (logId: string) =>
      apiClientRequest(`/admin/emails/logs/${logId}/retry`, { method: "POST" }),
    onSuccess: (res: { message: string }) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["adminEmailLogs"] });
      queryClient.invalidateQueries({ queryKey: ["adminEmailHealth"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resendEmailMutation = useMutation({
    mutationFn: (payload: { logId: string; recipient: string }) =>
      apiClientRequest(`/admin/emails/logs/${payload.logId}/resend`, {
        method: "POST",
        body: JSON.stringify({ recipient: payload.recipient }),
      }),
    onSuccess: (res: { message: string }) => {
      toast.success(res.message);
      setResendTarget(null);
      setResendRecipient("");
      queryClient.invalidateQueries({ queryKey: ["adminEmailLogs"] });
      queryClient.invalidateQueries({ queryKey: ["adminEmailHealth"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openResendDialog = (log: EmailLogRow) => {
    setSelectedLogId(null);
    setResendTarget(log);
    setResendRecipient(log.recipient);
  };

  const retryAllFailedMutation = useMutation({
    mutationFn: () =>
      apiClientRequest("/admin/emails/logs/retry-failed", {
        method: "POST",
        body: JSON.stringify(
          logCategory !== "ALL" ? { category: logCategory } : {},
        ),
      }),
    onSuccess: (res: { message: string }) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["adminEmailLogs"] });
      queryClient.invalidateQueries({ queryKey: ["adminEmailHealth"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (payload: {
      templateKey: string;
      subject?: string;
      bodyHtml?: string;
      isActive?: boolean;
    }) =>
      apiClientRequest(`/admin/emails/templates/${payload.templateKey}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
          ...(payload.bodyHtml !== undefined ? { bodyHtml: payload.bodyHtml } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        }),
      }),
    onSuccess: (res: { message: string; template: EmailTemplateRow }) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["adminEmailTemplates"] });
      queryClient.invalidateQueries({ queryKey: ["adminEmailTriggers"] });
      if (editingTemplate && editingTemplate.templateKey === res.template.templateKey) {
        setEditingTemplate(res.template);
        setDraftSubject(res.template.subject);
        setDraftBodyHtml(res.template.bodyHtml);
        setDraftIsActive(res.template.isActive);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetTemplateMutation = useMutation({
    mutationFn: (templateKey: string) =>
      apiClientRequest(`/admin/emails/templates/${templateKey}/reset`, {
        method: "POST",
      }),
    onSuccess: (res: { message: string; template: EmailTemplateRow }) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["adminEmailTemplates"] });
      setEditingTemplate(res.template);
      setDraftSubject(res.template.subject);
      setDraftBodyHtml(res.template.bodyHtml);
      setDraftIsActive(res.template.isActive);
      void loadPreview(
        res.template.templateKey,
        res.template.subject,
        res.template.bodyHtml,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runRemindersMutation = useMutation({
    mutationFn: () =>
      apiClientRequest("/admin/emails/triggers/run-exam-reminders", {
        method: "POST",
      }),
    onSuccess: (res: { message: string }) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["adminEmailLogs"] });
      queryClient.invalidateQueries({ queryKey: ["adminEmailHealth"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Live Template Preview Helper ───────────────────────────────────────────
  const loadPreview = async (
    templateKey: string,
    subject: string,
    bodyHtml: string,
  ) => {
    setPreviewLoading(true);
    try {
      const rendered = (await apiClientRequest(
        `/admin/emails/templates/${templateKey}/preview`,
        {
          method: "POST",
          body: JSON.stringify({ subject, bodyHtml }),
        },
      )) as { subject: string; html: string };
      setPreviewSubject(rendered.subject);
      setPreviewHtml(rendered.html);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to render preview.",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const openTemplateEditor = (tpl: EmailTemplateRow) => {
    setEditingTemplate(tpl);
    setDraftSubject(tpl.subject);
    setDraftBodyHtml(tpl.bodyHtml);
    setDraftIsActive(tpl.isActive);
    void loadPreview(tpl.templateKey, tpl.subject, tpl.bodyHtml);
  };

  const stats = logsData?.stats ?? healthData?.stats;
  const health = healthData?.health;
  const templates = templatesData?.templates ?? [];

  const filteredTemplates = templates.filter((tpl) => {
    if (templateCategory !== "ALL" && tpl.category !== templateCategory) {
      return false;
    }
    if (templateSearch.trim()) {
      const q = templateSearch.trim().toLowerCase();
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.templateKey.toLowerCase().includes(q) ||
        tpl.triggerEvent.toLowerCase().includes(q) ||
        tpl.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const groupedTemplates = filteredTemplates.reduce<
    Record<string, EmailTemplateRow[]>
  >((acc, tpl) => {
    const label = tpl.categoryLabel;
    if (!acc[label]) acc[label] = [];
    acc[label].push(tpl);
    return acc;
  }, {});

  const openTestModal = (presetTemplateKey?: string) => {
    setTestTemplateKey(presetTemplateKey ?? "NONE");
    setTestModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Manager"
        description="Monitor transactional email delivery, manage EARIST templates, and review automated triggers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={verifySmtpMutation.isPending}
              onClick={() => verifySmtpMutation.mutate()}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {verifySmtpMutation.isPending ? "Checking..." : "Verify SMTP"}
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[#8b1a1a] text-white hover:bg-[#6e1414]"
              onClick={() => openTestModal()}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Send Test Email
            </Button>
          </div>
        }
      />

      {/* Compact Delivery Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs text-gray-600">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span>
            <strong className="text-gray-900">Delivery:</strong>{" "}
            <Badge
              variant="outline"
              className={
                health?.mode === "smtp"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }
            >
              {formatModeLabel(health?.mode)}
            </Badge>
          </span>
          <span>
            <strong className="text-gray-900">SMTP:</strong>{" "}
            {health?.smtpConfigured
              ? `${health.smtpHost}:${health.smtpPort}`
              : "Not configured"}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-gray-600"
          onClick={() => {
            void refetchHealth();
            void refetchLogs();
          }}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Primary Section Tabs */}
      <div className="flex border-b border-gray-200">
        {(
          [
            { id: "logs", label: "Delivery Logs" },
            { id: "templates", label: "Templates" },
            { id: "triggers", label: "Automated Triggers" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== "templates") setEditingTemplate(null);
            }}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-[#8b1a1a] text-[#8b1a1a]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: DELIVERY LOGS ──────────────────────────────────────────── */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card>
              <CardContent className="px-4 py-3">
                <p className="text-xs font-medium text-gray-500">Total Emails</p>
                <p className="mt-0.5 text-xl font-bold text-gray-900">
                  {stats?.total ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-4 py-3">
                <p className="text-xs font-medium text-gray-500">Sent</p>
                <p className="mt-0.5 text-xl font-bold text-emerald-700">
                  {stats?.sent ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-4 py-3">
                <p className="text-xs font-medium text-gray-500">Queued</p>
                <p className="mt-0.5 text-xl font-bold text-amber-700">
                  {(stats?.queued ?? 0) + (stats?.processing ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="px-4 py-3">
                <p className="text-xs font-medium text-gray-500">Failed</p>
                <p className="mt-0.5 text-xl font-bold text-red-700">
                  {stats?.failed ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="px-4 py-3">
                <p className="text-xs font-medium text-gray-500">
                  Delivery Rate
                </p>
                <p className="mt-0.5 text-xl font-bold text-gray-900">
                  {stats?.deliveryRate ?? 100}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Retry All Failed */}
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1 max-w-sm">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={logSearch}
                      onChange={(e) => {
                        setLogSearch(e.target.value);
                        setLogPage(1);
                      }}
                      placeholder="Search recipient, subject, or template..."
                      className="h-9 pl-9 text-sm"
                    />
                  </div>
                  <Select
                    value={logStatus}
                    onValueChange={(val) => {
                      setLogStatus(val ?? "ALL");
                      setLogPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[160px] text-sm">
                      <span className="truncate text-left">
                        {STATUS_OPTIONS.find((o) => o.value === logStatus)
                          ?.label ?? "All Statuses"}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      alignItemWithTrigger={false}
                      className="w-(--anchor-width)"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={logCategory}
                    onValueChange={(val) => {
                      setLogCategory(val ?? "ALL");
                      setLogPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[230px] text-sm">
                      <span className="truncate text-left">
                        {CATEGORY_OPTIONS.find((o) => o.value === logCategory)
                          ?.label ?? "All Categories"}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      alignItemWithTrigger={false}
                      className="w-(--anchor-width)"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={logDays}
                    onValueChange={(val) => {
                      setLogDays(val ?? "30");
                      setLogPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[150px] text-sm">
                      <span className="truncate text-left">
                        {DATE_RANGE_OPTIONS.find((o) => o.value === logDays)
                          ?.label ?? "Last 30 Days"}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      alignItemWithTrigger={false}
                      className="w-(--anchor-width)"
                    >
                      {DATE_RANGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(stats?.failed ?? 0) > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={retryAllFailedMutation.isPending}
                    onClick={() => retryAllFailedMutation.mutate()}
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {retryAllFailedMutation.isPending
                      ? "Retrying..."
                      : `Retry All Failed (${stats?.failed ?? 0})`}
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto rounded-md border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="text-xs font-semibold">
                        Timestamp
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Recipient
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Subject
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Attempts
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Status
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-10 text-center text-sm text-gray-500"
                        >
                          Loading delivery logs...
                        </TableCell>
                      </TableRow>
                    ) : (logsData?.data.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-10 text-center text-sm text-gray-500"
                        >
                          No email delivery records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logsData!.data.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-xs text-gray-600">
                            {formatDateTime(log.sentAt ?? log.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium text-gray-900">
                              {log.recipientName || log.recipient}
                            </div>
                            {log.recipientName && (
                              <div className="text-xs text-gray-500">
                                {log.recipient}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[320px] text-sm text-gray-800">
                            <div className="truncate font-medium">
                              {log.subject}
                            </div>
                            {log.errorMessage && (
                              <div className="mt-0.5 truncate text-xs text-red-600">
                                {log.errorMessage}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-gray-600">
                            {log.attemptCount}/{log.maxAttempts}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1">
                              <Badge
                                variant="outline"
                                className={STATUS_BADGE_STYLES[log.status]}
                              >
                                {log.status}
                              </Badge>
                              {log.status === "QUEUED" &&
                                log.attemptCount > 0 &&
                                log.nextAttemptAt && (
                                  <span className="whitespace-nowrap text-[11px] text-amber-700">
                                    Next retry: {formatRetryTime(log.nextAttemptAt)}
                                  </span>
                                )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs"
                                onClick={() => setSelectedLogId(log.id)}
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                View
                              </Button>
                              {(log.status === "SENT" || log.status === "FAILED") &&
                                log.templateKey !== "password_reset_link" && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs text-[#8b1a1a] hover:bg-[#8b1a1a]/5"
                                    onClick={() => openResendDialog(log)}
                                  >
                                    <Send className="mr-1 h-3 w-3" />
                                    Resend
                                  </Button>
                                )}
                              {log.status === "FAILED" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 border-red-200 px-2.5 text-xs text-red-700 hover:bg-red-50"
                                  disabled={retrySingleMutation.isPending}
                                  onClick={() =>
                                    retrySingleMutation.mutate(log.id)
                                  }
                                >
                                  Retry
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {logsData && logsData.meta.totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>
                    Page {logsData.meta.page} of {logsData.meta.totalPages} (
                    {logsData.meta.total} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logPage <= 1}
                      onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logPage >= logsData.meta.totalPages}
                      onClick={() => setLogPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 2: TEMPLATES ──────────────────────────────────────────────── */}
      {activeTab === "templates" &&
        (editingTemplate ? (
          <Card>
            <CardHeader className="border-b border-gray-100 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-[#8b1a1a] uppercase">
                    {editingTemplate.categoryLabel}
                  </p>
                  <CardTitle className="mt-0.5 text-lg font-bold text-gray-900">
                    {editingTemplate.name}
                  </CardTitle>
                  <p className="mt-1 text-xs text-gray-500">
                    {editingTemplate.triggerEvent} &middot; Recipient:{" "}
                    {editingTemplate.recipientRole}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openTestModal(editingTemplate.templateKey)}
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Send Test
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={resetTemplateMutation.isPending}
                    onClick={() =>
                      resetTemplateMutation.mutate(editingTemplate.templateKey)
                    }
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset Default
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTemplate(null)}
                  >
                    Back to Templates
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-6 p-6 lg:grid-cols-2">
              {/* Left: Editor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50/60 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Automated Delivery
                    </p>
                    <p className="text-xs text-gray-500">
                      {draftIsActive
                        ? "Active — emails will enqueue automatically when triggered."
                        : "Paused — this email trigger is temporarily suppressed."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={draftIsActive ? "outline" : "default"}
                    className={
                      draftIsActive
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : "bg-gray-700 text-white hover:bg-gray-800"
                    }
                    onClick={() => setDraftIsActive((prev) => !prev)}
                  >
                    {draftIsActive ? "Active" : "Paused"}
                  </Button>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Subject Line
                  </label>
                  <Input
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Message Body (HTML)
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[#8b1a1a]"
                      disabled={previewLoading}
                      onClick={() =>
                        void loadPreview(
                          editingTemplate.templateKey,
                          draftSubject,
                          draftBodyHtml,
                        )
                      }
                    >
                      {previewLoading ? "Rendering..." : "Update Preview"}
                    </Button>
                  </div>
                  <textarea
                    rows={12}
                    value={draftBodyHtml}
                    onChange={(e) => setDraftBodyHtml(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-3 font-mono text-xs leading-relaxed text-gray-800 focus:border-[#8b1a1a] focus:outline-none"
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Available Variables (Click to append to body)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {editingTemplate.variables.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setDraftBodyHtml((prev) => `${prev}{{${v}}}`)
                        }
                        className="rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700 hover:border-[#8b1a1a] hover:text-[#8b1a1a]"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingTemplate(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="bg-[#8b1a1a] text-white hover:bg-[#6e1414]"
                    disabled={saveTemplateMutation.isPending}
                    onClick={() =>
                      saveTemplateMutation.mutate({
                        templateKey: editingTemplate.templateKey,
                        subject: draftSubject,
                        bodyHtml: draftBodyHtml,
                        isActive: draftIsActive,
                      })
                    }
                  >
                    {saveTemplateMutation.isPending
                      ? "Saving..."
                      : "Save Template"}
                  </Button>
                </div>
              </div>

              {/* Right: Branded Preview */}
              <div className="flex flex-col space-y-2">
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <strong className="text-gray-900">Rendered Subject:</strong>{" "}
                  {previewSubject || draftSubject}
                </div>
                <div className="min-h-[460px] flex-1 overflow-hidden rounded-md border border-gray-200 bg-[#f6f3ee]">
                  {previewHtml ? (
                    <iframe
                      title="Email Template Preview"
                      srcDoc={previewHtml}
                      sandbox=""
                      className="h-[520px] w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="flex h-[460px] items-center justify-center text-xs text-gray-500">
                      Loading preview...
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.filter((c) => c.value !== "SYSTEM_TEST").map(
                  (cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setTemplateCategory(cat.value)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        templateCategory === cat.value
                          ? "border-[#8b1a1a] bg-[#8b1a1a] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ),
                )}
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Filter templates..."
                  className="h-9 pl-9 text-sm"
                />
              </div>
            </div>

            {templatesLoading ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-gray-500">
                  Loading templates...
                </CardContent>
              </Card>
            ) : Object.keys(groupedTemplates).length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-gray-500">
                  No email templates match your filter.
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedTemplates).map(([groupLabel, items]) => (
                <Card key={groupLabel}>
                  <CardHeader className="border-b border-gray-100 py-3">
                    <CardTitle className="text-sm font-bold text-gray-900">
                      {groupLabel}{" "}
                      <span className="ml-1 text-xs font-normal text-gray-500">
                        ({items.length})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-gray-100 p-0">
                    {items.map((tpl) => (
                      <div
                        key={tpl.templateKey}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-gray-50/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {tpl.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                tpl.isActive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-gray-200 bg-gray-100 text-gray-600"
                              }
                            >
                              {tpl.isActive ? "Active" : "Paused"}
                            </Badge>
                            {tpl.isCustomized && (
                              <Badge
                                variant="outline"
                                className="border-amber-200 bg-amber-50 text-amber-800"
                              >
                                Customized
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {tpl.triggerEvent} &middot; {tpl.recipientRole}
                          </p>
                          <p className="mt-1 truncate text-xs text-gray-700">
                            <span className="font-medium text-gray-500">
                              Subject:
                            </span>{" "}
                            {tpl.subject}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={saveTemplateMutation.isPending}
                            onClick={() =>
                              saveTemplateMutation.mutate({
                                templateKey: tpl.templateKey,
                                isActive: !tpl.isActive,
                              })
                            }
                          >
                            {tpl.isActive ? "Pause" : "Activate"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => openTemplateEditor(tpl)}
                          >
                            Edit &amp; Preview
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ))}

      {/* ── TAB 3: AUTOMATED TRIGGERS ─────────────────────────────────────── */}
      {activeTab === "triggers" && (
        <div className="space-y-4">
          {/* Scheduled Daily Reminder Card */}
          <Card>
            <CardHeader className="border-b border-gray-100 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold text-gray-900">
                    Scheduled Background Jobs
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Deduplicated daily schedule running automatically inside the
                    GS-IS backend service.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={runRemindersMutation.isPending}
                  onClick={() => runRemindersMutation.mutate()}
                >
                  {runRemindersMutation.isPending
                    ? "Checking..."
                    : "Run 24-Hour Reminder Check Now"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {(triggersData?.scheduledJobs ?? []).map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{job.name}</p>
                    <p className="text-xs text-gray-500">
                      {job.scheduleDescription} &middot; Timezone:{" "}
                      {job.timezone}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      job.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 bg-gray-100 text-gray-600"
                    }
                  >
                    {job.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Full Automated Trigger Matrix */}
          <Card>
            <CardHeader className="border-b border-gray-100 py-3.5">
              <CardTitle className="text-sm font-bold text-gray-900">
                Transactional Email Triggers (
                {triggersData?.triggers.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="text-xs font-semibold">
                        Notification
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Cycle
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Recipient
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Trigger Condition
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {triggersLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-10 text-center text-sm text-gray-500"
                        >
                          Loading automated triggers...
                        </TableCell>
                      </TableRow>
                    ) : (
                      (triggersData?.triggers ?? []).map((item) => (
                        <TableRow key={item.templateKey}>
                          <TableCell className="text-sm font-medium text-gray-900">
                            {item.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-gray-600">
                            {item.categoryLabel}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-gray-700">
                            {item.recipientRole}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">
                            {item.triggerEvent}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                item.isActive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-gray-200 bg-gray-100 text-gray-600"
                              }
                            >
                              {item.isActive ? "Active" : "Paused"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MODAL: LOG DETAIL & RENDERED HTML ─────────────────────────────── */}
      <Dialog
        open={Boolean(selectedLogId)}
        onOpenChange={(open) => {
          if (!open) setSelectedLogId(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              Email Delivery Details
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Inspect metadata, delivery status, and exact rendered message.
            </DialogDescription>
          </DialogHeader>
          {logDetailLoading || !logDetail ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Loading details...
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-md border border-gray-200 bg-gray-50/70 p-3 text-xs">
                <div>
                  <span className="text-gray-500">Recipient:</span>{" "}
                  <strong className="text-gray-900">
                    {logDetail.recipientName
                      ? `${logDetail.recipientName} <${logDetail.recipient}>`
                      : logDetail.recipient}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>{" "}
                  <Badge
                    variant="outline"
                    className={STATUS_BADGE_STYLES[logDetail.status]}
                  >
                    {logDetail.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-500">Template:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {logDetail.templateName ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Attempts:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {logDetail.attemptCount} of {logDetail.maxAttempts}
                  </span>
                  {logDetail.status === "QUEUED" &&
                    logDetail.attemptCount > 0 &&
                    logDetail.nextAttemptAt && (
                      <span className="ml-2 text-amber-700">
                        (Next retry: {formatRetryTime(logDetail.nextAttemptAt)})
                      </span>
                    )}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Subject:</span>{" "}
                  <strong className="text-gray-900">{logDetail.subject}</strong>
                </div>
                {logDetail.errorMessage && (
                  <div className="col-span-2 rounded border border-red-200 bg-red-50 p-2 text-red-800">
                    <strong>Delivery Error:</strong> {logDetail.errorMessage}
                  </div>
                )}
              </div>

              {logDetail.htmlBody ? (
                <div className="overflow-hidden rounded-md border border-gray-200">
                  <iframe
                    title="Sent Email Content"
                    srcDoc={logDetail.htmlBody}
                    sandbox=""
                    className="h-[380px] w-full border-0 bg-white"
                  />
                </div>
              ) : (
                <p className="rounded border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
                  No stored HTML body is available for this legacy record.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            {logDetail &&
              (logDetail.status === "SENT" || logDetail.status === "FAILED") &&
              logDetail.htmlBody &&
              logDetail.templateKey !== "password_reset_link" && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-[#8b1a1a] hover:bg-[#8b1a1a]/5"
                  onClick={() => openResendDialog(logDetail)}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Resend Email
                </Button>
              )}
            {logDetail?.status === "FAILED" && logDetail.htmlBody && (
              <Button
                type="button"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                disabled={retrySingleMutation.isPending}
                onClick={() => {
                  retrySingleMutation.mutate(logDetail.id);
                  setSelectedLogId(null);
                }}
              >
                Retry Delivery
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedLogId(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: RESEND TO ORIGINAL OR CORRECTED EMAIL ─────────────────── */}
      <Dialog
        open={Boolean(resendTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setResendTarget(null);
            setResendRecipient("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              Resend Email Notification
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Deliver this exact notification again to the original address or a
              corrected email address.
            </DialogDescription>
          </DialogHeader>
          {resendTarget && (
            <div className="space-y-4">
              <div className="space-y-1.5 rounded-md border border-gray-200 bg-gray-50/70 p-3 text-xs">
                <div>
                  <span className="text-gray-500">Original Recipient:</span>{" "}
                  <strong className="text-gray-900">
                    {resendTarget.recipientName
                      ? `${resendTarget.recipientName} <${resendTarget.recipient}>`
                      : resendTarget.recipient}
                  </strong>
                </div>
                <div className="truncate">
                  <span className="text-gray-500">Subject:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {resendTarget.subject}
                  </span>
                </div>
              </div>

              {logDetail?.id === resendTarget.id &&
                logDetail.suggestedCurrentEmail && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                    <div className="min-w-0">
                      <span className="font-semibold">Updated profile email:</span>{" "}
                      <span className="truncate font-mono">
                        {logDetail.suggestedCurrentEmail}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 border-amber-300 bg-white px-2.5 text-xs text-amber-900 hover:bg-amber-100"
                      onClick={() =>
                        setResendRecipient(logDetail.suggestedCurrentEmail!)
                      }
                    >
                      Use This
                    </Button>
                  </div>
                )}

              <div>
                <label
                  htmlFor="resend-email-to"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                >
                  Recipient Email Address
                </label>
                <Input
                  id="resend-email-to"
                  type="email"
                  value={resendRecipient}
                  onChange={(e) => setResendRecipient(e.target.value)}
                  placeholder="recipient@example.com"
                  className="h-9 text-sm"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                  Creates a new delivery log entry without altering the original
                  record. If the user&apos;s email had a typo, update their
                  profile in User Management so future notifications go to the
                  corrected address.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResendTarget(null);
                setResendRecipient("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !resendTarget ||
                !resendRecipient.trim() ||
                resendEmailMutation.isPending
              }
              onClick={() => {
                if (!resendTarget) return;
                resendEmailMutation.mutate({
                  logId: resendTarget.id,
                  recipient: resendRecipient.trim(),
                });
              }}
              className="bg-[#8b1a1a] text-white hover:bg-[#701414]"
            >
              {resendEmailMutation.isPending ? "Sending..." : "Resend Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: SEND TEST EMAIL ────────────────────────────────────────── */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              Send Test Email
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Verify formatting and SMTP delivery to any inbox (such as your
              testmail.app address).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="test-email-to"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
              >
                Recipient Email Address
              </label>
              <Input
                id="test-email-to"
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="namespace.qa@inbox.testmail.app"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                Template (Optional)
              </label>
              <Select
                value={testTemplateKey}
                onValueChange={(val) => setTestTemplateKey(val ?? "NONE")}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <span className="truncate text-left">
                    {testTemplateKey === "NONE"
                      ? "Connectivity Test (Default)"
                      : (templates.find((t) => t.templateKey === testTemplateKey)
                          ?.name ?? "Connectivity Test (Default)")}
                  </span>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="max-h-64 w-(--anchor-width) overflow-y-auto"
                >
                  <SelectItem value="NONE">
                    Connectivity Test (Default)
                  </SelectItem>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.templateKey} value={tpl.templateKey}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#8b1a1a] text-white hover:bg-[#6e1414]"
              disabled={sendTestMutation.isPending || !testRecipient.trim()}
              onClick={() =>
                sendTestMutation.mutate({
                  to: testRecipient.trim(),
                  ...(testTemplateKey !== "NONE"
                    ? { templateKey: testTemplateKey }
                    : {}),
                })
              }
            >
              {sendTestMutation.isPending ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
