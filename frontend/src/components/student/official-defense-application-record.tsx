"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { downloadOfficialDefensePdf } from "@/lib/official-defense-documents.client";
import { Button } from "@/components/ui/button";
import { DocumentViewer } from "@/components/ui/document-viewer";

interface Availability {
  scheduleId: string;
  defenseType?: string;
  available: boolean;
  unavailableReason: string | null;
}

export function StudentOfficialApplicationRecord({
  scheduleId,
}: {
  scheduleId: string;
}) {
  const { data: session } = useSession();
  if (!session?.user?.id || session.user.role !== "student") return null;
  const viewerScope = `${session.user.id}:${session.user.role}`;
  return (
    <OwnedApplication
      key={`${viewerScope}:${scheduleId}`}
      scheduleId={scheduleId}
      viewerScope={viewerScope}
    />
  );
}

function OwnedApplication({
  scheduleId,
  viewerScope,
}: {
  scheduleId: string;
  viewerScope: string;
}) {
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `/thesis/student/defense/${encodeURIComponent(scheduleId)}/application`;
  const query = useQuery<Availability>({
    queryKey: ["student-official-application", viewerScope, scheduleId],
    queryFn: async () => (await apiClientRequest(path)) as Availability,
    retry: false,
  });
  if (query.isLoading)
    return (
      <p aria-live="polite">Checking official application availability…</p>
    );
  if (query.isError)
    return (
      <p role="status">
        Official application availability could not be checked.{" "}
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </p>
    );
  const record = query.data;
  if (!record?.available || record.scheduleId !== scheduleId)
    return (
      <p role="status">
        The official application is not yet available for this schedule.
      </p>
    );
  return (
    <section
      className="space-y-2 border-t pt-3"
      aria-label="Official Defense Application"
    >
      <h3 className="font-semibold">
        Official Defense Application ·{" "}
        {record.defenseType?.replaceAll("_", " ")}
      </h3>
      <p>
        This is your official Defense Application record. No additional upload
        or submission is required unless instructed by the Graduate School.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setPreview(true)}>
          View Official Application
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await downloadOfficialDefensePdf(
                `${path}/pdf`,
                "Defense-Application.pdf",
              );
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "The official application could not be downloaded.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Downloading…" : "Download Copy"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {preview && (
        <DocumentViewer
          open
          onOpenChange={setPreview}
          fetchUrl={`/api/student-defense-applications/${encodeURIComponent(scheduleId)}/pdf`}
          title="Official Defense Application"
        />
      )}
    </section>
  );
}
