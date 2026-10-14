"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import {
  JOURNEY_COMPLETED_ROUTE,
  journeyRouteFor,
} from "@/lib/student-thesis-journey";

/**
 * /student/thesis is redirect-only (WP7).
 * Authoritative currentStep comes from GET /thesis/journey — no local pipeline model.
 */
export default function StudentThesisIndexPage() {
  const router = useRouter();
  const { data: journey, isLoading, isError, refetch } =
    useStudentThesisJourney();

  useEffect(() => {
    if (!journey) return;
    const target = journey.currentStep
      ? journeyRouteFor(journey.currentStep)
      : JOURNEY_COMPLETED_ROUTE;
    router.replace(target);
  }, [journey, router]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-(--earist-body-text)">
        Loading Thesis Journey…
      </div>
    );
  }

  if (isError || !journey) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8 text-center">
        <p className="text-sm text-red-600">
          Unable to load your Thesis Journey.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg border border-(--earist-border-gray) px-4 py-2 text-sm text-(--earist-primary)"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 text-center text-sm text-(--earist-body-text)">
      Redirecting to your current Thesis Journey step…
    </div>
  );
}
