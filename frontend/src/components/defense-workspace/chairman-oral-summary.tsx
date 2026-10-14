"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SummaryEvaluatorRow {
  evaluatorName: string;
  functionalRole: string;
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
  rating: string | null;
  recommendations?: string | null;
}

export interface OralExamSummaryDetail {
  scheduleId: string;
  defenseType: string;
  ready: boolean;
  evaluatorAssignments: number;
  finalizedEvaluations: number;
  overallAverage: number | null;
  finalRating: string | null;
  generatedAt: string | null;
  evaluators: SummaryEvaluatorRow[];
}

/**
 * CP7-FIX2/FIX3: presentational Chairman Summary table.
 * Query lives in DefenseWorkspacePage so loading/error/success is shared
 * with ChairmanConclusionPanel (single authoritative fetch).
 */
export function ChairmanOralSummary({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data: OralExamSummaryDetail | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Oral Examination Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-(--earist-body-text)">
          Loading Summary…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Oral Examination Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-red-600">
            Unable to load Summary: {error.message || "Request failed."}
          </p>
          <p className="text-xs text-(--earist-body-text)">
            Formal result remains disabled until the Summary loads successfully.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ready = data?.ready === true;
  const rows = data?.evaluators ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Oral Examination Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!data || !ready ? (
          <p className="text-xs text-(--earist-body-text)">
            Not ready — waiting for all required evaluators to finalize.
          </p>
        ) : (
          <>
            <div className="rounded border border-(--earist-border-gray) p-3 text-xs text-(--earist-body-text)">
              <p>
                Overall Defense Average:{" "}
                <strong className="text-(--earist-primary)">
                  {data.overallAverage ?? "—"}
                </strong>
                {data.finalRating ? ` · Rating: ${data.finalRating}` : ""}
              </p>
              {data.generatedAt && (
                <p>Generated At: {new Date(data.generatedAt).toLocaleString()}</p>
              )}
              <p>
                Evaluators finalized: {data.finalizedEvaluations ?? 0} /{" "}
                {data.evaluatorAssignments ?? 0}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-(--earist-body-text)">
                    <th className="py-2 pr-3">Evaluator</th>
                    <th className="py-2 pr-3">Functional Role</th>
                    <th className="py-2 pr-3">Group I</th>
                    <th className="py-2 pr-3">Group II</th>
                    <th className="py-2 pr-3">Overall</th>
                    <th className="py-2">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.evaluatorName}-${i}`}
                      className="border-b border-(--earist-border-gray)"
                    >
                      <td className="py-2 pr-3">{r.evaluatorName}</td>
                      <td className="py-2 pr-3">{r.functionalRole}</td>
                      <td className="py-2 pr-3">{r.groupIValue ?? "—"}</td>
                      <td className="py-2 pr-3">{r.groupIIValue ?? "—"}</td>
                      <td className="py-2 pr-3">{r.overallValue ?? "—"}</td>
                      <td className="py-2">{r.rating ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.some((r) => r.recommendations) && (
              <details className="rounded border border-(--earist-border-gray) p-2">
                <summary className="cursor-pointer text-xs font-medium text-(--earist-body-text)">
                  Evaluator recommendations
                </summary>
                <ul className="mt-2 space-y-2 text-xs">
                  {rows
                    .filter((r) => r.recommendations)
                    .map((r, i) => (
                      <li key={i}>
                        <span className="font-medium">{r.evaluatorName}:</span>{" "}
                        <span className="whitespace-pre-wrap">
                          {r.recommendations}
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            )}

            <p className="text-[11px] text-(--earist-body-text)">
              Read-only official Summary. No PASS/FAIL is inferred from the
              average.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
