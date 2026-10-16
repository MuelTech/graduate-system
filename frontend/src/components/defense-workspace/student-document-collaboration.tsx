"use client";

/**
 * CDW-3/CDW-4 — Student Document collaboration provider.
 *
 * Owns the ONE React Query source for the current attempt's exact manuscript
 * (`documentId` is the server-resolved attempt document — never a latest/current
 * fallback), the selected-annotation/focus state, the pending text-selection draft,
 * and the create/reply mutations. CDW-4 composes the viewer and the Shared
 * Comments rail as separate immersive panes from this same context, so there is
 * never a duplicated annotation state.
 *
 * Writes are gated by role (Chairman/Panelist annotate; +Rapporteur comment) and
 * by state (active, non-frozen session). The backend remains authoritative; a 409
 * state change refreshes BOTH the annotations and the workspace query.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

import type { PdfAnchor } from "@/lib/pdf-annotation/anchors";
import {
  parseCollaborationAnnotations,
  type CollaborationAnnotation,
} from "@/lib/pdf-annotation/annotations";
import {
  canAnnotateRole,
  canCommentRole,
  collaborationErrorMessage,
  collaborationPollIntervalMs,
  isCollaborationActive,
} from "@/lib/pdf-annotation/collaboration-client";

import {
  useCreateDefenseAnnotation,
  useCreateDefenseComment,
  useDefenseAnnotations,
} from "@/hooks/use-defense-collaboration";

import { CollaborativeManuscriptViewer } from "./collaborative-manuscript-viewer";
import { SharedCommentsRail } from "./shared-comments-rail";

export interface StudentDocumentCollaborationProps {
  scheduleId: string;
  /** EXACT server-resolved attempt document id (never a latest fallback). */
  documentId: string;
  documentLabel?: string;
  /** The caller's defense role for THIS schedule (from the server assignment). */
  role: string;
  sessionStatus: string;
  rapStatus: string | null;
  children: ReactNode;
}

interface CollaborationContextValue {
  documentId: string;
  documentLabel?: string;
  active: boolean;
  canAnnotate: boolean;
  canComment: boolean;
  annotations: CollaborationAnnotation[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  selectedAnnotationId: string | null;
  selectAnnotation: (annotationId: string) => void;
  handleTextSelection?: (anchor: PdfAnchor) => void;
  pendingAnchor: PdfAnchor | null;
  submitNewComment: (body: string) => void;
  cancelNewComment: () => void;
  isCreating: boolean;
  createError: string | null;
  reply: (parentCommentId: string | null, body: string) => Promise<boolean>;
  isReplying: boolean;
  replyError: string | null;
  railView: "selected" | "all";
  setRailView: (view: "selected" | "all") => void;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

export function useCollaboration(): CollaborationContextValue {
  const ctx = useContext(CollaborationContext);
  if (!ctx) {
    throw new Error("useCollaboration must be used within StudentDocumentCollaboration.");
  }
  return ctx;
}

function isConflict(error: unknown): boolean {
  return (error as { statusCode?: number } | null)?.statusCode === 409;
}

export function StudentDocumentCollaboration({
  scheduleId,
  documentId,
  documentLabel,
  role,
  sessionStatus,
  rapStatus,
  children,
}: StudentDocumentCollaborationProps) {
  const active = isCollaborationActive(sessionStatus, rapStatus);
  const pollIntervalMs = collaborationPollIntervalMs(sessionStatus, rapStatus);
  const canAnnotate = active && canAnnotateRole(role);
  const canComment = active && canCommentRole(role);

  const queryClient = useQueryClient();
  const annotationsQuery = useDefenseAnnotations(scheduleId, documentId, {
    pollIntervalMs,
  });
  const createMutation = useCreateDefenseAnnotation(scheduleId, documentId);
  const replyMutation = useCreateDefenseComment(scheduleId, documentId);
  const {
    mutateAsync: createAnnotation,
    isPending: isCreating,
    error: createError,
    reset: resetCreate,
  } = createMutation;
  const {
    mutateAsync: createReply,
    isPending: isReplying,
    error: replyError,
    reset: resetReply,
  } = replyMutation;

  const annotations = useMemo(() => {
    if (annotationsQuery.data === undefined) return [];
    return parseCollaborationAnnotations(annotationsQuery.data, documentId).annotations;
  }, [annotationsQuery.data, documentId]);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<PdfAnchor | null>(null);
  const [railView, setRailView] = useState<"selected" | "all">("all");

  const selectedAnnotation =
    annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;

  /**
   * A 409 means the collaboration/report state changed (e.g. the RAP was frozen
   * or the attempt concluded). Refresh the annotations AND the workspace query
   * (state/role gating derive from it) so write controls update immediately.
   */
  const refreshAfterConflict = useCallback(() => {
    void annotationsQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["defenseWorkspace", scheduleId] });
  }, [annotationsQuery, queryClient, scheduleId]);

  const handleTextSelection = useCallback(
    (anchor: PdfAnchor) => {
      if (!canAnnotate) return;
      // Selection alone is NOT publication — it only opens the draft composer.
      // Starting a fresh composer session drops any previous mutation error.
      resetCreate();
      setSelectedAnnotationId(null);
      setPendingAnchor(anchor);
      setRailView("selected");
    },
    [canAnnotate, resetCreate],
  );

  const handleSelectAnnotation = useCallback(
    (annotationId: string) => {
      resetCreate();
      resetReply();
      setPendingAnchor(null);
      setSelectedAnnotationId(annotationId);
      setRailView("selected");
    },
    [resetCreate, resetReply],
  );

  const handleSubmitNewComment = useCallback(
    async (body: string) => {
      if (!pendingAnchor) return;
      try {
        const result = (await createAnnotation({
          thesisDocumentId: documentId,
          anchor: pendingAnchor,
          initialComment: body,
        })) as { annotation?: { id?: string } } | undefined;
        setPendingAnchor(null);
        const newId = result?.annotation?.id ?? null;
        if (newId) setSelectedAnnotationId(newId);
        setRailView("selected");
      } catch (error) {
        // Composer stays open with the typed text preserved.
        if (isConflict(error)) refreshAfterConflict();
      }
    },
    [createAnnotation, documentId, pendingAnchor, refreshAfterConflict],
  );

  const handleReply = useCallback(
    async (parentCommentId: string | null, body: string): Promise<boolean> => {
      if (!selectedAnnotation) return false;
      try {
        await createReply({
          annotationId: selectedAnnotation.id,
          body,
          parentCommentId,
        });
        return true;
      } catch (error) {
        if (isConflict(error)) refreshAfterConflict();
        return false;
      }
    },
    [createReply, refreshAfterConflict, selectedAnnotation],
  );

  const value: CollaborationContextValue = {
    documentId,
    documentLabel,
    active,
    canAnnotate,
    canComment,
    annotations,
    isLoading: annotationsQuery.isLoading,
    isError: annotationsQuery.isError,
    refetch: () => void annotationsQuery.refetch(),
    selectedAnnotationId,
    selectAnnotation: handleSelectAnnotation,
    handleTextSelection: canAnnotate ? handleTextSelection : undefined,
    pendingAnchor,
    submitNewComment: handleSubmitNewComment,
    cancelNewComment: () => {
      resetCreate();
      setPendingAnchor(null);
    },
    isCreating,
    createError: createError ? collaborationErrorMessage(createError) : null,
    reply: handleReply,
    isReplying,
    replyError: replyError ? collaborationErrorMessage(replyError) : null,
    railView,
    setRailView,
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}

/** Center pane: the exact attempt manuscript with highlight + selection support. */
export function CollaborationViewerPane({ className }: { className?: string }) {
  const c = useCollaboration();
  return (
    <div className={"min-w-0 " + (className ?? "")}>
      {!c.active && (
        <p className="mb-2 rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) px-3 py-1.5 text-xs text-(--earist-body-text)">
          Collaboration is read-only for this defense. Existing comments remain visible.
        </p>
      )}
      <CollaborativeManuscriptViewer
        documentId={c.documentId}
        documentLabel={c.documentLabel}
        annotations={c.annotations}
        onTextSelection={c.handleTextSelection}
        onAnnotationSelect={c.selectAnnotation}
        focusedAnnotationId={c.selectedAnnotationId}
      />
      {c.isError && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-(--earist-border-gray) bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <span>Stored annotations could not be loaded. The manuscript is still available.</span>
          <Button type="button" variant="outline" size="xs" onClick={c.refetch}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

/** Right pane: the committee Shared Comments rail. */
export function CollaborationRailPane({ className }: { className?: string }) {
  const c = useCollaboration();
  return (
    <div className={className}>
      <SharedCommentsRail
        annotations={c.annotations}
        selectedAnnotationId={c.selectedAnnotationId}
        onSelectAnnotation={c.selectAnnotation}
        isLoading={c.isLoading}
        isError={c.isError}
        onRetry={c.refetch}
        canAnnotate={c.canAnnotate}
        canComment={c.canComment}
        pendingAnchor={c.pendingAnchor}
        isCreating={c.isCreating}
        createError={c.createError}
        onSubmitNewComment={c.submitNewComment}
        onCancelNewComment={c.cancelNewComment}
        onReply={c.reply}
        isReplying={c.isReplying}
        replyError={c.replyError}
        view={c.railView}
        onViewChange={c.setRailView}
      />
    </div>
  );
}
