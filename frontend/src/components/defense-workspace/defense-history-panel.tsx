"use client";

/**
 * CDW-6 — Defense History control + read-only panel.
 *
 * Lives inside the Student Document experience. The Current Manuscript stays the
 * default; this opens a read-only panel of relevant PRIOR concluded attempts:
 *   - Previous Same-Stage Attempt (re-defense)
 *   - Previous Stage (normal progression)
 *   - Older History (secondary context)
 *
 * Every view is read-only: the historical manuscript viewer receives NO
 * annotation-creation callback, there is no comment composer, and there are no
 * RAP edit/freeze/sign actions. Compare with Current is a MANUAL side-by-side —
 * the system never claims that a recommendation was complied with.
 */

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Columns2,
  FileText,
  History,
  Loader2,
  MessageSquare,
  ScrollText,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeReportDocument } from "@/lib/report/report-document";
import {
  parseCollaborationAnnotations,
  type CollaborationAnnotation,
} from "@/lib/pdf-annotation/annotations";
import {
  HISTORY_RELATIONSHIP_LABELS,
  annotationsAvailabilityLabel,
  assignAttemptNumbers,
  defenseTypeLabel,
  formatHistoryDate,
  groupHistoryItems,
  historyVerdictLabel,
  manuscriptAvailabilityLabel,
  reportAvailabilityLabel,
} from "@/lib/defense-history/history-view";
import { useDefenseHistory, useDefenseHistoryAttempt } from "@/hooks/use-defense-history";
import type { DefenseHistoryItem, DefenseHistoryReport } from "@/types/defense-history";

import { AnnotationThread } from "./annotation-thread";
import { CollaborativeManuscriptViewer } from "./collaborative-manuscript-viewer";
import { ReportDocumentCanvas, ReportDocumentView } from "./report-document-view";
import { CollaborationViewerPane } from "./student-document-collaboration";

type DetailMode = "manuscript" | "report" | "annotations" | "compare";

/** Student Document toolbar control: "Defense History". */
export function DefenseHistoryControl({
  scheduleId,
  hasCurrentDocument,
}: {
  scheduleId: string;
  /** The current attempt has a bound manuscript (so Compare can render). */
  hasCurrentDocument: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <History className="mr-1 h-4 w-4" />
        Defense History
      </Button>
      {open && (
        <DefenseHistoryPanel
          scheduleId={scheduleId}
          hasCurrentDocument={hasCurrentDocument}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function DefenseHistoryPanel({
  scheduleId,
  hasCurrentDocument,
  onClose,
}: {
  scheduleId: string;
  hasCurrentDocument: boolean;
  onClose: () => void;
}) {
  const historyQuery = useDefenseHistory(scheduleId);
  const items = useMemo(() => historyQuery.data?.items ?? [], [historyQuery.data]);
  const grouped = useMemo(() => groupHistoryItems(items), [items]);
  const attemptNumbers = useMemo(() => assignAttemptNumbers(items), [items]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const selected =
    items.find((item) => item.scheduleId === selectedScheduleId) ?? items[0] ?? null;

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label="Defense History">
      <button
        type="button"
        aria-label="Close defense history"
        className="flex-1 bg-black/40"
        onClick={onClose}
      />
      <div className="flex h-full w-[min(92rem,97vw)] flex-col bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-(--earist-border-gray) px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-(--earist-primary)">
              <History className="h-5 w-5" />
              Defense History
            </h2>
            <p className="text-xs text-(--earist-body-text)">
              Read-only context from this thesis&apos;s prior concluded attempts. Historical
              records are never edited, reopened, or reused as current data.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close defense history"
            className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-(--earist-surface-gray)"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav className="shrink-0 overflow-auto border-b border-(--earist-border-gray) p-3 lg:w-96 lg:border-b-0 lg:border-r">
            {historyQuery.isLoading && (
              <p className="flex items-center gap-2 text-sm text-(--earist-body-text)">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
              </p>
            )}
            {historyQuery.isError && (
              <p className="flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4" /> History could not be loaded.
              </p>
            )}
            {!historyQuery.isLoading && !historyQuery.isError && items.length === 0 && (
              <p className="text-sm text-(--earist-body-text)">
                No prior defense attempts are available for this session.
              </p>
            )}

            <HistoryGroup
              title={HISTORY_RELATIONSHIP_LABELS.SAME_STAGE_REDEFENSE}
              items={grouped.sameStage}
              selectedScheduleId={selected?.scheduleId ?? null}
              onSelect={setSelectedScheduleId}
            />
            <HistoryGroup
              title={HISTORY_RELATIONSHIP_LABELS.PREVIOUS_STAGE}
              items={grouped.previousStage}
              selectedScheduleId={selected?.scheduleId ?? null}
              onSelect={setSelectedScheduleId}
            />
            <HistoryGroup
              title={HISTORY_RELATIONSHIP_LABELS.OLDER_HISTORY}
              items={grouped.olderHistory}
              selectedScheduleId={selected?.scheduleId ?? null}
              onSelect={setSelectedScheduleId}
            />
          </nav>

          <section className="min-h-0 flex-1 overflow-hidden">
            {selected ? (
              <HistoryAttemptDetail
                key={selected.scheduleId}
                scheduleId={scheduleId}
                item={selected}
                attemptNumber={attemptNumbers[selected.scheduleId] ?? null}
                hasCurrentDocument={hasCurrentDocument}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-(--earist-body-text)">
                Select a prior attempt to view its read-only manuscript, Committee Report, and
                historical annotations.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function HistoryGroup({
  title,
  items,
  selectedScheduleId,
  onSelect,
}: {
  title: string;
  items: DefenseHistoryItem[];
  selectedScheduleId: string | null;
  onSelect: (scheduleId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <section className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mb-1.5 w-full text-left text-[11px] font-semibold uppercase tracking-wide text-(--earist-secondary)"
        aria-expanded={open}
      >
        {title} ({items.length})
      </button>
      {open && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.scheduleId}>
              <HistoryCard
                item={item}
                active={item.scheduleId === selectedScheduleId}
                onSelect={() => onSelect(item.scheduleId)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryCard({
  item,
  active,
  onSelect,
}: {
  item: DefenseHistoryItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        "w-full rounded-lg border p-3 text-left text-sm transition-colors " +
        (active
          ? "border-(--earist-primary) bg-(--earist-surface-gray)"
          : "border-(--earist-border-gray) hover:border-(--earist-primary)")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-(--earist-body)">{defenseTypeLabel(item.defenseType)}</span>
        {historyVerdictLabel(item.verdict) && (
          <Badge variant="secondary">{historyVerdictLabel(item.verdict)}</Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-(--earist-body-text)">
        {formatHistoryDate(item.defenseDate)}
        {item.venueOrLink ? ` · ${item.venueOrLink}` : ""}
      </p>
      <ul className="mt-1 space-y-0.5 text-[11px] text-(--earist-body-text)">
        <li>{manuscriptAvailabilityLabel(item)}</li>
        <li>{reportAvailabilityLabel(item)}</li>
        <li>{annotationsAvailabilityLabel(item)}</li>
      </ul>
    </button>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="mr-1 inline-flex">{icon}</span>
      {children}
    </Button>
  );
}

function HistoryAttemptDetail({
  scheduleId,
  item,
  attemptNumber,
  hasCurrentDocument,
}: {
  scheduleId: string;
  item: DefenseHistoryItem;
  attemptNumber: number | null;
  hasCurrentDocument: boolean;
}) {
  const detailQuery = useDefenseHistoryAttempt(scheduleId, item.scheduleId, { enabled: true });
  const detail = detailQuery.data ?? null;

  const annotations: CollaborationAnnotation[] = useMemo(() => {
    if (!detail || !detail.manuscript) return [];
    return parseCollaborationAnnotations(detail, detail.manuscript.id).annotations;
  }, [detail]);

  const [mode, setMode] = useState<DetailMode>(item.manuscript ? "manuscript" : item.reportAvailable ? "report" : "annotations");
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null);

  const stageLabel = defenseTypeLabel(item.defenseType);
  const title = attemptNumber ? `${stageLabel} · Attempt ${attemptNumber}` : stageLabel;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-(--earist-border-gray) px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-(--earist-body)">{title}</h3>
          <Badge variant="outline">{HISTORY_RELATIONSHIP_LABELS[item.relationship]}</Badge>
          {historyVerdictLabel(item.verdict) && (
            <Badge variant="secondary">{historyVerdictLabel(item.verdict)}</Badge>
          )}
          <span className="text-xs text-(--earist-body-text)">
            {formatHistoryDate(item.concludedAt ?? item.defenseDate)}
          </span>
        </div>
        <p className="text-[11px] text-(--earist-body-text)">
          Historical attempt — read-only. This is prior context only; it is not the current
          attempt, and the system does not judge whether recommendations were complied with.
        </p>
        <div className="flex flex-wrap gap-2">
          <ModeButton
            active={mode === "manuscript"}
            disabled={!item.manuscript}
            onClick={() => setMode("manuscript")}
            icon={<FileText className="h-3.5 w-3.5" />}
          >
            View Previous Manuscript
          </ModeButton>
          <ModeButton
            active={mode === "report"}
            disabled={!item.reportAvailable}
            onClick={() => setMode("report")}
            icon={<ScrollText className="h-3.5 w-3.5" />}
          >
            View Previous RAP
          </ModeButton>
          <ModeButton
            active={mode === "annotations"}
            onClick={() => setMode("annotations")}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
          >
            View Historical Annotations
          </ModeButton>
          <ModeButton
            active={mode === "compare"}
            disabled={!item.manuscript || !hasCurrentDocument}
            onClick={() => setMode("compare")}
            icon={<Columns2 className="h-3.5 w-3.5" />}
          >
            Compare with Current
          </ModeButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {detailQuery.isLoading && (
          <p className="flex items-center gap-2 text-sm text-(--earist-body-text)">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading historical attempt…
          </p>
        )}
        {detailQuery.isError && (
          <p className="flex items-center gap-2 text-sm text-amber-700">
            <AlertCircle className="h-4 w-4" /> This historical attempt could not be loaded.
          </p>
        )}
        {detail && mode === "manuscript" && (
          <HistoricalManuscriptPane item={item} annotations={annotations} focusedAnnotationId={focusedAnnotationId} onAnnotationSelect={setFocusedAnnotationId} />
        )}
        {detail && mode === "report" && <HistoricalReportPane report={detail.report} />}
        {detail && mode === "annotations" && (
          <HistoricalAnnotationsPane annotations={annotations} item={item} />
        )}
        {detail && mode === "compare" && (
          <ComparePane item={item} annotations={annotations} hasCurrentDocument={hasCurrentDocument} />
        )}
      </div>
    </div>
  );
}

function ReadOnlyBanner() {
  return (
    <p className="mb-2 shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[13px] text-amber-800">
      Read-only historical attempt. Highlights and comments below belong to that attempt and
      cannot be created, edited, or replied to.
    </p>
  );
}

function HistoricalManuscriptPane({
  item,
  annotations,
  focusedAnnotationId,
  onAnnotationSelect,
}: {
  item: DefenseHistoryItem;
  annotations: CollaborationAnnotation[];
  focusedAnnotationId: string | null;
  onAnnotationSelect: (annotationId: string) => void;
}) {
  if (!item.manuscript) {
    return (
      <p className="text-sm text-(--earist-body-text)">Historical manuscript unavailable.</p>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReadOnlyBanner />
      <div className="min-h-0 flex-1">
        <CollaborativeManuscriptViewer
          documentId={item.manuscript.id}
          documentLabel={item.manuscript.displayName}
          annotations={annotations}
          focusedAnnotationId={focusedAnnotationId}
          onAnnotationSelect={onAnnotationSelect}
        />
      </div>
    </div>
  );
}

function HistoricalReportPane({
  report,
}: {
  report: DefenseHistoryReport | null;
}) {
  if (!report) {
    return (
      <p className="text-sm text-(--earist-body-text)">
        Historical report unavailable. Draft or pending report content is not shown as official
        history.
      </p>
    );
  }

  const isStructured = report.source === "STRUCTURED_RAP";
  const isLegacyNotes = report.source === "LEGACY_RAPPORTEUR_NOTES";
  const provenanceLabel = isStructured
    ? "Finalized Committee Report"
    : isLegacyNotes
      ? "Legacy Rapporteur Notes"
      : "Legacy historical Committee Report";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-(--earist-body-text)">
        <Badge variant="secondary">{provenanceLabel}</Badge>
        {report.finalizedAt && <span>{formatHistoryDate(report.finalizedAt)}</span>}
        {report.signatureProgress && (
          <span>
            {report.signatureProgress.signed} of {report.signatureProgress.required} signatures
          </span>
        )}
        {isLegacyNotes && !report.rapporteurNotesFinalizedAt && (
          <span>
            No finalization timestamp recorded — shown as historical notes because the attempt is
            concluded.
          </span>
        )}
      </div>

      {!isStructured && (
        <p className="mb-2 rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) px-3 py-1.5 text-[13px] text-(--earist-body-text)">
          {isLegacyNotes
            ? "This record predates the current in-system Committee Report workflow and is shown as originally stored. It is not a modern signed or finalized RAP."
            : "Legacy historical Committee Report — recorded before the in-system rich-text Committee Report. It is shown as originally stored and was not authored with the current editor."}
        </p>
      )}

      {isStructured ? (
        <ReportDocumentCanvas className="min-h-0 flex-1">
          <ReportDocumentView doc={normalizeReportDocument(report.bodyDocument)} />
        </ReportDocumentCanvas>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <pre className="whitespace-pre-wrap rounded bg-(--earist-surface-gray) p-3 text-sm">
            {report.text || "No committee report text recorded."}
          </pre>
        </div>
      )}
    </div>
  );
}

function HistoricalAnnotationsPane({
  annotations,
  item,
}: {
  annotations: CollaborationAnnotation[];
  item: DefenseHistoryItem;
}) {
  if (annotations.length === 0) {
    return (
      <p className="text-sm text-(--earist-body-text)">
        {item.manuscript
          ? "No historical annotations recorded for this attempt."
          : "Historical manuscript unavailable, so no historical annotations can be shown."}
      </p>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReadOnlyBanner />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
        {annotations.map((annotation) => (
          <div key={annotation.id} className="rounded-lg border border-(--earist-border-gray) p-3">
            <AnnotationThread
              annotation={annotation}
              canComment={false}
              onReply={() => undefined}
              isReplying={false}
              replyError={null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparePane({
  item,
  annotations,
  hasCurrentDocument,
}: {
  item: DefenseHistoryItem;
  annotations: CollaborationAnnotation[];
  hasCurrentDocument: boolean;
}) {
  if (!hasCurrentDocument) {
    return (
      <p className="text-sm text-(--earist-body-text)">
        The current attempt has no manuscript to compare against yet.
      </p>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-2 shrink-0 text-[13px] text-(--earist-body-text)">
        Manual side-by-side comparison. The system performs no textual or visual diff and does
        not determine whether any recommendation was addressed — that remains a human judgement.
      </p>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--earist-secondary)">
            Previous Manuscript (read-only)
          </h4>
          <div className="min-h-0 flex-1">
            {item.manuscript && (
              <CollaborativeManuscriptViewer
                documentId={item.manuscript.id}
                documentLabel={item.manuscript.displayName}
                annotations={annotations}
              />
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--earist-secondary)">
            Current Manuscript
          </h4>
          <div className="min-h-0 flex-1">
            <CollaborationViewerPane className="h-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
