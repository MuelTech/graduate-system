import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Mail,
  ExternalLink,
  ArrowRight,
  FileText,
  Upload,
} from "lucide-react";

export default function ApplicantResultsPage() {
  const result = {
    status: "passed" as "passed" | "failed",
    mcqScore: 38,
    mcqTotal: 50,
    essayScore: 28,
    essayTotal: 30,
    totalScore: 66,
    totalPossible: 80,
    passingScore: 48,
    examDate: "June 15, 2026",
  };

  const percentage = Math.round(
    (result.totalScore / result.totalPossible) * 100
  );

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Examination Results
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Exam taken on {result.examDate}
        </p>
      </div>

      {/* Result Header — Pass/Fail Badge */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center text-center">
            {result.status === "passed" ? (
              <>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <Badge className="mb-2 bg-green-100 px-4 py-1 text-base text-green-700">
                  PASSED
                </Badge>
                <p className="text-sm text-[var(--earist-body-text)]">
                  Congratulations! You have passed the entrance examination.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <Badge className="mb-2 bg-red-100 px-4 py-1 text-base text-red-700">
                  FAILED
                </Badge>
                <p className="text-sm text-[var(--earist-body-text)]">
                  You did not meet the passing score for this examination.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
            Score Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* MCQ Score */}
            <div className="flex items-center justify-between rounded-lg bg-[var(--earist-surface-gray)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    MCQ Score
                  </p>
                  <p className="text-xs text-[var(--earist-body-text)]">
                    Multiple Choice Questions
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold text-[var(--earist-primary)]">
                {result.mcqScore}
                <span className="text-sm font-normal text-[var(--earist-body-text)]">
                  {" "}
                  / {result.mcqTotal}
                </span>
              </p>
            </div>

            {/* Essay Score */}
            <div className="flex items-center justify-between rounded-lg bg-[var(--earist-surface-gray)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-purple-50">
                  <FileText className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    Essay Score
                  </p>
                  <p className="text-xs text-[var(--earist-body-text)]">
                    Program Chair Evaluation
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold text-[var(--earist-primary)]">
                {result.essayScore}
                <span className="text-sm font-normal text-[var(--earist-body-text)]">
                  {" "}
                  / {result.essayTotal}
                </span>
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--earist-border-gray)]" />

            {/* Total Score */}
            <div className="flex items-center justify-between rounded-lg bg-[var(--earist-surface-light-red)] p-3">
              <div>
                <p className="text-sm font-semibold text-[var(--earist-primary)]">
                  Total Score
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  Passing Score: {result.passingScore} /{" "}
                  {result.totalPossible}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--earist-primary)]">
                  {result.totalScore}
                  <span className="text-base font-normal text-[var(--earist-body-text)]">
                    {" "}
                    / {result.totalPossible}
                  </span>
                </p>
                <p className="text-xs font-medium text-[var(--earist-body-text)]">
                  {percentage}%
                </p>
              </div>
            </div>

            {/* Score Bar */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--earist-body-text)]">Your Score</span>
                <span className="font-medium text-[var(--earist-primary)]">
                  {percentage}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--earist-border-gray)]">
                <div
                  className={`h-full rounded-full ${
                    result.status === "passed"
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--earist-body-text)]">
                <span>0</span>
                <span>
                  Passing:{" "}
                  {Math.round(
                    (result.passingScore / result.totalPossible) * 100
                  )}
                  %
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pass Path — Instructions */}
      {result.status === "passed" && (
        <Card>
          <CardContent className="py-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-semibold text-amber-800">
                Congratulations! Next Steps:
              </p>
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-amber-700">
                <li>Proceed to Pinnacle to complete your enrollment.</li>
                <li>
                  Download your Certificate of Registration (COR) from
                  Pinnacle.
                </li>
                <li>
                  Upload your COR to this portal for Admin verification.
                </li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://earistweb.pinnacle.com.ph/aims/students/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  Go to Pinnacle
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Link
                  href="/applicant/cor-upload"
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--earist-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--earist-primary)]/90"
                >
                  <Upload className="mr-1 h-3 w-3" />
                  Upload COR
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fail Path — Re-application Info */}
      {result.status === "failed" && (
        <Card>
          <CardContent className="py-4">
            <div className="rounded-lg border border-[var(--earist-border-gray)] bg-[var(--earist-surface-gray)] p-4">
              <p className="mb-2 text-sm font-semibold text-[var(--earist-primary)]">
                Re-application Information
              </p>
              <p className="mb-3 text-sm text-[var(--earist-body-text)]">
                You may re-apply for the entrance examination per
                institutional policy. Please contact the Graduate School
                Office for guidance on the re-application process.
              </p>
              <Link
                href="/applicant/dashboard"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
              >
                Back to Dashboard <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Notice */}
      <div className="flex items-start gap-2 rounded-lg bg-[var(--earist-surface-gray)] p-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--earist-body-text)]" />
        <p className="text-xs text-[var(--earist-body-text)]">
          A detailed results notification has been sent to your registered
          email address.
        </p>
      </div>
    </div>
  );
}
