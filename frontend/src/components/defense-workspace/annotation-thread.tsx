"use client";

/**
 * CDW-3 — the selected annotation's thread: the highlighted text/page context,
 * the annotation author, the initial comment, and one level of replies. A reply
 * composer is offered under each top-level comment when the role/state permits.
 * No edit, no delete, no reply-to-reply.
 */

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CollaborationAnnotation, CollaborationComment } from "@/lib/pdf-annotation/annotations";
import { repliesFor, topLevelComments } from "@/lib/pdf-annotation/annotations";
import { defenseRoleLabel, formatCommentTimestamp } from "@/lib/pdf-annotation/collaboration-client";

import { AnnotationCommentComposer } from "./annotation-comment-composer";

export interface AnnotationThreadProps {
  annotation: CollaborationAnnotation;
  canComment: boolean;
  /** Resolves true on success; the reply composer stays open on failure. */
  onReply: (parentCommentId: string | null, body: string) => Promise<boolean> | void;
  isReplying: boolean;
  replyError: string | null;
}

function CommentMeta({ comment }: { comment: CollaborationComment }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-(--earist-body-text)">
      <span className="font-medium text-(--earist-body)">{comment.author.name || "Unknown"}</span>
      <Badge variant="outline">{defenseRoleLabel(comment.author.role)}</Badge>
      <span>{formatCommentTimestamp(comment.createdAt)}</span>
    </div>
  );
}

export function AnnotationThread({
  annotation,
  canComment,
  onReply,
  isReplying,
  replyError,
}: AnnotationThreadProps) {
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const tops = topLevelComments(annotation);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <blockquote className="border-l-2 border-(--earist-primary) bg-(--earist-surface-gray) px-2 py-1 text-xs italic text-(--earist-body-text)">
          “{annotation.selectedText}”
        </blockquote>
        <div className="flex items-center gap-2 text-[11px] text-(--earist-body-text)">
          <Badge variant="outline">Page {annotation.pageNumber}</Badge>
          <span className="font-medium text-(--earist-body)">
            {annotation.author.name || "Unknown"}
          </span>
          <Badge variant="secondary">{defenseRoleLabel(annotation.author.role)}</Badge>
          <span>{formatCommentTimestamp(annotation.createdAt)}</span>
        </div>
      </div>

      {tops.length === 0 ? (
        <p className="text-xs text-(--earist-body-text)">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {tops.map((comment) => (
            <li key={comment.id} className="space-y-2">
              <div className="rounded border border-(--earist-border-gray) p-2">
                <CommentMeta comment={comment} />
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-(--earist-body)">
                  {comment.body}
                </p>
              </div>

              {repliesFor(annotation, comment.id).length > 0 && (
                <ul className="ml-4 space-y-2 border-l border-(--earist-border-gray) pl-3">
                  {repliesFor(annotation, comment.id).map((replyComment) => (
                    <li key={replyComment.id}>
                      <CommentMeta comment={replyComment} />
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-(--earist-body)">
                        {replyComment.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {canComment && (
                <div className="ml-4">
                  {replyTarget === comment.id ? (
                    <AnnotationCommentComposer
                      submitLabel="Reply"
                      placeholder="Write a reply…"
                      isPending={isReplying}
                      error={replyError}
                      autoFocus
                      onSubmit={(body) => {
                        void Promise.resolve(onReply(comment.id, body)).then((ok) => {
                          // Keep the composer (and typed text) on a failed reply.
                          if (ok !== false) setReplyTarget(null);
                        });
                      }}
                      onCancel={() => setReplyTarget(null)}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReplyTarget(comment.id)}
                    >
                      Reply
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canComment && tops.length === 0 && (
        <AnnotationCommentComposer
          submitLabel="Comment"
          placeholder="Write a comment…"
          isPending={isReplying}
          error={replyError}
          onSubmit={(body) => onReply(null, body)}
        />
      )}
    </div>
  );
}
