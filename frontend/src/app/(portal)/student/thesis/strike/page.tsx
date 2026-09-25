"use client";

import Link from "next/link";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import {
  journeyRouteFor,
  journeyStepFor,
} from "@/lib/student-thesis-journey";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Info, Lock, Clock, CheckCircle2 } from "lucide-react";

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
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          STRIKE / Plagiarism
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Manuscript plagiarism review status for Final Defense.
        </p>
      </div>

      {strike?.state === "LOCKED" && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-(--earist-secondary)" />
              <p className="font-semibold">This step is not available yet</p>
            </div>
            <p className="text-sm text-(--earist-body-text)">
              {strike.lockReason || "This step is currently unavailable."}
            </p>
            <Link href="/student/thesis" className={buttonVariants({ variant: "outline" })}>
              Continue in Thesis Journey
            </Link>
          </CardContent>
        </Card>
      )}

      {strike && strike.state !== "LOCKED" && !strikeRequired && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4" />
              Not required
              <Badge variant="outline">Not required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-(--earist-body-text)">
              STRIKE / plagiarism checking is not required for your current
              workflow.
            </p>
            {strike.detail && (
              <p className="text-xs text-(--earist-body-text)">{strike.detail}</p>
            )}
            {(finalStep?.state === "CURRENT" ||
              finalStep?.state === "AVAILABLE" ||
              finalStep?.state === "WAITING" ||
              finalStep?.state === "COMPLETED") && (
              <Link
                href={journeyRouteFor("FINAL_DEFENSE")}
                className={buttonVariants()}
              >
                Continue to Final Defense
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {strike && strike.state !== "LOCKED" && strikeRequired && strikeCompleted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Plagiarism check
              <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-(--earist-body-text)">
              The required plagiarism / STRIKE clearance has been recorded.
            </p>
            {strike.nextAction && (
              <p className="text-xs text-(--earist-body-text)">
                {strike.nextAction}
              </p>
            )}
            {(finalStep?.state === "CURRENT" ||
              finalStep?.state === "AVAILABLE") && (
              <Link
                href={journeyRouteFor("FINAL_DEFENSE")}
                className={buttonVariants()}
              >
                Continue to Final Defense
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {strike &&
        strike.state !== "LOCKED" &&
        strikeRequired &&
        !strikeCompleted && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-5 w-5 text-amber-600" />
                Plagiarism check
                <Badge className="bg-amber-100 text-amber-800">Pending</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-(--earist-body-text)">
                STRIKE / plagiarism clearance is pending.
              </p>
              <p className="text-xs text-(--earist-body-text)">
                No eligible STRIKE result has been recorded yet. Follow the
                instructions provided by the Graduate School or wait for the
                result to be recorded.
              </p>
              <p className="text-xs text-(--earist-body-text)">
                Only records held in this system are shown here.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
