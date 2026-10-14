"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ScrollText } from "lucide-react";

interface ProposalHistoryManuscript {
  id: string;
  docType: string;
  defenseStage: string | null;
  uploadedAt: string | null;
  displayName: string;
}

interface ProposalHistoryRap {
  id: string;
  status: "FINALIZED";
  finalizedAt: string | null;
  decisionsAndRecommendations: string | null;
}

/**
 * CP8: read-only prior Proposal context for Final Defense Workspace.
 * Shows exact certified Proposal manuscript + finalized Proposal RAP only.
 * Never claims that recommendations were complied with.
 */
export function ProposalHistoryPanel({
  manuscript,
  rap,
}: {
  manuscript: ProposalHistoryManuscript | null;
  rap: ProposalHistoryRap | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Prior Proposal Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-xs text-(--earist-body-text)">
          Panel recommendations remain in the Proposal RAP history and are
          reviewed against the current Final manuscript. The system does not
          declare that any recommendation was complied with.
        </p>

        <section className="rounded border border-(--earist-border-gray) p-3">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-(--earist-primary)" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-(--earist-secondary)">
              Previous Proposal Manuscript
            </h4>
          </div>
          {manuscript ? (
            <div className="space-y-1">
              <p className="text-sm">{manuscript.displayName}</p>
              {manuscript.uploadedAt && (
                <p className="text-xs text-(--earist-body-text)">
                  Uploaded {new Date(manuscript.uploadedAt).toLocaleDateString()}
                </p>
              )}
              <p className="text-[11px] text-(--earist-body-text)">
                Proposal manuscript certified by the Thesis/Dissertation
                Adviser
              </p>
            </div>
          ) : (
            <p className="text-xs text-(--earist-body-text)">
              Certified prior Proposal manuscript is unavailable.
            </p>
          )}
        </section>

        <section className="rounded border border-(--earist-border-gray) p-3">
          <div className="mb-2 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-(--earist-primary)" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-(--earist-secondary)">
              Proposal RAP / Recommendations
            </h4>
          </div>
          {rap ? (
            <div className="space-y-2">
              <p className="text-xs text-(--earist-body-text)">
                Status: Finalized
                {rap.finalizedAt
                  ? ` · ${new Date(rap.finalizedAt).toLocaleDateString()}`
                  : ""}
              </p>
              {rap.decisionsAndRecommendations ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-(--earist-surface-gray) p-2 text-xs">
                  {rap.decisionsAndRecommendations}
                </pre>
              ) : (
                <p className="text-xs text-(--earist-body-text)">
                  No finalized recommendations text recorded.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-(--earist-body-text)">
              Finalized Proposal RAP is unavailable. Draft or pending RAP
              content is not shown as official Proposal history.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
