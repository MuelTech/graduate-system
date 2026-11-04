export interface ExamResult {
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
export function ResultBreakdown({ result }: { result: ExamResult }) {
  const points = (earned: string | null, maximum: string | null) =>
    `${earned ?? "Not recorded"}${maximum === null ? "" : ` / ${maximum}`}`;
  return (
    <div className="space-y-3">
      {result.provenance === "LEGACY" ? (
        <p className="text-sm text-(--earist-body-text)">
          Historical result. Scoring provenance, maxima, percentage and passing
          threshold were not recorded.
        </p>
      ) : null}
      <dl className="grid gap-3 break-words text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt>Multiple Choice</dt>
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
          <dt>Essay</dt>
          <dd className="font-semibold">
            {points(result.essayScore, result.essayTotal)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt>Total</dt>
          <dd className="font-semibold">
            {points(result.totalScore, result.totalPossible)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt>Result</dt>
          <dd className="font-semibold">{result.status.toUpperCase()}</dd>
        </div>
        {result.percentage !== null ? (
          <div className="min-w-0">
            <dt>Percentage (display rounded)</dt>
            <dd>{result.percentage}%</dd>
          </div>
        ) : null}
        {result.passingThreshold !== null ? (
          <div className="min-w-0">
            <dt>Passing Threshold</dt>
            <dd>{result.passingThreshold}%</dd>
          </div>
        ) : null}
        {result.scoredAt ? (
          <div className="min-w-0">
            <dt>Result Computed</dt>
            <dd>
              {new Date(result.scoredAt).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
              })}
            </dd>
          </div>
        ) : null}
      </dl>
      {result.provenance === "B8" ? (
        <p className="text-xs text-(--earist-body-text)">
          The result uses the exact score comparison before display rounding.
        </p>
      ) : null}
    </div>
  );
}
