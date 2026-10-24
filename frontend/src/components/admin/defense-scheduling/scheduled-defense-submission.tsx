"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { AdviserCertificationRecords } from "@/components/shared/adviser-certification-records";
import {
  DEFENSE_REQUIREMENT_LABELS,
  STAGE_LABELS,
} from "@/components/admin/defense-applications/labels";
import type { ScheduledDefenseSubmission } from "@/types/scheduled-defense-submission";

function formatDocumentDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });
}

function requirementLabel(docType: string): string {
  if (docType === "COR") return "Certificate of Registration (COR)";
  return DEFENSE_REQUIREMENT_LABELS[docType] ?? docType.replaceAll("_", " ");
}

export function ScheduledDefenseSubmission({
  scheduleId,
}: {
  scheduleId: string;
}) {
  const { data: session } = useSession();
  if (!session?.user?.id) return null;
  const viewerScope = `${session.user.id}:${session.user.role}`;
  return (
    <SubmissionContext
      key={`${viewerScope}:${scheduleId}`}
      scheduleId={scheduleId}
      viewerScope={viewerScope}
    />
  );
}

function SubmissionContext({
  scheduleId,
  viewerScope,
}: {
  scheduleId: string;
  viewerScope: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const query = useQuery<ScheduledDefenseSubmission>({
    queryKey: ["scheduled-defense-submission", viewerScope, scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/schedules/${encodeURIComponent(scheduleId)}/submission`,
      )) as ScheduledDefenseSubmission,
    retry: false,
  });
  const data = query.data;
  const hasDocumentHistory =
    data?.supportingEvidence.some((slot) => slot.history.length > 0) ?? false;
  function viewDocument(id: string) {
    setPreview(`/api/documents/thesis-document/${encodeURIComponent(id)}/file`);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Application Requirements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm break-words">
        {query.isLoading && (
          <p aria-live="polite">Loading application requirements…</p>
        )}
        {query.isError && (
          <div role="alert">
            Application requirements could not be loaded.{" "}
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {data && (
          <>
            <p>Defense Stage: {STAGE_LABELS[data.stage] ?? data.stage}</p>
            <section className="space-y-2" aria-label="Manuscript">
              <h3 className="font-semibold">Manuscript</h3>
              {data.manuscriptIntegrityError && (
                <p role="alert" className="text-destructive">
                  The scheduled manuscript could not be verified. The
                  schedule’s manuscript record is missing or invalid.
                </p>
              )}
              {data.manuscript && (
                <>
                  <p>
                    <span className="font-medium">
                      Thesis/Dissertation Title:{" "}
                    </span>
                    {data.manuscript.manuscriptTitle ||
                      "Title not recorded for this manuscript."}
                  </p>
                  <p className="text-xs break-words text-(--earist-body-text)">
                    {data.manuscript.originalFilename || "Filename unavailable"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => viewDocument(data.manuscript!.id)}
                  >
                    View Manuscript
                  </Button>
                </>
              )}
            </section>
            {(data.stage === "PROPOSAL" || data.stage === "FINAL") &&
              (data.certification.record ? (
                <AdviserCertificationRecords
                  thesisId={data.thesisId}
                  stage={data.stage}
                  exactRecords={[data.certification.record]}
                />
              ) : (
                <section className="space-y-2" aria-label="Adviser Certification">
                  <h3 className="font-semibold">Adviser Certification</h3>
                  <p role="status">
                    Adviser Certification is not available for this defense.
                  </p>
                </section>
              ))}
            <section className="space-y-3" aria-label="Application Requirements">
              <ul className="divide-y divide-(--earist-border-gray)">
                {data.supportingEvidence.map((slot) => (
                  <li
                    key={slot.docType}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {requirementLabel(slot.docType)}
                      </p>
                      {slot.current ? (
                        <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                          {slot.current.originalFilename ||
                            "Filename unavailable"}{" "}
                          · {formatDocumentDate(slot.current.uploadedAt)}
                        </p>
                      ) : (
                        <p role="status" className="mt-0.5 text-sm text-(--earist-warning)">
                          {slot.integrityState === "AMBIGUOUS"
                            ? "Multiple current versions recorded — review required."
                            : "No current document recorded."}
                        </p>
                      )}
                    </div>
                    {slot.current && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewDocument(slot.current!.id)}
                      >
                        View
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {hasDocumentHistory && (
                <details className="rounded-lg border border-(--earist-border-gray) px-4 py-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
                    <History className="h-4 w-4" aria-hidden="true" />
                    View document history
                  </summary>
                  <div className="mt-3">
                    <ul className="space-y-1">
                      {data.supportingEvidence.flatMap((slot) =>
                        slot.history.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-(--earist-surface-gray) px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 break-words">
                              {requirementLabel(slot.docType)} · Previous:{" "}
                              {doc.originalFilename || "Filename unavailable"}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => viewDocument(doc.id)}
                            >
                              View
                            </Button>
                          </li>
                        )),
                      )}
                    </ul>
                  </div>
                </details>
              )}
            </section>
          </>
        )}
        {preview && (
          <DocumentViewer
            key={preview}
            open
            onOpenChange={(open) => {
              if (!open) setPreview(null);
            }}
            fetchUrl={preview}
            title="Scheduled Defense Document"
          />
        )}
      </CardContent>
    </Card>
  );
}
