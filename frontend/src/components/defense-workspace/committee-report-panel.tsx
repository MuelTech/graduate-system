"use client";

/**
 * CDW-4 — Committee Report tab: a READ-ONLY status/context surface.
 *
 * This package establishes the tab/shell only. It shows the existing safe report
 * read model (status, freeze state, legacy minutes) or a neutral empty state.
 * The rich-text Report composer, comment-to-report insertion, report freeze
 * controls, and RAP signatures belong to CDW-5 / RAP-C1 and are NOT implemented.
 */

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { apiClientRequest } from "@/lib/api.client";
import type { DefenseWorkspace } from "@/types/defense-workspace";

interface CommitteeReportReadModel {
  reportStatus: string;
  venue: string | null;
  hasCollaborativeBody: boolean;
  legacyContent: {
    decisionsAndRecommendations: string | null;
    rapporteurNotes: string | null;
  };
  freeze: {
    frozenAt: string | null;
    frozenById: string | null;
    frozenContentHash: string | null;
  };
  canEditBody: boolean;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-(--earist-body-text)">
      <span className="font-medium text-(--earist-secondary)">{label}:</span>
      <span>{value}</span>
    </p>
  );
}

export function CommitteeReportPanel({
  workspace,
  scheduleId,
}: {
  workspace: DefenseWorkspace;
  scheduleId: string;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["committeeReport", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/collaboration/report`,
      )) as CommitteeReportReadModel,
    staleTime: 30_000,
    retry: 1,
  });

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-(--earist-primary)" />
          <h2 className="text-base font-bold text-(--earist-primary)">Committee Report</h2>
          <Badge variant="outline">
            {data?.reportStatus ?? workspace.rapStatus ?? "Not created"}
          </Badge>
        </div>

        <div className="space-y-1 rounded border border-(--earist-border-gray) p-3">
          <StatusRow
            label="Status"
            value={data?.reportStatus ?? workspace.rapStatus ?? "Not created yet"}
          />
          <StatusRow
            label="Frozen"
            value={data?.freeze?.frozenAt ? new Date(data.freeze.frozenAt).toLocaleString() : "No"}
          />
          <StatusRow
            label="Session"
            value={workspace.schedule.sessionStatus}
          />
        </div>

        {isLoading && <p className="text-xs text-(--earist-body-text)">Loading report…</p>}

        {isError && (
          <p className="text-xs text-amber-700">
            The report read model could not be loaded. Status above reflects the session.
          </p>
        )}

        {data && !data.hasCollaborativeBody && !data.legacyContent.decisionsAndRecommendations && !data.legacyContent.rapporteurNotes && (
          <div className="rounded border border-dashed border-(--earist-border-gray) p-6 text-center">
            <p className="text-sm text-(--earist-body-text)">No committee report content yet.</p>
            <p className="mt-1 text-xs text-(--earist-body-text)">
              The Rapporteur report authoring experience arrives in a later package.
            </p>
          </div>
        )}

        {data?.legacyContent.rapporteurNotes && (
          <section className="space-y-1">
            <h3 className="text-xs font-semibold tracking-wide text-(--earist-body-text) uppercase">
              Rapporteur notes (read-only)
            </h3>
            <p className="rounded border border-(--earist-border-gray) bg-white p-3 text-sm whitespace-pre-wrap text-(--earist-body)">
              {data.legacyContent.rapporteurNotes}
            </p>
          </section>
        )}

        {data?.legacyContent.decisionsAndRecommendations && (
          <section className="space-y-1">
            <h3 className="text-xs font-semibold tracking-wide text-(--earist-body-text) uppercase">
              Decisions &amp; recommendations (read-only)
            </h3>
            <p className="rounded border border-(--earist-border-gray) bg-white p-3 text-sm whitespace-pre-wrap text-(--earist-body)">
              {data.legacyContent.decisionsAndRecommendations}
            </p>
          </section>
        )}

        {data?.hasCollaborativeBody && (
          <p className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
            This committee report has a structured body. The rich-text report reader/composer
            arrives in the next package.
          </p>
        )}
      </div>
    </div>
  );
}
