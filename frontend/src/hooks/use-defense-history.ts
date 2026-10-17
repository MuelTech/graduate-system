"use client";

/**
 * CDW-6 — React Query sources for the Defense History read model.
 *
 * Every key includes BOTH the CURRENT schedule (which grants historical-review
 * authority) and the historical schedule, so historical data can never be
 * written into the current-attempt collaboration cache (or vice versa). History
 * is read-only: there are no history mutations.
 */

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { apiClientRequest } from "@/lib/api.client";
import type {
  DefenseHistory,
  DefenseHistoryAttemptDetail,
} from "@/types/defense-history";

export const DEFENSE_HISTORY_QUERY_KEY = "defenseHistory" as const;

export function defenseHistoryQueryKey(scheduleId: string) {
  return [DEFENSE_HISTORY_QUERY_KEY, scheduleId] as const;
}

export function defenseHistoryAttemptQueryKey(
  scheduleId: string,
  historicalScheduleId: string,
) {
  return [DEFENSE_HISTORY_QUERY_KEY, scheduleId, "attempt", historicalScheduleId] as const;
}

export function defenseHistoryUrl(scheduleId: string): string {
  return `/thesis/defense/${encodeURIComponent(scheduleId)}/history`;
}

export function defenseHistoryAttemptUrl(
  scheduleId: string,
  historicalScheduleId: string,
): string {
  return `/thesis/defense/${encodeURIComponent(scheduleId)}/history/${encodeURIComponent(
    historicalScheduleId,
  )}`;
}

/** Relevant prior attempts for the CURRENT schedule. */
export function useDefenseHistory(
  scheduleId: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<DefenseHistory, Error> {
  const { enabled = true } = options;
  return useQuery({
    queryKey: defenseHistoryQueryKey(scheduleId),
    enabled: enabled && Boolean(scheduleId),
    queryFn: () =>
      apiClientRequest(defenseHistoryUrl(scheduleId)) as Promise<DefenseHistory>,
    // History is immutable once concluded; no polling.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Read-only detail for ONE historical attempt (manuscript/RAP/annotations). */
export function useDefenseHistoryAttempt(
  scheduleId: string,
  historicalScheduleId: string | null,
  options: { enabled?: boolean } = {},
): UseQueryResult<DefenseHistoryAttemptDetail, Error> {
  const { enabled = true } = options;
  return useQuery({
    queryKey: defenseHistoryAttemptQueryKey(scheduleId, historicalScheduleId ?? ""),
    enabled: enabled && Boolean(scheduleId) && Boolean(historicalScheduleId),
    queryFn: () =>
      apiClientRequest(
        defenseHistoryAttemptUrl(scheduleId, historicalScheduleId as string),
      ) as Promise<DefenseHistoryAttemptDetail>,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
