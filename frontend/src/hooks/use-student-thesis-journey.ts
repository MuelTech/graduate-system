"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiClientRequest } from "@/lib/api.client";
import {
  shouldPollJourney,
  studentThesisJourneyQueryKey,
} from "@/lib/student-thesis-journey";
import type { StudentThesisJourney } from "@/types/student-thesis-journey";

/** Modest interval for administrative status updates (not real-time). */
const JOURNEY_POLL_MS = 30_000;

/**
 * Canonical Student Thesis Journey read model (GET /thesis/journey).
 * Do not use /student/journey for Thesis Journey progression.
 *
 * Polls only while a defense step is WAITING/active so cross-role Admin
 * actions appear without a hard browser refresh. Stops when idle/completed.
 */
export function useStudentThesisJourney() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: studentThesisJourneyQueryKey,
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/journey");
      return res as StudentThesisJourney;
    },
    refetchInterval: (q) => {
      const data = q.state.data as StudentThesisJourney | undefined;
      return shouldPollJourney(data) ? JOURNEY_POLL_MS : false;
    },
    refetchOnWindowFocus: true,
  });

  const refreshStatus = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: studentThesisJourneyQueryKey,
    });
  }, [queryClient]);

  return {
    ...query,
    refreshStatus,
    isRefreshing: query.isRefetching,
  };
}
