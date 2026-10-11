"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { ApprovedApplicationsPanel } from "@/components/admin/defense-scheduling/approved-applications-panel";
import { DefenseSummaryCard } from "@/components/admin/defense-scheduling/defense-summary-card";
import { DefenseCommitteeBuilder } from "@/components/admin/defense-scheduling/defense-committee-builder";
import { DefenseScheduleForm } from "@/components/admin/defense-scheduling/defense-schedule-form";
import { DefenseReviewSummary } from "@/components/admin/defense-scheduling/defense-review-summary";
import { EmailPreviewDialog } from "@/components/admin/defense-scheduling/email-preview-dialog";
import {
  computeCommitteeReadiness,
  defenseTypeFromStage,
  defenseTypeLabel,
  personToMember,
  programTypeLabel,
  type CommitteeMember,
  type PickerPerson,
  type ScheduleFormState,
} from "@/components/admin/defense-scheduling/types";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

const EMPTY_SCHEDULE: ScheduleFormState = {
  defenseDate: "",
  defenseTime: "",
  venueOrLink: "",
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
  const thesisIdFromQuery = searchParams.get("thesisId");
  const queryClient = useQueryClient();

  const [selectedApp, setSelectedApp] =
    useState<ApprovedApplicationDto | null>(null);
  const [page, setPage] = useState(1);
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

  const {
    data,
    isLoading,
    isError,
  } = useQuery<PaginatedResponse<ApprovedApplicationDto>>({
    queryKey: [
      "approvedDefenseApplications",
      page,
      search,
      defenseTypeFilter,
      programId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
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

  // Deep-link: /admin/thesis/scheduling?thesisId=... selects the approved
  // application once the list loads (derived during render — no effect).
  const deepLinkMatch = useMemo<ApprovedApplicationDto | null>(() => {
    if (!thesisIdFromQuery || !data?.data?.length) return null;
    return data.data.find((a) => a.id === thesisIdFromQuery) ?? null;
  }, [thesisIdFromQuery, data]);

  const selected = selectedApp ?? deepLinkMatch;

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
    enabled: !!selected,
    queryFn: async () => {
      const params = new URLSearchParams({ defenseType });
      if (programType) params.set("programType", programType);
      return (await apiClientRequest(
        `/thesis/committee-policy?${params.toString()}`,
      )) as CommitteePolicyDto;
    },
  });

  // Proposal/Final: the active adviser is derived (never hand-picked here).
  const adviser = useMemo<CommitteeMember | null>(() => {
    if (!selected || selected.stage === "TITLE") return null;
    const assignment = selected.assignment?.adviser;
    if (!assignment) return null;
    return {
      userId: assignment.id,
      role: "ADVISER",
      name: `${assignment.firstName} ${assignment.lastName}`,
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
      return apiClientRequest(`/thesis/defense/${selected.id}/schedule`, {
        method: "POST",
        body: JSON.stringify({
          defenseDate: schedule.defenseDate,
          defenseTime: schedule.defenseTime,
          venueOrLink: schedule.venueOrLink.trim(),
          defenseType: defenseTypeFromStage(selected.stage),
          assignments,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["approvedDefenseApplications"],
      });
      setShowConfirm(false);
      setSelectedApp(null);
      setCommittee([]);
      setSchedule(EMPTY_SCHEDULE);
      setMissingItems([]);
      setFeedback({
        type: "success",
        message:
          "Defense scheduled. The session is SCHEDULED — not passed or concluded — and participants have been notified.",
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

  const handleSelect = (app: ApprovedApplicationDto) => {
    setSelectedApp(app);
    setCommittee([]);
    setSchedule(EMPTY_SCHEDULE);
    setMissingItems([]);
    setFeedback(null);
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
        description="Assign a defense committee and schedule the session for approved applications. Approval is not a defense result."
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
          <ApprovedApplicationsPanel
            data={data}
            isLoading={isLoading}
            isError={isError}
            page={page}
            search={search}
            defenseType={defenseTypeFilter}
            programId={programId}
            programs={programs}
            selectedId={selected?.id ?? thesisIdFromQuery}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            onDefenseTypeChange={(v) => {
              setDefenseTypeFilter(v);
              setPage(1);
            }}
            onProgramChange={(v) => {
              setProgramId(v);
              setPage(1);
            }}
            onPageChange={setPage}
            onSelect={handleSelect}
          />
        </div>

        <div className="space-y-4 lg:col-span-2">
          {!selected && (
            <div className="rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center text-sm text-(--earist-body-text)">
              Select an approved application to assign the committee and schedule
              the defense.
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
        </div>
      </div>

      {selected && (
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
                  {selected.stage === "TITLE"
                    ? "Title Defense"
                    : selected.stage === "PROPOSAL"
                      ? "Proposal Defense"
                      : "Final Defense"}
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
