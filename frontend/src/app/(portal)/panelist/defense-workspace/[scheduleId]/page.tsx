"use client";

/**
 * CDW-4 — immersive Defense Workspace route.
 *
 * The page is a thin orchestrator: it loads the server-authoritative workspace
 * read model, wraps the immersive shell in the StudentDocumentCollaboration
 * provider (the single annotation-data source), and hands the shell the exact
 * attempt document. Layout, role rail, evaluation UX, and the Shared Comments
 * rail live in dedicated components.
 */

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { apiClientRequest } from "@/lib/api.client";
import { StudentDocumentCollaboration } from "@/components/defense-workspace/student-document-collaboration";
import { ReportComposerProvider } from "@/components/defense-workspace/report-composer-context";
import { WorkspaceShell } from "@/components/defense-workspace/workspace-shell";
import type { DefenseWorkspace } from "@/types/defense-workspace";

export default function DefenseWorkspacePage() {
  const params = useParams<{ scheduleId: string }>();
  const scheduleId = params.scheduleId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["defenseWorkspace", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/workspace`,
      )) as DefenseWorkspace,
    refetchInterval: (q) => {
      const ws = q.state.data as DefenseWorkspace | undefined;
      const s = ws?.schedule.sessionStatus;
      return s === "SCHEDULED" || s === "IN_PROGRESS" || s === "AWAITING_CONCLUSION"
        ? 20000
        : false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--earist-surface-gray)">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--earist-primary)" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex h-screen max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-red-600">
          {(error as Error)?.message || "You are not assigned to this defense session."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded border border-(--earist-border-gray) px-3 py-1.5 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  const primaryDoc = data.documents[0];
  const isFinal = data.schedule.defenseType === "FINAL_DEFENSE";
  const documentLabel = isFinal
    ? "Current Final Manuscript"
    : primaryDoc?.displayName || "Student document";

  return primaryDoc ? (
    <StudentDocumentCollaboration
      scheduleId={scheduleId}
      documentId={primaryDoc.id}
      documentLabel={documentLabel}
      role={data.myAssignment.role}
      sessionStatus={data.schedule.sessionStatus}
      rapStatus={data.rapStatus}
    >
      <ReportComposerProvider>
        <WorkspaceShell workspace={data} scheduleId={scheduleId} hasDocument />
      </ReportComposerProvider>
    </StudentDocumentCollaboration>
  ) : (
    <ReportComposerProvider>
      <WorkspaceShell workspace={data} scheduleId={scheduleId} hasDocument={false} />
    </ReportComposerProvider>
  );
}
