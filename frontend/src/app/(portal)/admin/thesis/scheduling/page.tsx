"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import type {
  ActivePanelistCandidate,
  ApprovedApplicationDto,
  CommitteePolicyDto,
  DefensePanelRole,
  MissingRequirement,
  PaginatedResponse,
  ScheduleDefensePayload,
} from "@/types";
import { ApprovedApplicationsPanel } from "@/components/admin/defense-scheduling/approved-applications-panel";
import { DefenseSummaryCard } from "@/components/admin/defense-scheduling/defense-summary-card";
import { DefenseCommitteeBuilder } from "@/components/admin/defense-scheduling/defense-committee-builder";
import { DefenseScheduleForm } from "@/components/admin/defense-scheduling/defense-schedule-form";
import { DefenseReviewSummary } from "@/components/admin/defense-scheduling/defense-review-summary";
import { EmailPreviewDialog } from "@/components/admin/defense-scheduling/email-preview-dialog";
import {
  defenseTypeFromStage,
  panelistToMember,
  type CommitteeMember,
  type ScheduleFormState,
} from "@/components/admin/defense-scheduling/types";

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

  const [selected, setSelected] = useState<ApprovedApplicationDto | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [defenseTypeFilter, setDefenseTypeFilter] = useState("ALL");
  const [programId, setProgramId] = useState("ALL");
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [schedule, setSchedule] = useState<ScheduleFormState>({
    defenseDate: "",
    defenseTime: "",
    meetingLink: "",
  });
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [missingItems, setMissingItems] = useState<MissingRequirement[]>([]);

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const res = await apiClientRequest("/programs");
      return Array.isArray(res) ? res : [];
    },
  });

  const { data, isLoading, isError } = useQuery({
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
      const res = await apiClientRequest(
        `/thesis/defense/approved-applications?${params.toString()}`,
      );
      return res as PaginatedResponse<ApprovedApplicationDto>;
    },
  });

  const defenseType = selected
    ? defenseTypeFromStage(selected.stage)
    : "TITLE_DEFENSE";

  const { data: policy } = useQuery({
    queryKey: ["committeePolicy", defenseType],
    enabled: !!selected,
    queryFn: async () => {
      const res = await apiClientRequest(
        `/thesis/committee-policy?defenseType=${defenseType}`,
      );
      return res as CommitteePolicyDto;
    },
  });

  // Active adviser for Proposal/Final — derived, not hand-picked.
  const { data: adviserCandidates = [] } = useQuery({
    queryKey: ["activeAdviser", selected?.id],
    enabled: !!selected && selected.stage !== "TITLE",
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/adviser/available");
      return (Array.isArray(res) ? res : []) as ActivePanelistCandidate[];
    },
  });

  const derivedAdviser = useMemo<CommitteeMember | null>(() => {
    if (!selected || selected.stage === "TITLE") return null;
    const assignment = selected.assignment?.adviser;
    if (assignment) {
      const match = adviserCandidates.find((c) => c.id === assignment.id);
      if (match) return panelistToMember(match, "ADVISER", true);
      return {
        userId: assignment.id,
        role: "ADVISER",
        name: `${assignment.firstName} ${assignment.lastName}`,
        email: "",
        affiliation: "Active thesis adviser",
        isDerivedAdviser: true,
      };
    }
    return null;
  }, [selected, adviserCandidates]);

  const allowedRoles: DefensePanelRole[] =
    policy?.allowedRoles ?? ["CHAIRMAN", "PANELIST", "FACILITATOR", "RAPPORTEUR"];

  const scheduleErrors = useMemo(() => {
    const errors: { date?: string; time?: string; link?: string } = {};
    if (!schedule.defenseDate) errors.date = "Defense date is required.";
    if (!schedule.defenseTime) errors.time = "Defense time is required.";
    if (!schedule.meetingLink) {
      errors.link = "MS Teams link is required.";
    } else {
      try {
        const u = new URL(schedule.meetingLink);
        if (!/^https?:$/.test(u.protocol)) {
          errors.link = "Enter a valid https:// Teams link.";
        }
      } catch {
        errors.link = "Enter a valid https:// Teams link.";
      }
    }
    return errors;
  }, [schedule]);

  const isValid = useMemo(() => {
    if (!selected || !policy) return false;
    const hasChairman = committee.some((c) => c.role === "CHAIRMAN");
    const noDupes =
      new Set(committee.map((c) => c.userId)).size === committee.length;
    const scheduleOk =
      !scheduleErrors.date && !scheduleErrors.time && !scheduleErrors.link;
    return hasChairman && noDupes && committee.length >= 1 && scheduleOk;
  }, [selected, policy, committee, scheduleErrors]);

  const scheduleMutation = useMutation({
    mutationFn: async ({
      thesisId,
      payload,
    }: {
      thesisId: string;
      payload: ScheduleDefensePayload;
    }) => {
      return apiClientRequest(`/thesis/defense/${thesisId}/schedule`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvedDefenseApplications"] });
      setSelected(null);
      setCommittee([]);
      setSchedule({ defenseDate: "", defenseTime: "", meetingLink: "" });
      setMissingItems([]);
      alert(
        "Defense scheduled successfully! Status is SCHEDULED (not PASSED). Notifications queued.",
      );
    },
    onError: (error: Error & { missing?: MissingRequirement[] }) => {
      const missing = error.missing ?? [];
      setMissingItems(missing);
      if (missing.length) {
        alert(
          "Defense could not be scheduled. No changes were saved.\n" +
            missing.map((m) => `• ${m.message}`).join("\n"),
        );
      } else {
        alert(error.message || "Defense could not be scheduled. No changes were saved.");
      }
    },
  });

  const handleSelect = (app: ApprovedApplicationDto) => {
    setSelected(app);
    setCommittee([]);
    setMissingItems([]);
  };

  const handleAddMember = (m: CommitteeMember) => {
    setCommittee((prev) => {
      if (prev.some((c) => c.userId === m.userId)) {
        alert(`${m.name} is already assigned to this defense.`);
        return prev;
      }
      return [...prev, m];
    });
  };

  const handleRemoveMember = (userId: string) => {
    setCommittee((prev) => prev.filter((c) => c.userId !== userId));
  };

  const handleEditRole = (userId: string, role: DefensePanelRole) => {
    if (selected?.stage === "TITLE" && role === "ADVISER") {
      alert("Adviser cannot be assigned to a Title Defense.");
      return;
    }
    setCommittee((prev) =>
      prev.map((c) => (c.userId === userId ? { ...c, role } : c)),
    );
  };

  const handleSubmit = () => {
    if (!selected || !isValid) return;
    const assignments = [
      ...(derivedAdviser
        ? [{ userId: derivedAdviser.userId, role: "ADVISER" as DefensePanelRole }]
        : []),
      ...committee.map((c) => ({ userId: c.userId, role: c.role })),
    ];
    const payload: ScheduleDefensePayload = {
      defenseDate: schedule.defenseDate,
      defenseTime: schedule.defenseTime,
      venueOrLink: schedule.meetingLink,
      defenseType: defenseTypeFromStage(selected.stage),
      assignments,
    };
    scheduleMutation.mutate({ thesisId: selected.id, payload });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Panel Assignment &amp; Defense Scheduling
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Build the defense committee, set the schedule, review, then notify.
        </p>
        {missingItems.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">Requirements not met</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {missingItems.map((m) => (
                <li key={m.code}>{m.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
              Select an approved application to build the defense committee and
              schedule the session.
            </div>
          )}
          {selected && (
            <>
              <DefenseSummaryCard application={selected} />
              <DefenseCommitteeBuilder
                allowedRoles={allowedRoles}
                committee={committee}
                adviser={derivedAdviser}
                onAdd={handleAddMember}
                onRemove={handleRemoveMember}
                onEditRole={handleEditRole}
              />
              <DefenseScheduleForm
                value={schedule}
                onChange={setSchedule}
                errors={scheduleErrors}
              />
              <DefenseReviewSummary
                application={selected}
                committee={committee}
                adviser={derivedAdviser}
                schedule={schedule}
                isValid={isValid}
                isSubmitting={scheduleMutation.isPending}
                onPreviewEmail={() => setShowEmailPreview(true)}
                onSubmit={handleSubmit}
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
          adviser={derivedAdviser}
          schedule={schedule}
        />
      )}
    </div>
  );
}
