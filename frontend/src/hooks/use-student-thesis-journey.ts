"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { studentThesisJourneyQueryKey } from "@/lib/student-thesis-journey";
import type { StudentThesisJourney } from "@/types/student-thesis-journey";

/**
 * Canonical Student Thesis Journey read model (GET /thesis/journey).
 * Do not use /student/journey for Thesis Journey progression.
 */
export function useStudentThesisJourney() {
  return useQuery({
    queryKey: studentThesisJourneyQueryKey,
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/journey");
      return res as StudentThesisJourney;
    },
  });
}
