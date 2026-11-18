"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { downloadOfficialDefensePdf } from "@/lib/official-defense-documents.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentViewer } from "@/components/ui/document-viewer";

export const adviserCertificationRecordsQueryKey = ["adviser-certification-records"] as const;

export interface CertificationRecord {
  id: string; thesisId: string; stage: "PROPOSAL" | "FINAL"; status: "ISSUED";
  studentName: string; adviserName: string; issuedAt: string | null;
  manuscriptTitle: string | null; originalFilename: string | null; manuscriptDocumentId: string | null;
  pdfAvailable: boolean; unavailableReason: string | null;
}

/** Issued records are read-only references, separate from actionable review work. */
type RecordProps = { thesisId?: string; stage?: "PROPOSAL" | "FINAL"; exactRecords?: CertificationRecord[] };

export function AdviserCertificationRecords(props: RecordProps) {
  const { data: session } = useSession();
  if (!session?.user?.id) return null;
  const viewerScope = `${session.user.id}:${session.user.role}`;
  return <CertificationRecordList key={`${viewerScope}:${props.thesisId ?? "own"}:${props.stage ?? "all"}:${props.exactRecords?.map(record => record.id).join(",") ?? "list"}`} {...props} viewerScope={viewerScope} />;
}

function CertificationRecordList({ thesisId, stage, viewerScope, exactRecords }: RecordProps & { viewerScope: string }) {
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = new URLSearchParams();
  if (thesisId) query.set("thesisId", thesisId);
  if (stage) query.set("stage", stage);
  const records = useQuery<CertificationRecord[]>({
    queryKey: [...adviserCertificationRecordsQueryKey, viewerScope, thesisId ?? "own", stage ?? "all"],
    queryFn: async () => await apiClientRequest(`/thesis/adviser-certifications?${query}`) as CertificationRecord[],
    retry: false,
    enabled: exactRecords === undefined,
  });
  if (exactRecords === undefined && records.isLoading) return <p className="text-sm" aria-live="polite">Loading certification records…</p>;
  if (exactRecords === undefined && records.isError) return <div role="alert" className="text-sm">
    Certification records could not be loaded. <Button variant="outline" size="sm" onClick={() => records.refetch()}>Try again</Button>
  </div>;
  const items = exactRecords ?? records.data;
  if (!items?.length) return null;
  return (
    <section
      className="space-y-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
      aria-label="Adviser Certification"
    >
      <h3 className="text-base font-bold text-[#333333]">
        Adviser Certification
      </h3>
      {items.map((record) => (
        <div
          key={record.id}
          className="space-y-3 rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-4 text-sm break-words"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-emerald-900">
              {record.stage === "PROPOSAL" ? "Proposal Defense" : "Final Defense"} — Certified
            </p>
            <Badge
              variant="outline"
              className="border-emerald-200 bg-white text-emerald-700"
            >
              {record.studentName}
            </Badge>
          </div>
          <div className="rounded-lg border border-white/80 bg-white/90 p-3">
            <p className="text-xs font-medium text-gray-500">
              Thesis/Dissertation Title
            </p>
            <p className="mt-0.5 font-semibold text-[#333333]">
              <span className="sr-only">Thesis/Dissertation Title: </span>
              {record.manuscriptTitle || "Title not recorded for this manuscript."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <span className="font-medium text-[#333333]">
              {record.originalFilename || "Filename unavailable"}
            </span>
            <span>
              Certified by {record.adviserName}
              {record.issuedAt
                ? ` on ${new Date(record.issuedAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}`
                : ""}
            </span>
          </div>
          {!record.pdfAvailable && (
            <p role="status" className="text-xs text-amber-700">
              Adviser Certification is not available for this record.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {record.manuscriptDocumentId && (
              <Button
                size="sm"
                variant="outline"
                className="bg-white"
                onClick={() =>
                  setPreview({
                    url: `/api/documents/thesis-document/${record.manuscriptDocumentId}/file`,
                    title: "Manuscript",
                  })
                }
              >
                View Manuscript
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              disabled={!record.pdfAvailable}
              onClick={() =>
                setPreview({
                  url: `/api/adviser-certifications/${record.id}/pdf`,
                  title: "Adviser Certification",
                })
              }
            >
              View Certification
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              disabled={!record.pdfAvailable || busyId !== null}
              onClick={async () => {
                setBusyId(record.id);
                setError(null);
                try {
                  await downloadOfficialDefensePdf(
                    `/thesis/adviser-certifications/${record.id}/pdf`,
                    "Adviser-Certification.pdf",
                  );
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "The certification could not be downloaded.",
                  );
                } finally {
                  setBusyId(null);
                }
              }}
            >
              {busyId === record.id ? "Downloading…" : "Download Certification"}
            </Button>
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
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
    </section>
  );
}
