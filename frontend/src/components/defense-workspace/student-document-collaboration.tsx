"use client";

/**
 * CDW-3 — Student Document collaboration container.
 *
 * Owns the ONE React Query source for the current attempt's exact manuscript
 * (`documentId` is the server-resolved attempt document — never a latest/current
 * fallback), the selected-annotation/focus state, the pending text-selection draft,
 * and the create/reply mutations. The PDF viewer and the Shared Comments rail are
 * rendered from this same dataset.
 *
 * Writes are gated by role (Chairman/Panelist annotate; +Rapporteur comment) and
 * by state (active, non-frozen session). The backend remains authoritative; a 409
 * state change is handled by refreshing the collaboration data.
 */

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

import type { PdfAnchor } from "@/lib/pdf-annotation/anchors";
import { parseCollaborationAnnotations } from "@/lib/pdf-annotation/annotations";
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
}: StudentDocumentCollaborationProps) {
  const active = isCollaborationActive(sessionStatus, rapStatus);
  const pollIntervalMs = collaborationPollIntervalMs(sessionStatus, rapStatus);
  const canAnnotate = active && canAnnotateRole(role);
  const canComment = active && canCommentRole(role);

  const annotationsQuery = useDefenseAnnotations(scheduleId, documentId, {
    pollIntervalMs,
  });
  const createMutation = useCreateDefenseAnnotation(scheduleId, documentId);
  const replyMutation = useCreateDefenseComment(scheduleId, documentId);

  const annotations = useMemo(() => {
    if (annotationsQuery.data === undefined) return [];
    return parseCollaborationAnnotations(annotationsQuery.data, documentId).annotations;
  }, [annotationsQuery.data, documentId]);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<PdfAnchor | null>(null);
  const [railView, setRailView] = useState<"selected" | "all">("all");

  const selectedAnnotation =
    annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;

  const handleTextSelection = useCallback(
    (anchor: PdfAnchor) => {
      if (!canAnnotate) return;
      // Selection alone is NOT publication — it only opens the draft composer.
      setSelectedAnnotationId(null);
      setPendingAnchor(anchor);
      setRailView("selected");
    },
    [canAnnotate],
  );

  const handleSelectAnnotation = useCallback((annotationId: string) => {
    setPendingAnchor(null);
    setSelectedAnnotationId(annotationId);
    setRailView("selected");
  }, []);

  const handleSubmitNewComment = useCallback(
    async (body: string) => {
      if (!pendingAnchor) return;
      try {
        const result = (await createMutation.mutateAsync({
          thesisDocumentId: documentId,
          anchor: pendingAnchor,
          initialComment: body,
        })) as { annotation?: { id?: string } } | undefined;
        setPendingAnchor(null);
        const newId = result?.annotation?.id ?? null;
        if (newId) {
          setSelectedAnnotationId(newId);
        }
        setRailView("selected");
      } catch (error) {
        // Composer stays open with the typed text preserved.
        if (isConflict(error)) void annotationsQuery.refetch();
      }
    },
    [annotationsQuery, createMutation, documentId, pendingAnchor],
  );

  const handleReply = useCallback(
    async (parentCommentId: string | null, body: string): Promise<boolean> => {
      if (!selectedAnnotation) return false;
      try {
        await replyMutation.mutateAsync({
          annotationId: selectedAnnotation.id,
          body,
          parentCommentId,
        });
        return true;
      } catch (error) {
        if (isConflict(error)) void annotationsQuery.refetch();
        return false;
      }
    },
    [annotationsQuery, replyMutation, selectedAnnotation],
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-2">
        {!active && (
          <p className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) px-3 py-1.5 text-xs text-(--earist-body-text)">
            Collaboration is read-only for this defense. Existing comments remain visible.
          </p>
        )}

        <CollaborativeManuscriptViewer
          documentId={documentId}
          documentLabel={documentLabel}
          annotations={annotations}
          onTextSelection={canAnnotate ? handleTextSelection : undefined}
          onAnnotationSelect={handleSelectAnnotation}
          focusedAnnotationId={selectedAnnotationId}
        />

        {annotationsQuery.isError && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-(--earist-border-gray) bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            <span>
              Stored annotations could not be loaded. The manuscript is still available.
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void annotationsQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0">
        <SharedCommentsRail
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={handleSelectAnnotation}
          isLoading={annotationsQuery.isLoading}
          isError={annotationsQuery.isError}
          onRetry={() => void annotationsQuery.refetch()}
          canAnnotate={canAnnotate}
          canComment={canComment}
          pendingAnchor={pendingAnchor}
          isCreating={createMutation.isPending}
          createError={createMutation.error ? collaborationErrorMessage(createMutation.error) : null}
          onSubmitNewComment={handleSubmitNewComment}
          onCancelNewComment={() => setPendingAnchor(null)}
          onReply={handleReply}
          isReplying={replyMutation.isPending}
          replyError={replyMutation.error ? collaborationErrorMessage(replyMutation.error) : null}
          view={railView}
          onViewChange={setRailView}
        />
      </div>
    </div>
  );
}
