"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { downloadOfficialDefensePdf } from "@/lib/official-defense-documents.client";
import { Button } from "@/components/ui/button";
import { DocumentViewer } from "@/components/ui/document-viewer";

export const adviserRequestRecordsQueryKey = ["adviser-request-records"] as const;
interface AdviserRequestRecord {
  id: string;
  studentName: string;
  requestedAdviserName: string;
  requestDate: string;
  finalizedAt: string;
  status: "APPROVED";
  pdfAvailable: boolean;
}

export function AdviserRequestRecords({ audience }: { audience: "student" | "adviser" | "admin" }) {
  const { data: session } = useSession();
  if (!session?.user?.id) return null;
  const viewerScope = `${session.user.id}:${session.user.role}`;
  return <RecordList key={viewerScope} viewerScope={viewerScope} audience={audience} />;
}

function RecordList({ viewerScope, audience }: { viewerScope: string; audience: "student" | "adviser" | "admin" }) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const records = useQuery<AdviserRequestRecord[]>({
    queryKey: [...adviserRequestRecordsQueryKey, viewerScope],
    queryFn: async () => await apiClientRequest("/thesis/adviser/requests/records") as AdviserRequestRecord[],
    retry: false,
  });
  if (records.isLoading) return <p className="text-sm" aria-live="polite">Loading Adviser Request records…</p>;
  if (records.isError) return <div role="alert" className="text-sm">
    Adviser Request records could not be loaded. <Button size="sm" variant="outline" onClick={() => records.refetch()}>Try again</Button>
  </div>;
  if (!records.data?.length) return null;
  return <section aria-label="Adviser Request" className="space-y-3">
    <h3 className="text-sm font-semibold text-(--earist-secondary)">Adviser Request</h3>
    <p className="text-sm text-(--earist-body-text)">{audience === "student"
      ? "This is the official record of your approved adviser request, including the Adviser’s confirmation and Graduate School approval."
      : audience === "adviser"
        ? "This is the official record of the student’s adviser request that you confirmed and that was approved by the Graduate School."
        : "Approved Adviser Request records"}</p>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {records.data.map(record => <div key={record.id} className="flex flex-col justify-between gap-3 rounded-xl border border-gray-200/80 bg-white p-4 text-sm break-words shadow-2xs">
        <div className="space-y-1">
          <p className="font-semibold text-[#333333]">{record.studentName}</p>
          <p className="text-[#333333]">Adviser: {record.requestedAdviserName}</p>
          <p className="text-xs text-(--earist-body-text)">Requested {record.requestDate} · Approved {new Date(record.finalizedAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</p>
          {!record.pdfAvailable && <p role="status">Adviser Request is unavailable for this record.</p>}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" disabled={!record.pdfAvailable} onClick={() => setPreviewId(record.id)}>View Adviser Request</Button>
          <Button size="sm" variant="outline" disabled={!record.pdfAvailable || busyId !== null} onClick={async () => {
            setBusyId(record.id); setError(null);
            try { await downloadOfficialDefensePdf(`/thesis/adviser/requests/${encodeURIComponent(record.id)}/pdf`, "Adviser-Request.pdf"); }
            catch (failure) { setError(failure instanceof Error ? failure.message : "The Adviser Request could not be downloaded."); }
            finally { setBusyId(null); }
          }}>{busyId === record.id ? "Downloading…" : "Download Adviser Request"}</Button>
        </div>
      </div>)}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {previewId && <DocumentViewer key={previewId} open onOpenChange={open => { if (!open) setPreviewId(null); }}
      fetchUrl={`/api/adviser-requests/${encodeURIComponent(previewId)}/pdf`} title="Adviser Request" />}
  </section>;
}
