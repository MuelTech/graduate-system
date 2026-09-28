"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Printer } from "lucide-react";

interface StudentRapAccess {
  scheduleId: string;
  defenseType: string;
  formalOutcome: string | null;
  rapStatus: string | null;
  finalizedAt: string | null;
  officialContent: {
    selectedTitle: string | null;
    decisionsAndRecommendations: string | null;
    venue: string | null;
    reportDate: string | null;
    signatories: Array<{
      name: string | null;
      roleAtDefense: string | null;
      isSigned: boolean;
      signedAt: string | null;
    }>;
  } | null;
  message: string;
}

/**
 * Student-safe RAP status/access.
 * Never shows live Rapporteur draft notes or private evaluator score sheets.
 */
export function StudentRapPanel({ scheduleId }: { scheduleId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["studentRap", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/student/defense/${scheduleId}/rap`,
      )) as StudentRapAccess,
    enabled: Boolean(scheduleId),
  });

  if (!scheduleId || isLoading) return null;
  if (error || !data) return null;

  // Canonical RAP completion is FINALIZED only (ALL_SIGNED/DISTRIBUTED are legacy).
  const finalized = data.rapStatus === "FINALIZED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-(--earist-primary)" />
          Defense RAP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-(--earist-body-text)">{data.message}</p>
        <div className="flex flex-wrap gap-2">
          {data.formalOutcome && (
            <Badge
              className={
                data.formalOutcome === "PASSED"
                  ? "bg-emerald-100 text-emerald-800"
                  : data.formalOutcome === "FAILED"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
              }
            >
              {data.formalOutcome}
            </Badge>
          )}
          {data.rapStatus && (
            <Badge variant="outline">RAP: {data.rapStatus}</Badge>
          )}
        </div>

        {finalized && data.officialContent ? (
          <div className="space-y-3">
            {data.officialContent.selectedTitle && (
              <p>
                <span className="font-medium">Official title:</span>{" "}
                {data.officialContent.selectedTitle}
              </p>
            )}
            {data.officialContent.decisionsAndRecommendations && (
              <div className="rounded border border-(--earist-border-gray) p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-(--earist-body-text)">
                  Official RAP Content
                </p>
                <pre className="whitespace-pre-wrap text-xs">
                  {data.officialContent.decisionsAndRecommendations}
                </pre>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-(--earist-body-text)">
                Signatories
              </p>
              <ul className="space-y-1 text-xs">
                {data.officialContent.signatories.map((s, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {s.name} {s.roleAtDefense ? `(${s.roleAtDefense})` : ""}
                    </span>
                    <span>{s.isSigned ? "Signed" : "Pending"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="mr-2 h-4 w-4" />
              View / Print / Download Official RAP
            </Button>
          </div>
        ) : (
          <p className="text-xs text-(--earist-body-text)">
            Official RAP content becomes available after the RAP is finalized.
            Internal draft notes and private evaluator score sheets are not
            shared.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
