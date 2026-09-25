"use client";

import Link from "next/link";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import { journeyRouteFor } from "@/lib/student-thesis-journey";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FileSearch, Info, Lock } from "lucide-react";

/**
 * WP7 minimal STRIKE route shell (navigation continuity only).
 * Full STRIKE UI integration is WP12 — no mock results or Faculty API here.
 */
export default function StudentStrikeShellPage() {
  const { data: journey, isLoading, isError } = useStudentThesisJourney();
  const strike = journey?.steps.find((s) => s.key === "STRIKE");
  const strikeRequired = journey?.policy?.strikeRequired === true;
  const strikeCompleted = strike?.state === "COMPLETED";

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

      {isLoading && (
        <p className="text-sm text-(--earist-body-text)">Loading status…</p>
      )}
      {isError && (
        <p className="text-sm text-red-600">Unable to load journey status.</p>
      )}

      {strike?.state === "LOCKED" && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-(--earist-secondary)" />
              <p className="font-semibold">This step is not available yet</p>
            </div>
            <p className="text-sm text-(--earist-body-text)">
              {strike.lockReason}
            </p>
            <Link
              href={journeyRouteFor("PROPOSAL_DEFENSE")}
              className={buttonVariants({ variant: "outline" })}
            >
              Go to Proposal Defense
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
            {strike.nextAction && (
              <p className="text-xs text-(--earist-body-text)">
                {strike.nextAction}
              </p>
            )}
            <Link
              href={journeyRouteFor("FINAL_DEFENSE")}
              className={buttonVariants()}
            >
              Continue to Final Defense
            </Link>
          </CardContent>
        </Card>
      )}

      {strike && strike.state !== "LOCKED" && strikeRequired && strikeCompleted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileSearch className="h-4 w-4" />
              Plagiarism check
              <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-(--earist-body-text)">
              {strike.nextAction ||
                "Your required plagiarism check is complete."}
            </p>
            <p className="text-xs text-(--earist-body-text)">
              Only reports recorded in this system are shown here.
            </p>
            <Link
              href={journeyRouteFor("FINAL_DEFENSE")}
              className={buttonVariants()}
            >
              Continue to Final Defense
            </Link>
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
                <FileSearch className="h-4 w-4" />
                Plagiarism check
                <Badge>
                  {strike.state === "CURRENT" ? "Action needed" : "Pending"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-(--earist-body-text)">
                {strike.nextAction ||
                  "Complete the required plagiarism review before Final Defense."}
              </p>
              <p className="text-xs text-(--earist-body-text)">
                Only reports recorded in this system are shown here.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
