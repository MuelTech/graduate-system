export interface ExamResult {
  computedStatus?: string;
  effectiveStatus?: string;
  institutionalDecision?: { decision: "PASSED_RECONSIDERED"; decidedAt: string } | null;
  provenance: "B8" | "LEGACY";
  status: string;
  mcqScore: string | null;
  mcqTotal: string | null;
  mcqCorrectCount: number | null;
  mcqQuestionCount: number | null;
  essayScore: string | null;
  essayTotal: string | null;
  totalScore: string | null;
  totalPossible: string | null;
  percentage: string | null;
  passingThreshold: string | null;
  scoredAt: string | null;
}

/** Both roles display the same server-persisted numbers. No client classification. */
export function ResultBreakdown({
  result,
  showComputedResult = true,
}: {
  result: ExamResult;
  showComputedResult?: boolean;
}) {
  const points = (earned: string | null, maximum: string | null) =>
    `${earned ?? "Not recorded"}${maximum === null ? "" : ` / ${maximum}`}`;
  return (
    <div className="space-y-3">
      {result.provenance === "LEGACY" ? (
        <p className="text-sm text-(--earist-body-text)">
          Historical result. Score limits, percentage and Passing Threshold
          were not recorded.
        </p>
      ) : null}
      <dl className="grid gap-4 break-words text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-muted-foreground">MCQ</dt>
          <dd className="font-semibold">
            {points(result.mcqScore, result.mcqTotal)}
          </dd>
          {result.mcqCorrectCount !== null ? (
            <dd>
              {result.mcqCorrectCount} correct of {result.mcqQuestionCount}{" "}
              questions
            </dd>
          ) : null}
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Essay</dt>
          <dd className="font-semibold">
            {points(result.essayScore, result.essayTotal)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-semibold">
            {points(result.totalScore, result.totalPossible)}
          </dd>
        </div>
        {showComputedResult && <div className="min-w-0">
          <dt className="text-muted-foreground">Computed Result</dt>
          <dd className="font-semibold">{result.status.toUpperCase()}</dd>
        </div>}
        {result.percentage !== null ? (
          <div className="min-w-0">
            <dt className="text-muted-foreground">Score percentage</dt>
            <dd>{result.percentage}%</dd>
          </div>
        ) : null}
        {result.passingThreshold !== null ? (
          <div className="min-w-0">
            <dt className="text-muted-foreground">Passing Threshold</dt>
            <dd>{result.passingThreshold}%</dd>
          </div>
        ) : null}
      </dl>
      {result.scoredAt ? (
        <p className="text-xs text-muted-foreground">
          Result Computed: {new Date(result.scoredAt).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
          })}
        </p>
      ) : null}
    </div>
  );
}
