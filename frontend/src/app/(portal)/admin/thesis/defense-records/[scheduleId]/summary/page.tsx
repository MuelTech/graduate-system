"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface SummaryEvaluatorRow {
  evaluatorName: string;
  functionalRole: string;
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
  rating: string | null;
  recommendations?: string | null;
}

interface OralExamSummaryDetail {
  scheduleId: string;
  defenseType: string;
  ready: boolean;
  evaluatorAssignments: number;
  finalizedEvaluations: number;
  overallAverage: number | null;
  finalRating: string | null;
  generatedAt: string | null;
  studentName: string | null;
  studentNumber: string | null;
  program: string | null;
  defenseDate: string | null;
  evaluators: SummaryEvaluatorRow[];
  formalOutcome: string | null;
}

interface DefenseRecordMeta {
  defenseOverview: {
    defenseType: string;
    studentName: string | null;
    studentNumber: string | null;
    program: string | null;
    defenseDate: string | null;
    formalResult: string | null;
  };
}

export default function AdminOralExamSummaryPrintPage() {
  const params = useParams<{ scheduleId: string }>();
  const scheduleId = params.scheduleId;

  // Defense Record metadata first — Title must never hit the numerical Summary endpoint.
  const recordQuery = useQuery({
    queryKey: ["adminDefenseRecordMeta", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/records`,
      )) as DefenseRecordMeta,
  });

  const defenseType = recordQuery.data?.defenseOverview.defenseType ?? null;
  const isTitleDefense = defenseType === "TITLE_DEFENSE";
  const isNumericalDefense =
    defenseType === "PROPOSAL_DEFENSE" || defenseType === "FINAL_DEFENSE";

  const summaryQuery = useQuery({
    queryKey: ["oralExamSummary", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/records/summary`,
      )) as OralExamSummaryDetail,
    enabled: isNumericalDefense,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const recordError = recordQuery.error as Error | null;
  const summaryError = summaryQuery.error as Error | null;

  if (recordQuery.isLoading) {
    return (
      <p className="p-8 text-sm text-(--earist-body-text)">Loading…</p>
    );
  }

  if (recordError || !recordQuery.data) {
    return (
      <p className="p-8 text-sm text-red-600">
        {recordError?.message || "Defense record not found."}
      </p>
    );
  }

  const o = recordQuery.data.defenseOverview;

  if (isTitleDefense) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 bg-white p-8 text-sm print:p-0">
        <div className="flex items-start justify-between print:hidden">
          <div>
            <h1 className="text-lg font-semibold text-(--earist-primary)">
              Oral Examination Summary
            </h1>
            <p className="text-xs text-(--earist-body-text)">
              System-generated official defense record
            </p>
          </div>
          <Link
            href={`/admin/thesis/defense-records/${scheduleId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to Defense Record
          </Link>
        </div>
        <p className="text-sm text-(--earist-body-text)">
          Numerical Oral Examination Summary is not applicable to Title Defense.
        </p>
      </div>
    );
  }

  if (summaryQuery.isLoading) {
    return (
      <p className="p-8 text-sm text-(--earist-body-text)">Loading…</p>
    );
  }

  if (summaryError) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 bg-white p-8 text-sm print:p-0">
        <div className="flex items-start justify-between print:hidden">
          <h1 className="text-lg font-semibold text-(--earist-primary)">
            Oral Examination Summary
          </h1>
          <Link
            href={`/admin/thesis/defense-records/${scheduleId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to Defense Record
          </Link>
        </div>
        <p className="text-red-600">
          {summaryError.message || "Unable to load Oral Examination Summary."}
        </p>
      </div>
    );
  }

  const summary = summaryQuery.data;

  if (!summary || !summary.ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 bg-white p-8 text-sm print:p-0">
        <div className="flex items-start justify-between print:hidden">
          <div>
            <h1 className="text-lg font-semibold text-(--earist-primary)">
              Oral Examination Summary
            </h1>
          </div>
          <Link
            href={`/admin/thesis/defense-records/${scheduleId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to Defense Record
          </Link>
        </div>
        <p className="text-(--earist-body-text)">
          Oral Examination Summary is not ready.
        </p>
        <p className="text-(--earist-body-text)">
          Waiting for all required evaluator finalizations.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-sm print:p-0">
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-(--earist-primary)">
            Oral Examination Summary
          </h1>
          <p className="text-xs text-(--earist-body-text)">
            System-generated official defense record
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/thesis/defense-records/${scheduleId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to Defense Record
          </Link>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="space-y-1 border-b pb-4">
        <p className="text-base font-semibold">
          EARIST Graduate School — Oral Examination Summary
        </p>
        <p className="text-xs text-(--earist-body-text)">
          System-generated official record (not an exact EARIST form facsimile)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-(--earist-body-text)">Candidate</p>
          <p>{summary.studentName ?? o.studentName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Student Number</p>
          <p>{summary.studentNumber ?? o.studentNumber ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Program</p>
          <p>{summary.program ?? o.program ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Defense Stage</p>
          <p>{summary.defenseType}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Defense Date</p>
          <p>{summary.defenseDate?.slice(0, 10) ?? "—"}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Evaluator Summary</p>
        <div className="overflow-x-auto">
          <table className="w-full border text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-2 py-1 text-left">Evaluator</th>
                <th className="border px-2 py-1 text-left">Role</th>
                <th className="border px-2 py-1 text-right">Group I</th>
                <th className="border px-2 py-1 text-right">Group II</th>
                <th className="border px-2 py-1 text-right">Overall</th>
                <th className="border px-2 py-1 text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {summary.evaluators.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border px-2 py-2 text-(--earist-body-text)">
                    No evaluator snapshot rows.
                  </td>
                </tr>
              ) : (
                summary.evaluators.map((row, i) => (
                  <tr key={`${row.evaluatorName}-${i}`}>
                    <td className="border px-2 py-1">{row.evaluatorName}</td>
                    <td className="border px-2 py-1">{row.functionalRole}</td>
                    <td className="border px-2 py-1 text-right">
                      {row.groupIValue ?? "—"}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {row.groupIIValue ?? "—"}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {row.overallValue ?? "—"}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {row.rating ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1 border-t pt-4">
        <p>
          <span className="text-(--earist-body-text)">
            Overall Defense Average:
          </span>{" "}
          <strong>{summary.overallAverage ?? "—"}</strong>
        </p>
        {summary.finalRating != null && summary.finalRating !== "" && (
          <p>
            <span className="text-(--earist-body-text)">Final Rating:</span>{" "}
            <strong>{summary.finalRating}</strong>
          </p>
        )}
      </div>

      <div className="border-t pt-4">
        <p className="text-xs text-(--earist-body-text)">
          Formal Result (Chairman-recorded academic conclusion)
        </p>
        <p className="font-semibold">
          {summary.formalOutcome ?? o.formalResult ?? "—"}
        </p>
      </div>

      <div className="border-t pt-4 text-xs text-(--earist-body-text)">
        Generated At: {summary.generatedAt?.slice(0, 19).replace("T", " ") ?? "—"}
      </div>
    </div>
  );
}
