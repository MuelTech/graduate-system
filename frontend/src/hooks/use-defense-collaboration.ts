"use client";

/**
 * CDW-3 — the single React Query source for the collaborative manuscript.
 *
 * Both the PDF highlight overlay and the Shared Comments rail consume this one
 * query (keyed by the exact `scheduleId` + server-resolved `documentId`), so
 * there is never a second, unsynchronized copy of annotation state. Mutations
 * invalidate this exact key on success; polling only refreshes this query — the
 * PDF file itself is fetched separately by the viewer and is never re-fetched by
 * polling.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import { apiClientRequest } from "@/lib/api.client";
import type { PdfAnchor } from "@/lib/pdf-annotation/anchors";
import {
  annotationsQueryKey,
  defenseAnnotationsUrl,
} from "@/lib/pdf-annotation/collaboration-client";

export interface CreateAnnotationInput {
  thesisDocumentId: string;
  anchor: PdfAnchor;
  /** CDW-3: optional initial comment — persisted atomically with the annotation. */
  initialComment?: string;
}

export interface CreateCommentInput {
  annotationId: string;
  body: string;
  parentCommentId?: string | null;
}

export function useDefenseAnnotations(
  scheduleId: string,
  documentId: string,
  options: { enabled?: boolean; pollIntervalMs?: number | false } = {},
): UseQueryResult<unknown, Error> {
  const { enabled = true, pollIntervalMs = false } = options;
  return useQuery({
    queryKey: annotationsQueryKey(scheduleId, documentId),
    enabled: enabled && Boolean(scheduleId) && Boolean(documentId),
    queryFn: () => apiClientRequest(defenseAnnotationsUrl(scheduleId, documentId)),
    refetchInterval: pollIntervalMs,
    refetchOnWindowFocus: false,
    // Keep the previous list while refetching so the rail does not flash empty.
    placeholderData: (previous) => previous,
    retry: 1,
  });
}

function invalidate(
  queryClient: ReturnType<typeof useQueryClient>,
  scheduleId: string,
  documentId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: annotationsQueryKey(scheduleId, documentId),
  });
}

/** Create a highlight + optional initial comment (one atomic backend write). */
export function useCreateDefenseAnnotation(
  scheduleId: string,
  documentId: string,
): UseMutationResult<unknown, Error, CreateAnnotationInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnotationInput) =>
      apiClientRequest(`/thesis/defense/${encodeURIComponent(scheduleId)}/collaboration/annotations`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(queryClient, scheduleId, documentId),
  });
}

/** Reply to / comment on an existing annotation thread. */
export function useCreateDefenseComment(
  scheduleId: string,
  documentId: string,
): UseMutationResult<unknown, Error, CreateCommentInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ annotationId, body, parentCommentId }: CreateCommentInput) =>
      apiClientRequest(
        `/thesis/defense/${encodeURIComponent(scheduleId)}/collaboration/annotations/${encodeURIComponent(
          annotationId,
        )}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body, parentCommentId: parentCommentId ?? null }),
        },
      ),
    onSuccess: () => invalidate(queryClient, scheduleId, documentId),
  });
}
