"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { AdviserCertificationRecords } from "@/components/shared/adviser-certification-records";
import type { ScheduledDefenseSubmission } from "@/types/scheduled-defense-submission";

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
  function viewDocument(id: string) {
    setPreview(`/api/documents/thesis-document/${encodeURIComponent(id)}/file`);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Defense Submission</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm break-words">
        {query.isLoading && (
          <p aria-live="polite">Loading submission context…</p>
        )}
        {query.isError && (
          <div role="alert">
            Submission context could not be loaded.{" "}
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {data && (
          <>
            <p>
              Stage: {data.stage} · Schedule: {data.scheduleId}
            </p>
            <section className="space-y-2" aria-label="Exact Manuscript">
              <h3 className="font-semibold">Exact Manuscript</h3>
              {data.manuscriptIntegrityError && (
                <p role="alert" className="text-destructive">
                  {data.manuscriptIntegrityError}
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
                  <p>
                    {data.manuscript.originalFilename || "Filename unavailable"}
                  </p>
                  <p className="text-xs">Document: {data.manuscript.id}</p>
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
            {(data.stage === "PROPOSAL" || data.stage === "FINAL") && (
              <section className="space-y-2" aria-label="Adviser Certification">
                <h3 className="font-semibold">
                  Adviser Certification · GS-017
                </h3>
                {data.certification.record ? (
                  <AdviserCertificationRecords
                    thesisId={data.thesisId}
                    stage={data.stage}
                    exactRecords={[data.certification.record]}
                  />
                ) : (
                  <p role="status">
                    GS-017 is unavailable:{" "}
                    {data.certification.integrityState
                      .toLowerCase()
                      .replaceAll("_", " ")}
                    . An unambiguous issued certification for this exact
                    manuscript and stage is required.
                  </p>
                )}
              </section>
            )}
            <section className="space-y-3" aria-label="Supporting Evidence">
              <h3 className="font-semibold">Supporting Evidence</h3>
              <p className="text-xs">
                Current evidence and replacement history for this stage.
                Supporting evidence is not frozen at scheduling.
              </p>
              {data.supportingEvidence.map((slot) => (
                <div
                  key={slot.docType}
                  className="space-y-2 rounded border p-3"
                >
                  <p className="font-medium">
                    {slot.docType === "COR"
                      ? "Certificate of Registration (COR)"
                      : "Receipt / Proof of Payment"}
                  </p>
                  {slot.current ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        Current:{" "}
                        {slot.current.originalFilename ||
                          "Filename unavailable"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewDocument(slot.current!.id)}
                      >
                        View evidence
                      </Button>
                    </div>
                  ) : (
                    <p role="status">
                      {slot.integrityState === "AMBIGUOUS"
                        ? "Multiple current documents; evidence cannot be determined."
                        : "No current document recorded."}
                    </p>
                  )}
                  {!!slot.history.length && (
                    <details>
                      <summary className="cursor-pointer">
                        Replacement history ({slot.history.length})
                      </summary>
                      <div className="mt-2 space-y-2">
                        {slot.history.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span>
                              Superseded: {doc.originalFilename || doc.id}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewDocument(doc.id)}
                            >
                              View historical evidence
                            </Button>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
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
            title="Scheduled defense evidence"
          />
        )}
      </CardContent>
    </Card>
  );
}
