"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { AdviserCertificationRecords } from "@/components/shared/adviser-certification-records";
import { DEFENSE_REQUIREMENT_LABELS } from "@/components/admin/defense-applications/labels";
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
            <section
              className="space-y-3 rounded-xl border border-gray-200/80 bg-gray-50/50 p-4"
              aria-label="Manuscript"
            >
              <h3 className="font-semibold text-[#333333]">
                {data.stage === "TITLE"
                  ? "Title Defense Proposal Package"
                  : "Manuscript"}
              </h3>
              {data.manuscriptIntegrityError && (
                <p role="alert" className="text-destructive">
                  The scheduled manuscript could not be verified. The
                  schedule’s manuscript record is missing or invalid.
                </p>
              )}
              {data.manuscript && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    {(data.stage === "PROPOSAL" || data.stage === "FINAL") && (
                      <p className="text-[#333333]">
                        <span className="font-medium text-gray-600">
                          Thesis/Dissertation Title:{" "}
                        </span>
                        <span className="font-semibold">
                          {data.manuscript.manuscriptTitle ||
                            "Title not recorded for this manuscript."}
                        </span>
                      </p>
                    )}
                    <p className="text-xs break-words text-gray-500">
                      {data.manuscript.originalFilename || "Filename unavailable"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 bg-white"
                    onClick={() => viewDocument(data.manuscript!.id)}
                  >
                    View Manuscript
                  </Button>
                </div>
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
                <section
                  className="space-y-2 rounded-xl border border-gray-200/80 bg-gray-50/50 p-4"
                  aria-label="Adviser Certification"
                >
                  <h3 className="font-semibold text-[#333333]">
                    Adviser Certification
                  </h3>
                  <p role="status" className="text-xs text-gray-500">
                    Adviser Certification is not available for this defense.
                  </p>
                </section>
              ))}
            <section className="space-y-3" aria-label="Application Requirements">
              <ul
                className={cn(
                  "grid grid-cols-1 gap-3 sm:grid-cols-2",
                  data.supportingEvidence.length >= 3 && "xl:grid-cols-3",
                )}
              >
                {data.supportingEvidence.map((slot) => (
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
                        <p role="status" className="text-xs text-amber-700">
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
                        className="shrink-0 bg-white"
                        onClick={() => viewDocument(slot.current!.id)}
                      >
                        View
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {hasDocumentHistory && (
                <details className="rounded-xl border border-gray-200/80 bg-gray-50/30 px-4 py-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#333333]">
                    <History className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    View document history
                  </summary>
                  <div className="mt-3">
                    <ul className="space-y-1.5">
                      {data.supportingEvidence.flatMap((slot) =>
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
