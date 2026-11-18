"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { AdviserCertificationRecords } from "@/components/shared/adviser-certification-records";
import { DEFENSE_REQUIREMENT_LABELS } from "@/components/admin/defense-applications/labels";
import type {
  DefenseDocumentHistory,
  DefenseHistoryStage,
} from "@/types/defense-document-history";

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

export function ReadyDefenseSubmission({
  thesisId,
  stage,
}: {
  thesisId: string;
  stage: DefenseHistoryStage;
}) {
  const { data: session } = useSession();
  if (!session?.user?.id) return null;
  const viewerScope = `${session.user.id}:${session.user.role}`;
  return (
    <ReadySubmissionContext
      key={`${viewerScope}:${thesisId}:${stage}`}
      thesisId={thesisId}
      stage={stage}
      viewerScope={viewerScope}
    />
  );
}

function ReadySubmissionContext({
  thesisId,
  stage,
  viewerScope,
}: {
  thesisId: string;
  stage: DefenseHistoryStage;
  viewerScope: string;
}) {
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  );
  const query = useQuery<DefenseDocumentHistory>({
    queryKey: ["ready-defense-submission", viewerScope, thesisId, stage],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/applications/${encodeURIComponent(thesisId)}/document-history?stage=${encodeURIComponent(stage)}`,
      )) as DefenseDocumentHistory,
    retry: false,
  });

  const data = query.data;
  const slots = data?.supportingEvidence ?? [];
  const hasDocumentHistory = slots.some((slot) => slot.history.length > 0);

  function viewDocument(id: string, title: string) {
    setPreview({
      url: `/api/documents/thesis-document/${encodeURIComponent(id)}/file`,
      title,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          Application Requirements
        </CardTitle>
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
            {(stage === "PROPOSAL" || stage === "FINAL") && (
              <>
                <AdviserCertificationRecords thesisId={thesisId} stage={stage} />
                {data.manuscriptReview?.warning && (
                  <p role="alert" className="text-destructive">
                    {data.manuscriptReview.warning}
                  </p>
                )}
              </>
            )}

            <section className="space-y-3" aria-label="Application Requirements">
              {slots.length === 0 ? (
                <p className="text-(--earist-body-text)">
                  No current documents recorded for this stage.
                </p>
              ) : (
                <ul className="divide-y divide-(--earist-border-gray)">
                  {slots.map((slot) => (
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
                          <p
                            role="status"
                            className="mt-0.5 text-sm text-(--earist-warning)"
                          >
                            {slot.integrityState === "AMBIGUOUS"
                              ? "Multiple current versions recorded — review required."
                              : "No current document recorded."}
                          </p>
                        )}
                        {slot.docType === "RECEIPT" &&
                          data.application.orNumber && (
                            <p className="mt-1 text-xs font-medium text-[#333333]">
                              O.R. No.:{" "}
                              <span className="font-semibold">
                                {data.application.orNumber}
                              </span>{" "}
                              · Amount Paid:{" "}
                              <span className="font-semibold">
                                {data.application.amountPaid || "P 900.00"}
                              </span>
                            </p>
                          )}
                      </div>
                      {slot.current && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            viewDocument(
                              slot.current!.id,
                              requirementLabel(slot.docType),
                            )
                          }
                        >
                          View
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {hasDocumentHistory && (
                <details className="rounded-lg border border-(--earist-border-gray) px-4 py-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
                    <History className="h-4 w-4" aria-hidden="true" />
                    View document history
                  </summary>
                  <div className="mt-3">
                    <ul className="space-y-1">
                      {slots.flatMap((slot) =>
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
                              onClick={() =>
                                viewDocument(
                                  doc.id,
                                  `${requirementLabel(slot.docType)} (previous version)`,
                                )
                              }
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
            key={preview.url}
            open
            onOpenChange={(open) => {
              if (!open) setPreview(null);
            }}
            fetchUrl={preview.url}
            title={preview.title}
          />
        )}
      </CardContent>
    </Card>
  );
}
