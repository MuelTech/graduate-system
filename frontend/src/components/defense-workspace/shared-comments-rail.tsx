"use client";

/**
 * CDW-3 — Shared Comments rail for the current attempt's exact manuscript.
 *
 * Two views:
 *   - Selected: the pending "Add Comment" draft or the selected annotation's
 *     thread (context, author, role, timestamp, initial comment, replies).
 *   - All Comments: every annotation thread for the exact document; clicking an
 *     item selects it, switches to Selected, and focuses the PDF anchor.
 *
 * Bounded to the current Student Document experience — this is not the CDW-4
 * immersive workspace.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconTooltipButton } from "@/components/ui/tooltip";
import { PanelRightClose } from "lucide-react";
import type { PdfAnchor } from "@/lib/pdf-annotation/anchors";
import type { CollaborationAnnotation } from "@/lib/pdf-annotation/annotations";
import { defenseRoleLabel, formatCommentTimestamp } from "@/lib/pdf-annotation/collaboration-client";

import { AnnotationCommentComposer } from "./annotation-comment-composer";
import { AnnotationThread } from "./annotation-thread";

export interface SharedCommentsRailProps {
  annotations: CollaborationAnnotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (annotationId: string) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  canAnnotate: boolean;
  canComment: boolean;
  /** A non-published text selection awaiting the Add Comment confirmation. */
  pendingAnchor: PdfAnchor | null;
  isCreating: boolean;
  createError: string | null;
  onSubmitNewComment: (body: string) => void;
  onCancelNewComment: () => void;
  onReply: (parentCommentId: string | null, body: string) => Promise<boolean> | void;
  isReplying: boolean;
  replyError: string | null;
  /** Controlled view (owned by the container so create/select can focus Selected). */
  view: "selected" | "all";
  onViewChange: (view: "selected" | "all") => void;
  /** CDW-4 FIX: rail-local icon collapse control (presentation only). */
  onCollapse?: () => void;
}

function preview(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export function SharedCommentsRail({
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  isLoading,
  isError,
  onRetry,
  canAnnotate,
  canComment,
  pendingAnchor,
  isCreating,
  createError,
  onSubmitNewComment,
  onCancelNewComment,
  onReply,
  isReplying,
  replyError,
  view,
  onViewChange,
  onCollapse,
}: SharedCommentsRailProps) {
  const selected =
    annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;

  const handlePick = (annotationId: string) => {
    onSelectAnnotation(annotationId);
    onViewChange("selected");
  };

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Shared Comments</CardTitle>
          {onCollapse && (
            <IconTooltipButton label="Collapse comments panel" onClick={onCollapse}>
              <PanelRightClose className="h-5 w-5" />
            </IconTooltipButton>
          )}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <Tabs
          value={view}
          onValueChange={(value) => onViewChange(value as "selected" | "all")}
          className="h-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="selected">Selected</TabsTrigger>
            <TabsTrigger value="all">
              All Comments{annotations.length > 0 ? ` (${annotations.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="selected" className="mt-3">
            <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
              {pendingAnchor ? (
                <AnnotationCommentComposer
                  submitLabel="Add Comment"
                  placeholder="Add a comment on the selected text…"
                  isPending={isCreating}
                  error={createError}
                  autoFocus
                  header={
                    <div className="space-y-1">
                      <blockquote className="border-l-2 border-(--earist-primary) bg-(--earist-surface-gray) px-2 py-1 text-[14px] italic text-(--earist-body-text)">
                        “{preview(pendingAnchor.selectedText, 200)}”
                      </blockquote>
                      <Badge variant="outline">Page {pendingAnchor.pageNumber}</Badge>
                    </div>
                  }
                  onSubmit={onSubmitNewComment}
                  onCancel={onCancelNewComment}
                />
              ) : selected ? (
                <AnnotationThread
                  annotation={selected}
                  canComment={canComment}
                  onReply={onReply}
                  isReplying={isReplying}
                  replyError={replyError}
                />
              ) : (
                <p className="text-[14px] text-(--earist-body-text)">
                  {canAnnotate
                    ? "Select text in the manuscript to add a comment, or choose a comment from All Comments."
                    : "Choose a comment from All Comments to read the thread."}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-3">
            <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
              {isLoading && (
                <p className="text-[14px] text-(--earist-body-text)">Loading comments…</p>
              )}
              {isError && (
                <div className="space-y-2">
                  <p className="text-[14px] text-amber-700">
                    Comments could not be loaded.
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                    Retry
                  </Button>
                </div>
              )}
              {!isLoading && !isError && annotations.length === 0 && (
                <p className="text-[14px] text-(--earist-body-text)">No comments yet.</p>
              )}
              {annotations.map((annotation) => {
                const isActive = annotation.id === selectedAnnotationId;
                return (
                  <button
                    key={annotation.id}
                    type="button"
                    onClick={() => handlePick(annotation.id)}
                    aria-pressed={isActive}
                    className={
                      "w-full rounded border p-2 text-left transition-colors " +
                      (isActive
                        ? "border-(--earist-primary) bg-(--earist-surface-gray)"
                        : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)")
                    }
                  >
                    <p className="line-clamp-2 text-[14px] italic text-(--earist-body-text)">
                      “{preview(annotation.selectedText)}”
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-(--earist-body-text)">
                      <Badge variant="outline">Page {annotation.pageNumber}</Badge>
                      <span className="font-medium text-(--earist-body)">
                        {annotation.author.name || "Unknown"}
                      </span>
                      <span>{defenseRoleLabel(annotation.author.role)}</span>
                      <span>{formatCommentTimestamp(annotation.createdAt)}</span>
                      {annotation.comments.length > 0 && (
                        <span>
                          · {annotation.comments.length} comment
                          {annotation.comments.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
