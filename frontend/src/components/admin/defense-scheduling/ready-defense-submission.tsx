"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
    <Card className="border-gray-100 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-[#333333]">
          Application Requirements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm break-words">
        {query.isLoading && (
          <p className="text-gray-500" aria-live="polite">
            Loading application requirements…
          </p>
        )}
        {query.isError && (
          <div role="alert" className="text-gray-600">
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
                <p className="text-gray-500">
                  No current documents recorded for this stage.
                </p>
              ) : (
                <ul
                  className={cn(
                    "grid grid-cols-1 gap-3 sm:grid-cols-2",
                    slots.length >= 3 && "xl:grid-cols-3",
                  )}
                >
                  {slots.map((slot) => (
                    <li
                      key={slot.docType}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-gray-50/50 p-3.5"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[#333333]">
                            {requirementLabel(slot.docType)}
                          </p>
                          {slot.current ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                            >
                              On file
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-amber-200 bg-amber-50 text-[11px] text-amber-800"
                            >
                              {slot.integrityState === "AMBIGUOUS"
                                ? "Review required"
                                : "Missing"}
                            </Badge>
                          )}
                        </div>
                        {slot.current ? (
                          <p className="text-xs break-words text-gray-500">
                            {slot.current.originalFilename ||
                              "Filename unavailable"}{" "}
                            · {formatDocumentDate(slot.current.uploadedAt)}
                          </p>
                        ) : (
                          <p
                            role="status"
                            className="text-xs text-amber-700"
                          >
                            {slot.integrityState === "AMBIGUOUS"
                              ? "Multiple current versions recorded — review required."
                              : "No current document recorded."}
                          </p>
                        )}
                        {slot.docType === "RECEIPT" &&
                          data.application.orNumber && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              <Badge
                                variant="outline"
                                className="border-gray-200 bg-white text-[11px] text-[#333333]"
                              >
                                O.R. No.: {data.application.orNumber}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-gray-200 bg-white text-[11px] text-[#333333]"
                              >
                                Amount Paid:{" "}
                                {data.application.amountPaid || "P 900.00"}
                              </Badge>
                            </div>
                          )}
                      </div>
                      {slot.current && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 bg-white"
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
                <details className="rounded-xl border border-gray-200/80 bg-gray-50/30 px-4 py-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#333333]">
                    <History className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    View document history
                  </summary>
                  <div className="mt-3">
                    <ul className="space-y-1.5">
                      {slots.flatMap((slot) =>
                        slot.history.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200/70 bg-white px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 break-words text-gray-600">
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
