"use client";

import Link from "next/link";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import {
  journeyRouteFor,
  journeyStepFor,
} from "@/lib/student-thesis-journey";
import {
  ThesisJourneyShell,
  JourneyStepStatusCard,
} from "@/components/student/thesis-journey-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Info, Clock } from "lucide-react";

/**
 * WP12 — canonical Student STRIKE / Plagiarism page.
 * Status-only from Journey + persisted backend evidence.
 * No mock results, thresholds, uploads, or Faculty API.
 */
export default function StudentStrikePage() {
  const {
    data: journey,
    isLoading,
    isError,
    refetch,
  } = useStudentThesisJourney();

  const strike = journeyStepFor(journey, "STRIKE");
  const strikeRequired = journey?.policy?.strikeRequired === true;
  const strikeCompleted = strike?.state === "COMPLETED";
  const finalStep = journeyStepFor(journey, "FINAL_DEFENSE");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          STRIKE / Plagiarism
        </h2>
        <p className="text-sm text-(--earist-body-text)">Loading status…</p>
      </div>
    );
  }

  if (isError || !journey) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          STRIKE / Plagiarism
        </h2>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-red-600">
              Unable to load STRIKE / plagiarism status.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ThesisJourneyShell
      activeStep="STRIKE"
      title="STRIKE / Plagiarism"
      description="Manuscript plagiarism review status for Final Defense."
      journey={journey}
    >
      {strike?.state === "LOCKED" && (
        <JourneyStepStatusCard
          variant="locked"
          title="STRIKE / Plagiarism is Locked"
          badgeText="Locked"
          description={strike.lockReason || "This step is currently unavailable."}
          nextStepHref="/student/thesis"
          nextStepLabel="Back to Thesis Journey"
        />
      )}

      {strike && strike.state !== "LOCKED" && !strikeRequired && (
        <Card>
          <CardHeader className="border-b border-gray-100 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <Info className="h-4 w-4 text-[#e02b20]" />
                Plagiarism Check Not Required
              </CardTitle>
              <Badge variant="outline">Not required</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-sm text-[#333333]">
            <p className="text-gray-600">
              STRIKE / plagiarism checking is not required for your current
              workflow.
            </p>
            {strike.detail && (
              <p className="text-xs text-gray-500">{strike.detail}</p>
            )}
            {(finalStep?.state === "CURRENT" ||
              finalStep?.state === "AVAILABLE" ||
              finalStep?.state === "WAITING" ||
              finalStep?.state === "COMPLETED") && (
              <div>
                <Link
                  href={journeyRouteFor("FINAL_DEFENSE")}
                  className={buttonVariants()}
                >
                  Continue to Final Defense
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {strike && strike.state !== "LOCKED" && strikeRequired && strikeCompleted && (
        <JourneyStepStatusCard
          variant="completed"
          title="Plagiarism Clearance Recorded"
          badgeText="Completed"
          description="The required plagiarism / STRIKE clearance has been recorded."
          nextStepHref={
            finalStep?.state === "CURRENT" || finalStep?.state === "AVAILABLE"
              ? journeyRouteFor("FINAL_DEFENSE")
              : undefined
          }
          nextStepLabel="Continue to Final Defense"
        >
          {strike.nextAction && (
            <p className="text-xs text-gray-500">{strike.nextAction}</p>
          )}
        </JourneyStepStatusCard>
      )}

      {strike &&
        strike.state !== "LOCKED" &&
        strikeRequired &&
        !strikeCompleted && (
          <Card>
            <CardHeader className="border-b border-gray-100 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
                  <Clock className="h-4 w-4 text-[#f9a825]" />
                  Plagiarism Check Pending
                </CardTitle>
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                  Pending
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm text-[#333333]">
              <p className="text-gray-600">
                STRIKE / plagiarism clearance is pending.
              </p>
              <p className="text-xs text-gray-500">
                No eligible STRIKE result has been recorded yet. Follow the
                instructions provided by the Graduate School or wait for the
                result to be recorded.
              </p>
              <p className="text-xs text-gray-500">
                Only records held in this system are shown here.
              </p>
            </CardContent>
          </Card>
        )}
    </ThesisJourneyShell>
  );
}
