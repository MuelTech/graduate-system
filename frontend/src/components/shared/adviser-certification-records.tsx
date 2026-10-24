"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { downloadOfficialDefensePdf } from "@/lib/official-defense-documents.client";
import { Button } from "@/components/ui/button";
import { DocumentViewer } from "@/components/ui/document-viewer";

export const adviserCertificationRecordsQueryKey = ["adviser-certification-records"] as const;

interface CertificationRecord {
  id: string; thesisId: string; stage: "PROPOSAL" | "FINAL"; status: "ISSUED";
  studentName: string; adviserName: string; issuedAt: string | null;
  manuscriptTitle: string | null; originalFilename: string | null; manuscriptDocumentId: string | null;
  pdfAvailable: boolean; unavailableReason: string | null;
}

/** Issued records are read-only references, separate from actionable review work. */
type RecordProps = { thesisId?: string; stage?: "PROPOSAL" | "FINAL" };

export function AdviserCertificationRecords(props: RecordProps) {
  const { data: session } = useSession();
  if (!session?.user?.id) return null;
  const viewerScope = `${session.user.id}:${session.user.role}`;
  return <CertificationRecordList key={`${viewerScope}:${props.thesisId ?? "own"}:${props.stage ?? "all"}`} {...props} viewerScope={viewerScope} />;
}

function CertificationRecordList({ thesisId, stage, viewerScope }: RecordProps & { viewerScope: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = new URLSearchParams();
  if (thesisId) query.set("thesisId", thesisId);
  if (stage) query.set("stage", stage);
  const records = useQuery<CertificationRecord[]>({
    queryKey: [...adviserCertificationRecordsQueryKey, viewerScope, thesisId ?? "own", stage ?? "all"],
    queryFn: async () => await apiClientRequest(`/thesis/adviser-certifications?${query}`) as CertificationRecord[],
    retry: false,
  });
  if (records.isLoading) return <p className="text-sm" aria-live="polite">Loading certification records…</p>;
  if (records.isError) return <div role="alert" className="text-sm">
    Certification records could not be loaded. <Button variant="outline" size="sm" onClick={() => records.refetch()}>Try again</Button>
  </div>;
  if (!records.data?.length) return null;
  return <section className="space-y-3" aria-label="Issued Adviser certifications">
    <h3 className="text-sm font-semibold text-(--earist-secondary)">Issued Adviser Certifications</h3>
    {records.data.map(record => <div key={record.id} className="space-y-2 rounded-lg border border-(--earist-border-gray) p-3 text-sm break-words">
      <p className="font-medium">{record.stage === "PROPOSAL" ? "Proposal" : "Final"} certification issued · {record.studentName}</p>
      <p><span className="font-medium">Thesis/Dissertation Title: </span>{record.manuscriptTitle || "Title not recorded for this manuscript."}</p>
      <p>{record.originalFilename || "Filename unavailable"}</p>
      <p className="text-xs">Certified by {record.adviserName}{record.issuedAt ? ` on ${new Date(record.issuedAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}` : ""}</p>
      <p className="text-xs">This is an official record. No additional upload or submission is required.</p>
      {!record.pdfAvailable && <p role="status" className="text-xs">{record.unavailableReason || "GS-017 is unavailable for this record."}</p>}
      <div className="flex flex-wrap gap-2">
        {record.manuscriptDocumentId && <Button size="sm" variant="outline" onClick={() => setPreview(`/api/documents/thesis-document/${record.manuscriptDocumentId}/file`)}>View certified manuscript</Button>}
        <Button size="sm" variant="outline" disabled={!record.pdfAvailable} onClick={() => setPreview(`/api/adviser-certifications/${record.id}/pdf`)}>View GS-017</Button>
        <Button size="sm" variant="outline" disabled={!record.pdfAvailable || busyId !== null} onClick={async () => {
          setBusyId(record.id); setError(null);
          try { await downloadOfficialDefensePdf(`/thesis/adviser-certifications/${record.id}/pdf`, "Adviser-Certification-GS-017.pdf"); }
          catch (failure) { setError(failure instanceof Error ? failure.message : "The certification could not be downloaded."); }
          finally { setBusyId(null); }
        }}>{busyId === record.id ? "Downloading…" : "Download Copy"}</Button>
      </div>
    </div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {preview && <DocumentViewer key={preview} open onOpenChange={open => { if (!open) setPreview(null); }} fetchUrl={preview} title="Official certification record" />}
  </section>;
}
