"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ApprovedApplicationDto,
  CommitteePolicyDto,
  DefensePanelRole,
  MissingRequirement,
  PaginatedResponse,
  Program,
} from "@/types";
import {
  SchedulingQueuePanel,
  type SchedulingQueueTab,
} from "@/components/admin/defense-scheduling/scheduling-queue-panel";
import { DefenseSummaryCard } from "@/components/admin/defense-scheduling/defense-summary-card";
import { DefenseCommitteeBuilder } from "@/components/admin/defense-scheduling/defense-committee-builder";
import { DefenseScheduleForm } from "@/components/admin/defense-scheduling/defense-schedule-form";
import { DefenseReviewSummary } from "@/components/admin/defense-scheduling/defense-review-summary";
import { EmailPreviewDialog } from "@/components/admin/defense-scheduling/email-preview-dialog";
import { ScheduledDefenseDetail } from "@/components/admin/defense-scheduling/scheduled-defense-detail";
import {
  computeCommitteeReadiness,
  defenseTypeFromStage,
  defenseTypeLabel,
  personToMember,
  programTypeLabel,
  stageFromDefenseType,
  type CommitteeMember,
  type PickerPerson,
  type ScheduleFormState,
} from "@/components/admin/defense-scheduling/types";
import {
  formatDefenseDate,
  formatDefenseTime,
} from "@/components/admin/defense-applications/labels";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

const EMPTY_SCHEDULE: ScheduleFormState = {
  defenseDate: "",
  defenseTime: "",
  venueOrLink: "",
};

type WorkflowSummary = {
  NEEDS_REVIEW: number;
  READY: number;
  ACTIVE: number;
  HISTORY: number;
};

export default function AdminSchedulingPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading scheduling…</div>}>
      <AdminSchedulingPageInner />
    </Suspense>
  );
}

function AdminSchedulingPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const thesisIdFromQuery = searchParams.get("thesisId");
  const scheduleIdFromQuery = searchParams.get("scheduleId");
  // §18: scheduleId takes precedence over thesisId for the exact session view.
  const effectiveThesisId = scheduleIdFromQuery ? null : thesisIdFromQuery;
  // The URL is the single source of truth for the selected scheduled session.
  const selectedScheduleId = scheduleIdFromQuery;

  const [activeTab, setActiveTab] = useState<SchedulingQueueTab>(
    scheduleIdFromQuery ? "SCHEDULED" : "READY",
  );
  const [selectedApp, setSelectedApp] =
    useState<ApprovedApplicationDto | null>(null);
  const [readyPage, setReadyPage] = useState(1);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [search, setSearch] = useState("");
  const [defenseTypeFilter, setDefenseTypeFilter] = useState("ALL");
  const [programId, setProgramId] = useState("ALL");
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [schedule, setSchedule] = useState<ScheduleFormState>(EMPTY_SCHEDULE);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [missingItems, setMissingItems] = useState<MissingRequirement[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // §18: scheduleId in the URL activates the Scheduled view on mount, and all
  // selection changes go through the URL (single source of truth) — no
  // setState-in-effect synchronization.

  const stageFilter =
    defenseTypeFilter === "ALL"
      ? undefined
      : stageFromDefenseType(defenseTypeFilter);

  // Dedicated graduate-program cache shape (avoids the shared `["programs"]`
  // DTO collision that produced `programs.map is not a function`).
  const { data: programsData } = useQuery<Program[]>({
    queryKey: ["programs", "graduate"],
    queryFn: async () => {
      const response = await apiClientRequest("/programs");
      return Array.isArray(response?.graduatePrograms)
        ? response.graduatePrograms
        : [];
    },
  });
  const programs = Array.isArray(programsData) ? programsData : [];

  // Tab counts — authoritative workflow summary for the same filters.
  const { data: summary } = useQuery<WorkflowSummary>({
    queryKey: ["schedulingWorkflowSummary", search, stageFilter, programId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (stageFilter) params.set("stage", stageFilter);
      if (programId !== "ALL") params.set("programId", programId);
      const qs = params.toString();
      return (await apiClientRequest(
        `/thesis/defense/applications/summary${qs ? `?${qs}` : ""}`,
      )) as WorkflowSummary;
    },
  });

  // READY tab — approved applications awaiting committee + schedule.
  const readyQuery = useQuery<PaginatedResponse<ApprovedApplicationDto>>({
    queryKey: [
      "approvedDefenseApplications",
      readyPage,
      search,
      defenseTypeFilter,
      programId,
    ],
    enabled: activeTab === "READY",
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(readyPage),
        pageSize: "10",
        search,
        defenseType: defenseTypeFilter,
        programId,
      });
      return (await apiClientRequest(
        `/thesis/defense/approved-applications?${params.toString()}`,
      )) as PaginatedResponse<ApprovedApplicationDto>;
    },
  });

  // SCHEDULED tab — reuse the Defense Applications ACTIVE bucket
  // (current-stage, non-cancelled session: SCHEDULED / RESCHEDULED /
  // IN_PROGRESS / AWAITING_CONCLUSION). No second scheduled-list endpoint.
  const scheduledQuery = useQuery<PaginatedResponse<ApprovedApplicationDto>>({
    queryKey: [
      "scheduledDefenseApplications",
      scheduledPage,
      search,
      defenseTypeFilter,
      programId,
    ],
    enabled: activeTab === "SCHEDULED",
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(scheduledPage),
        pageSize: "10",
        bucket: "ACTIVE",
        search,
      });
      if (stageFilter) params.set("stage", stageFilter);
      if (programId !== "ALL") params.set("programId", programId);
      return (await apiClientRequest(
        `/thesis/defense/applications?${params.toString()}`,
      )) as PaginatedResponse<ApprovedApplicationDto>;
    },
  });

  // Deep-link: /admin/thesis/scheduling?thesisId=... selects the approved
  // application once the list loads (derived during render — no effect).
  const deepLinkMatch = useMemo<ApprovedApplicationDto | null>(() => {
    if (!effectiveThesisId || !readyQuery.data?.data?.length) return null;
    return readyQuery.data.data.find((a) => a.id === effectiveThesisId) ?? null;
  }, [effectiveThesisId, readyQuery.data]);

  // §18: if the deep-linked approved application is not on the current Ready
  // page (10/page), resolve it authoritatively by id via the existing ADMIN
  // read model so the exact application is still selected. Only READY records
  // are accepted here (never opens the editable flow for an active session).
  const deepLinkFallback = useQuery<ApprovedApplicationDto | null>({
    queryKey: ["schedulingDeepLinkApplication", effectiveThesisId],
    enabled:
      !!effectiveThesisId && readyQuery.isSuccess && !deepLinkMatch,
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/applications/${effectiveThesisId}`,
      )) as ApprovedApplicationDto,
    retry: false,
  });

  const deepLinkApp =
    deepLinkFallback.data && deepLinkFallback.data.workflowBucket === "READY"
      ? deepLinkFallback.data
      : null;

  const selected = selectedApp ?? deepLinkMatch ?? deepLinkApp;

  const defenseType = selected
    ? defenseTypeFromStage(selected.stage)
    : "TITLE_DEFENSE";
  const programType = selected?.student.program?.programType ?? "";

  const {
    data: policy,
    isLoading: policyLoading,
    isError: policyError,
  } = useQuery<CommitteePolicyDto>({
    queryKey: ["committeePolicy", defenseType, programType],
    enabled: activeTab === "READY" && !!selected,
    queryFn: async () => {
      const params = new URLSearchParams({ defenseType });
      if (programType) params.set("programType", programType);
      return (await apiClientRequest(
        `/thesis/committee-policy?${params.toString()}`,
      )) as CommitteePolicyDto;
    },
  });

  // ADV-1: Proposal/Final derive the current active Adviser from the Student's
  // active AdviserAssignment projection. The legacy ThesisRecord.assignment link
  // is compatibility data and is never the current-Adviser authority here.
  const adviser = useMemo<CommitteeMember | null>(() => {
    if (!selected || selected.stage === "TITLE") return null;
    const active = selected.activeAdviser;
    if (!active) return null;
    return {
      userId: active.userId,
      role: "ADVISER",
      name: `${active.firstName} ${active.lastName}`,
      email: "",
      affiliation: "Active thesis adviser",
      isDerivedAdviser: true,
    };
  }, [selected]);

  const readiness = useMemo(
    () =>
      policy ? computeCommitteeReadiness(policy, committee, adviser) : null,
    [policy, committee, adviser],
  );

  const scheduleErrors = useMemo(() => {
    const errors: { date?: string; time?: string; venue?: string } = {};
    if (!schedule.defenseDate) errors.date = "Defense date is required.";
    if (!schedule.defenseTime) errors.time = "Defense time is required.";
    const value = schedule.venueOrLink.trim();
    if (!value) {
      errors.venue = "Enter a venue or meeting link.";
    } else if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (!/^https?:$/.test(url.protocol)) {
          errors.venue = "Enter a valid http/https meeting link.";
        }
      } catch {
        errors.venue = "Enter a valid http/https meeting link.";
      }
    }
    return errors;
  }, [schedule]);

  const scheduleOk =
    !scheduleErrors.date && !scheduleErrors.time && !scheduleErrors.venue;
  const isValid = !!selected && !!readiness && readiness.complete && scheduleOk;

  const assignments = useMemo(() => {
    const manual = committee.map((c) => ({ userId: c.userId, role: c.role }));
    return adviser
      ? [...manual, { userId: adviser.userId, role: "ADVISER" as const }]
      : manual;
  }, [committee, adviser]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No application selected.");
      return (await apiClientRequest(`/thesis/defense/${selected.id}/schedule`, {
        method: "POST",
        body: JSON.stringify({
          defenseDate: schedule.defenseDate,
          defenseTime: schedule.defenseTime,
          venueOrLink: schedule.venueOrLink.trim(),
          defenseType: defenseTypeFromStage(selected.stage),
          assignments,
        }),
      })) as {
        message?: string;
        result?: { id?: string; defenseDate?: string; defenseTime?: string };
      };
    },
    onSuccess: (response) => {
      // §13: keep the Admin in the Scheduling workspace — refresh both lists,
      // switch to Scheduled, and select the exact newly created session.
      queryClient.invalidateQueries({
        queryKey: ["approvedDefenseApplications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["scheduledDefenseApplications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["schedulingWorkflowSummary"],
      });
      queryClient.invalidateQueries({ queryKey: ["defenseApplications"] });
      queryClient.invalidateQueries({ queryKey: ["defenseWorkflowSummary"] });

      setShowConfirm(false);
      setSelectedApp(null);
      setCommittee([]);
      setSchedule(EMPTY_SCHEDULE);
      setMissingItems([]);
      setActiveTab("SCHEDULED");

      const created = response?.result;
      if (created?.id) {
        router.replace(`/admin/thesis/scheduling?scheduleId=${created.id}`);
      }

      const when =
        created?.defenseDate && created?.defenseTime
          ? `Defense scheduled for ${formatDefenseDate(created.defenseDate)} at ${formatDefenseTime(created.defenseTime)}.`
          : "Defense scheduled.";
      setFeedback({
        type: "success",
        message: `${when} The session is SCHEDULED — not passed or concluded — and participants have been notified.`,
      });
    },
    onError: (error: Error & { missing?: MissingRequirement[] }) => {
      const missing = error.missing ?? [];
      setMissingItems(missing);
      setShowConfirm(false);
      setFeedback({
        type: "error",
        message: missing.length
          ? "The defense could not be scheduled. No changes were saved."
          : error.message ||
            "The defense could not be scheduled. No changes were saved.",
      });
    },
  });

  const handleSelectReady = (app: ApprovedApplicationDto) => {
    setSelectedApp(app);
    setCommittee([]);
    setSchedule(EMPTY_SCHEDULE);
    setMissingItems([]);
    setFeedback(null);
  };

  const handleSelectScheduled = (app: ApprovedApplicationDto) => {
    const scheduleId = app.currentSchedule?.id ?? null;
    if (!scheduleId) return;
    setFeedback(null);
    router.replace(`/admin/thesis/scheduling?scheduleId=${scheduleId}`);
  };

  const clearScheduledSelection = () => {
    router.replace("/admin/thesis/scheduling");
  };

  const handleTabChange = (tab: SchedulingQueueTab) => {
    setActiveTab(tab);
    setFeedback(null);
    if (tab === "READY" && scheduleIdFromQuery) {
      router.replace("/admin/thesis/scheduling");
    }
  };

  const handleAssignRole = (role: DefensePanelRole, people: PickerPerson[]) => {
    setCommittee((prev) => [
      ...prev.filter((m) => m.role !== role),
      ...people.map((person) => personToMember(person, role)),
    ]);
    setMissingItems([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduling &amp; Panels"
        description="Assign a defense committee and schedule the session for approved applications, then inspect confirmed schedules. Approval is not a defense result."
      />

      {feedback && (
        <div
          role="status"
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-4 py-3",
            feedback.type === "success"
              ? "border-(--earist-success)/30 bg-(--earist-surface-gray)"
              : "border-destructive/30 bg-destructive/5",
          )}
        >
          <p
            className={cn(
              "flex items-start gap-2 text-sm",
              feedback.type === "success"
                ? "text-(--earist-success)"
                : "text-destructive",
            )}
          >
            {feedback.type === "success" ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            )}
            {feedback.message}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss message"
            className="shrink-0"
            onClick={() => setFeedback(null)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {missingItems.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-semibold text-destructive">
            Requirements not met
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-destructive">
            {missingItems.map((m) => (
              <li key={m.code} className="break-words">
                {m.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SchedulingQueuePanel
            activeTab={activeTab}
            onTabChange={handleTabChange}
            readyCount={summary?.READY ?? 0}
            scheduledCount={summary?.ACTIVE ?? 0}
            search={search}
            defenseType={defenseTypeFilter}
            programId={programId}
            programs={programs}
            onSearchChange={(v) => {
              setSearch(v);
              setReadyPage(1);
              setScheduledPage(1);
            }}
            onDefenseTypeChange={(v) => {
              setDefenseTypeFilter(v);
              setReadyPage(1);
              setScheduledPage(1);
            }}
            onProgramChange={(v) => {
              setProgramId(v);
              setReadyPage(1);
              setScheduledPage(1);
            }}
            ready={{
              data: readyQuery.data,
              isLoading: readyQuery.isLoading,
              isError: readyQuery.isError,
              page: readyPage,
              onPageChange: setReadyPage,
              selectedId: selected?.id ?? effectiveThesisId,
              onSelect: handleSelectReady,
            }}
            scheduled={{
              data: scheduledQuery.data,
              isLoading: scheduledQuery.isLoading,
              isError: scheduledQuery.isError,
              page: scheduledPage,
              onPageChange: setScheduledPage,
              selectedScheduleId,
              onSelect: handleSelectScheduled,
            }}
          />
        </div>

        <div className="space-y-4 lg:col-span-2">
          {activeTab === "READY" ? (
            <>
              {!selected && (
                <div className="rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center text-sm text-(--earist-body-text)">
                  Select an approved application to assign the committee and
                  schedule the defense.
                </div>
              )}
              {selected && (
                <>
                  <DefenseSummaryCard application={selected} />
                  <DefenseCommitteeBuilder
                    key={selected.id}
                    policy={policy}
                    policyLoading={policyLoading}
                    policyError={policyError}
                    showAdviser={selected.stage !== "TITLE"}
                    defenseStageLabel={defenseTypeLabel(selected.stage)}
                    programTypeLabel={programTypeLabel(programType)}
                    members={committee}
                    adviser={adviser}
                    adviserConflict={selected.activeAdviserConflict === true}
                    onAssignRole={handleAssignRole}
                  />
                  <DefenseScheduleForm
                    value={schedule}
                    onChange={setSchedule}
                    errors={scheduleErrors}
                  />
                  <DefenseReviewSummary
                    readiness={readiness}
                    showAdviser={selected.stage !== "TITLE"}
                    schedule={schedule}
                    isValid={isValid}
                    isSubmitting={scheduleMutation.isPending}
                    onPreviewEmail={() => setShowEmailPreview(true)}
                    onSubmit={() => setShowConfirm(true)}
                  />
                </>
              )}
            </>
          ) : !selectedScheduleId ? (
            <div className="rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center text-sm text-(--earist-body-text)">
              Select a scheduled defense to view its schedule and confirmed
              committee.
            </div>
          ) : (
            <ScheduledDefenseDetail
              scheduleId={selectedScheduleId}
              onBack={clearScheduledSelection}
            />
          )}
        </div>
      </div>

      {selected && activeTab === "READY" && (
        <EmailPreviewDialog
          open={showEmailPreview}
          onOpenChange={setShowEmailPreview}
          application={selected}
          committee={committee}
          adviser={adviser}
          schedule={schedule}
        />
      )}

      {/* Confirmation — scheduling is a consequential mutation. */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule this defense?</DialogTitle>
            <DialogDescription>
              This creates the scheduled defense session and notifies the
              student and committee. It does not mark the defense as passed or
              concluded.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="space-y-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-(--earist-body-text)">
                  Student
                </dt>
                <dd className="text-right text-sm text-(--earist-secondary)">
                  {selected.student.user.firstName}{" "}
                  {selected.student.user.lastName}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-(--earist-body-text)">
                  Defense Stage
                </dt>
                <dd className="text-right text-sm text-(--earist-secondary)">
                  {defenseTypeLabel(selected.stage)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-(--earist-body-text)">
                  Schedule
                </dt>
                <dd className="text-right text-sm text-(--earist-secondary)">
                  {schedule.defenseDate || "—"} {schedule.defenseTime || ""}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-xs font-medium text-(--earist-body-text)">
                  Committee
                </dt>
                <dd className="text-right text-sm text-(--earist-secondary)">
                  {readiness
                    ? `${readiness.totalCount} / ${readiness.sessionTotal} participants`
                    : "—"}
                </dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={scheduleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => scheduleMutation.mutate()}
              disabled={scheduleMutation.isPending}
              className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
            >
              {scheduleMutation.isPending ? "Scheduling…" : "Schedule Defense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
