"use client";

/**
 * CDW-5 — Committee Report tab.
 *
 * Assigned Rapporteur (canEditBody): a free-form rich-text authoring surface with
 * a compact, NON-editable system context, a formatting toolbar, Save Draft, and a
 * clean read-only Preview Report. There are no mandatory sections — the body is
 * whatever the Rapporteur authors. No evaluator controls.
 *
 * Chairman/Panelist/etc.: the same report body rendered READ-ONLY (semantic
 * elements, no editable DOM), or the legacy plain-text report, or a clear empty
 * state. Report-body edits and status transitions (freeze/signing) belong to the
 * Rapporteur / RAP-C1.
 *
 * Preview is explicitly NOT an institutional paper form — exact official-form
 * rendering is deferred to a later Official Defense Forms phase.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  PencilLine,
  Save,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, apiClientRequest } from "@/lib/api.client";
import {
  ReportAutosaveConflictError,
  ReportAutosaveController,
  type ReportAutosaveState,
} from "@/lib/report/report-autosave";
import {
  emptyReportDocument,
  isReportDocumentEmpty,
  normalizeReportDocument,
  type ReportDocument,
} from "@/lib/report/report-document";
import { shouldDisplayLiveReportPreview } from "@/lib/realtime/report-preview";
import type { DefenseWorkspace } from "@/types/defense-workspace";

import { useReportRealtime } from "./defense-realtime-context";
import { ReportDocumentCanvas, ReportDocumentView } from "./report-document-view";
import { RapSignaturePanel, type RapFreezeCheck, type RapSignerStatus } from "./rap-signature-panel";
import { RichTextReportEditor } from "./rich-text-report-editor";

export interface CommitteeReportReadModel {
  scheduleId: string;
  defenseType: string;
  sessionStatus: string;
  reportId: string | null;
  studentName: string;
  studentNumber: string | null;
  program: string | null;
  defenseDate: string | null;
  reportDate: string | null;
  venue: string | null;
  reportStatus: string;
  bodyVersion: number;
  contentVersion: number;
  body: ReportDocument | null;
  hasCollaborativeBody: boolean;
  legacyContent: {
    decisionsAndRecommendations: string | null;
    rapporteurNotes: string | null;
  };
  freeze: {
    frozenAt: string | null;
    frozenById: string | null;
    frozenContentHash: string | null;
  };
  canEditBody: boolean;
  // RAP-C1 freeze / signature lifecycle.
  canFreeze: boolean;
  freezeReadiness: { ready: boolean; checks: RapFreezeCheck[] };
  signatures: RapSignerStatus[];
  signatureProgress: { required: number; signed: number };
  mySignature: RapSignerStatus | null;
  canSign: boolean;
}

const DEFENSE_LABELS: Record<string, string> = {
  TITLE_DEFENSE: "Title Defense",
  PROPOSAL_DEFENSE: "Proposal Defense",
  FINAL_DEFENSE: "Final Defense",
};

/** RapStatus values that mean the Committee Report is frozen / signing has begun. */
const REPORT_FROZEN_STATUSES = [
  "FOR_SIGNATURE",
  "PARTIALLY_SIGNED",
  "ALL_SIGNED",
  "DISTRIBUTED",
  "FINALIZED",
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

/** Compact, NON-editable system-owned context (never part of the report body). */
function ReportContextBlock({ report }: { report: CommitteeReportReadModel }) {
  const items: Array<[string, string]> = [
    ["Student", report.studentName || "—"],
    ["Student No.", report.studentNumber || "—"],
    ["Program", report.program || "—"],
    ["Defense", DEFENSE_LABELS[report.defenseType] ?? report.defenseType],
    ["Defense Date", formatDate(report.defenseDate)],
  ];
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) px-3 py-2 text-[13px]">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <dt className="font-medium text-(--earist-secondary)">{label}:</dt>
          <dd className="text-(--earist-body)">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "NOT_CREATED" ? "Not started" : status.replace(/_/g, " ").toLowerCase();
  return <Badge variant="outline" className="capitalize">{label}</Badge>;
}

export function CommitteeReportPanel({
  workspace,
  scheduleId,
}: {
  workspace: DefenseWorkspace;
  scheduleId: string;
}) {
  const { data, isLoading, isError, refetch } = useQuery<CommitteeReportReadModel>({
    queryKey: ["committeeReport", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/collaboration/report`,
      )) as CommitteeReportReadModel,
    // Read-only committee viewers poll modestly for Rapporteur draft updates;
    // the Rapporteur's own authoring surface does not poll.
    refetchInterval: (query) =>
      (query.state.data as CommitteeReportReadModel | undefined)?.canEditBody
        ? false
        : 20000,
    staleTime: 5_000,
    retry: 1,
  });

  if (isLoading && !data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[15px] text-(--earist-body-text)">
        Loading Committee Report…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-[15px] text-amber-700">
          {isError
            ? "The Committee Report could not be loaded."
            : "No committee report is available for this defense yet."}
        </p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return data.canEditBody ? (
    <ReportAuthoringPanel
      scheduleId={scheduleId}
      report={data}
      reloadReport={async () => {
        const result = await refetch();
        return result.data ?? null;
      }}
    />
  ) : (
    <ReportReadOnly report={data} role={workspace.myAssignment.role} />
  );
}

function initialSaveState(report: CommitteeReportReadModel): ReportAutosaveState {
  const hasSavedBody = Boolean(report.reportId) || report.hasCollaborativeBody;
  return {
    status: hasSavedBody ? "saved" : "clean",
    bodyVersion: report.bodyVersion ?? 0,
    hasUnsavedChanges: false,
    error: null,
    savedAt: null,
  };
}

function SaveStateIndicator({
  state,
  hasSavedReport,
}: {
  state: ReportAutosaveState;
  hasSavedReport: boolean;
}) {
  const label =
    state.status === "saving"
      ? "Saving…"
      : state.status === "dirty"
        ? "Unsaved changes"
        : state.status === "offline"
          ? "Offline — changes not saved"
          : state.status === "conflict"
            ? "Save conflict — refresh/reconcile required"
            : state.status === "error"
              ? state.error
                ? `Save failed — ${state.error}`
                : "Save failed"
              : state.status === "clean" && !hasSavedReport
                ? "Not saved yet"
                : "Saved";

  if (state.status === "conflict" || state.status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-red-600">
        <AlertCircle className="h-4 w-4" /> {label}
      </span>
    );
  }

  if (state.status === "offline") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-amber-700">
        <WifiOff className="h-4 w-4" /> {label}
      </span>
    );
  }

  if (state.status === "saved" && !state.hasUnsavedChanges) {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> {label}
      </span>
    );
  }

  return (
    <span className="text-[13px] text-(--earist-body-text)">{label}</span>
  );
}

function ReportAuthoringPanel({
  scheduleId,
  report,
  reloadReport,
}: {
  scheduleId: string;
  report: CommitteeReportReadModel;
  reloadReport: () => Promise<CommitteeReportReadModel | null>;
}) {
  const queryClient = useQueryClient();
  const { sendReportPreview } = useReportRealtime();

  const initialBodyRef = useRef<ReportDocument>(
    report.body ? normalizeReportDocument(report.body) : emptyReportDocument(),
  );
  const initialVersionRef = useRef<number>(report.bodyVersion ?? 0);

  const [body, setBody] = useState<ReportDocument>(() =>
    report.body ? normalizeReportDocument(report.body) : emptyReportDocument(),
  );
  const [saveState, setSaveState] = useState<ReportAutosaveState>(() =>
    initialSaveState(report),
  );
  const [previewing, setPreviewing] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [reloading, setReloading] = useState(false);
  const controllerRef = useRef<ReportAutosaveController | null>(null);

  const legacyText =
    report.legacyContent.decisionsAndRecommendations ??
    report.legacyContent.rapporteurNotes;
  const showLegacyNotice = !report.hasCollaborativeBody && Boolean(legacyText);

  useEffect(() => {
    const controller = new ReportAutosaveController({
      initialBody: initialBodyRef.current,
      initialBodyVersion: initialVersionRef.current,
      debounceMs: 2000,
      maxWaitMs: 10000,
      onStateChange: setSaveState,
      save: async ({ body: nextBody, expectedBodyVersion }) => {
        try {
          const result = (await apiClientRequest(
            `/thesis/defense/${scheduleId}/collaboration/report`,
            {
              method: "PUT",
              body: JSON.stringify({
                body: nextBody,
                expectedBodyVersion,
              }),
            },
          )) as { bodyVersion?: unknown };

          const bodyVersion =
            typeof result.bodyVersion === "number"
              ? result.bodyVersion
              : expectedBodyVersion + 1;

          // The authoritative refetch remains the rendered source of truth.
          void queryClient.invalidateQueries({
            queryKey: ["committeeReport", scheduleId],
          });

          return { bodyVersion };
        } catch (error) {
          if (error instanceof ApiError && error.statusCode === 409) {
            throw new ReportAutosaveConflictError(error.message);
          }
          throw error;
        }
      },
    });

    controllerRef.current = controller;

    if (typeof navigator !== "undefined") {
      controller.setOnline(navigator.onLine);
    }

    const onOnline = () => controller.setOnline(true);
    const onOffline = () => controller.setOnline(false);
    const flush = () => controller.flushNow();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") controller.flushNow();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!controller.hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("blur", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("blur", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Unmounting must drain, not abandon, the newest dirty body. `dispose()`
      // rejects new edits, waits for any in-flight request, then saves the newest
      // local body with the server-returned bodyVersion before settling.
      void controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [queryClient, scheduleId]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    const state = controller.getState();
    const serverVersion = report.bodyVersion ?? 0;

    if (
      !state.hasUnsavedChanges &&
      state.status !== "conflict" &&
      serverVersion > state.bodyVersion
    ) {
      // No local work can be lost: adopt the newer authoritative saved draft so
      // an older clean editor can never silently overwrite it on its next edit.
      const nextBody = report.body
        ? normalizeReportDocument(report.body)
        : emptyReportDocument();
      setBody(nextBody);
      setEditorKey((key) => key + 1);
      controller.reloadFromServer(nextBody, serverVersion);
      return;
    }

    controller.syncServerVersion(serverVersion);
  }, [report.body, report.bodyVersion]);

  const handleBodyChange = (doc: ReportDocument) => {
    const normalized = normalizeReportDocument(doc);
    setBody(normalized);
    controllerRef.current?.update(normalized);

    sendReportPreview({
      baseBodyVersion:
        controllerRef.current?.getServerVersion() ?? report.bodyVersion ?? 0,
      body: normalized,
    });
  };

  const handleReloadSaved = async () => {
    setReloading(true);
    try {
      const latest = await reloadReport();
      if (!latest) return;

      const nextBody = latest.body
        ? normalizeReportDocument(latest.body)
        : emptyReportDocument();

      setBody(nextBody);
      setEditorKey((key) => key + 1);
      controllerRef.current?.reloadFromServer(
        nextBody,
        latest.bodyVersion ?? 0,
      );
    } finally {
      setReloading(false);
    }
  };

  const conflict = saveState.status === "conflict";
  const dirty = saveState.hasUnsavedChanges;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-(--earist-primary)">
          <FileText className="h-5 w-5" /> Committee Report
        </h2>
        <StatusBadge status={report.reportStatus === "NOT_CREATED" ? "DRAFT" : report.reportStatus} />
        <span className="text-[13px] text-(--earist-body-text)">
          {dirty ? "Draft (unsaved)" : "Draft"}
        </span>
      </div>

      <ReportContextBlock report={report} />

      {showLegacyNotice && <LegacyAuthoringNotice legacyText={legacyText as string} />}

      <RapSignaturePanel
        scheduleId={scheduleId}
        reportStatus={report.reportStatus === "NOT_CREATED" ? "DRAFT" : report.reportStatus}
        contentVersion={report.contentVersion}
        canFreeze={report.canFreeze}
        freezeReadiness={report.freezeReadiness}
        signatures={report.signatures}
        signatureProgress={report.signatureProgress}
        canSign={report.canSign}
        mySignature={report.mySignature}
      />

      {previewing ? (
        <ReportPreview
          doc={body}
          unsaved={saveState.hasUnsavedChanges}
          onBack={() => setPreviewing(false)}
        />
      ) : (
        <RichTextReportEditor
          key={editorKey}
          initialDocument={body}
          onChange={handleBodyChange}
        />
      )}

      <footer className="sticky bottom-0 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border-t border-(--earist-border-gray) bg-white/95 px-1 pt-2 backdrop-blur motion-reduce:backdrop-blur-none">
        {previewing ? (
          <Button type="button" variant="outline" onClick={() => setPreviewing(false)}>
            <PencilLine className="mr-2 h-4 w-4" /> Back to editor
          </Button>
        ) : (
          <>
            <Button
              type="button"
              disabled={saveState.status === "saving" || conflict}
              onClick={() => controllerRef.current?.flushNow()}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveState.status === "saving" ? "Saving…" : "Save now"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewing(true)}
            >
              <Eye className="mr-2 h-4 w-4" /> Preview Report
            </Button>
            {conflict && (
              <Button
                type="button"
                variant="outline"
                disabled={reloading}
                onClick={() => void handleReloadSaved()}
              >
                {reloading ? "Reloading…" : "Reload saved version"}
              </Button>
            )}
            <SaveStateIndicator
              state={saveState}
              hasSavedReport={Boolean(report.reportId) || report.hasCollaborativeBody}
            />
          </>
        )}
      </footer>
    </div>
  );
}

/** Legacy plain-text report shown READ-ONLY alongside the new editor (no conversion). */
function LegacyAuthoringNotice({ legacyText }: { legacyText: string }) {
  return (
    <section className="shrink-0 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-[13px] font-semibold text-amber-900">
        Legacy report content (read-only)
      </p>
      <p className="max-h-40 overflow-auto rounded border border-amber-200 bg-white p-3 text-[14px] whitespace-pre-wrap text-(--earist-body)">
        {legacyText}
      </p>
      <p className="text-[13px] text-amber-900">
        This report was created using the legacy report format and is not
        converted. Saving new structured content below does not delete or change it.
      </p>
    </section>
  );
}

function ReportPreview({
  doc,
  unsaved,
  onBack,
}: {
  doc: ReportDocument;
  unsaved: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold text-(--earist-primary)">Preview Report</h3>
        <Badge variant="outline">Read-only</Badge>
        {unsaved && (
          <Badge className="bg-amber-100 text-amber-800">Includes unsaved changes</Badge>
        )}
        <span className="text-[13px] text-(--earist-body-text)">
          Content preview — not an official institutional form.
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--earist-border-gray)">
        <ReportDocumentCanvas>
          {isReportDocumentEmpty(doc) ? (
            <p className="text-[15px] text-(--earist-body-text)">
              The report is empty. Add content in the editor.
            </p>
          ) : (
            <ReportDocumentView doc={doc} />
          )}
        </ReportDocumentCanvas>
      </div>
      <div className="shrink-0">
        <Button type="button" variant="outline" onClick={onBack}>
          <PencilLine className="mr-2 h-4 w-4" /> Back to editor
        </Button>
      </div>
    </div>
  );
}

function ReportReadOnly({
  report,
  role,
}: {
  report: CommitteeReportReadModel;
  role: string;
}) {
  const { liveReportPreview } = useReportRealtime();
  const hasBody = report.hasCollaborativeBody && report.body;
  const legacyText =
    report.legacyContent.decisionsAndRecommendations ??
    report.legacyContent.rapporteurNotes;
  const livePreview =
    liveReportPreview &&
    shouldDisplayLiveReportPreview({
      preview: liveReportPreview,
      scheduleId: report.scheduleId,
      reportStatus: report.reportStatus,
      authoritativeBodyVersion: report.bodyVersion ?? 0,
    })
      ? liveReportPreview
      : null;

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-(--earist-primary)">
            <FileText className="h-5 w-5" /> Committee Report
          </h2>
          <StatusBadge status={report.reportStatus} />
          <span
            className="inline-flex min-h-5 min-w-[6.75rem] items-center"
            aria-live="polite"
          >
            {livePreview && (
              <Badge
                className="bg-amber-100 text-amber-800"
                title="Live preview — the Rapporteur's current unsaved wording. The saved Committee Report replaces it when available."
              >
                Live — unsaved
                <span className="sr-only">
                  {" — Rapporteur wording, not the saved Committee Report draft."}
                </span>
              </Badge>
            )}
          </span>
        </div>

        <ReportContextBlock report={report} />

        {REPORT_FROZEN_STATUSES.includes(report.reportStatus) && (
          <RapSignaturePanel
            scheduleId={report.scheduleId}
            reportStatus={report.reportStatus}
            contentVersion={report.contentVersion}
            canFreeze={false}
            freezeReadiness={report.freezeReadiness}
            signatures={report.signatures}
            signatureProgress={report.signatureProgress}
            canSign={report.canSign}
            mySignature={report.mySignature}
          />
        )}

        {livePreview ? (
          <section>
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-amber-300">
              <ReportDocumentCanvas>
                <ReportDocumentView doc={livePreview.body} />
              </ReportDocumentCanvas>
            </div>
          </section>
        ) : hasBody ? (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-(--earist-border-gray)">
            <ReportDocumentCanvas>
              <ReportDocumentView doc={report.body} />
            </ReportDocumentCanvas>
          </div>
        ) : legacyText ? (
          <section className="space-y-1">
            <h3 className="text-[13px] font-semibold tracking-wide text-(--earist-body-text) uppercase">
              Committee Report (legacy, read-only)
            </h3>
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-(--earist-border-gray)">
              <ReportDocumentCanvas>
                <div className="cdwReportBody text-[16px]">
                  <p className="whitespace-pre-wrap">{legacyText}</p>
                </div>
              </ReportDocumentCanvas>
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-dashed border-(--earist-border-gray) p-8 text-center">
            <p className="text-[15px] text-(--earist-body-text)">
              {role === "RAPPORTEUR"
                ? "You have not started the Committee Report yet."
                : "The Rapporteur has not started the Committee Report yet."}
            </p>
          </div>
        )}

        {report.freeze.frozenAt && (
          <p className="text-[13px] text-(--earist-body-text)">
            This report was frozen for signatures on{" "}
            {new Date(report.freeze.frozenAt).toLocaleString()}.
          </p>
        )}
      </div>
    </div>
  );
}
