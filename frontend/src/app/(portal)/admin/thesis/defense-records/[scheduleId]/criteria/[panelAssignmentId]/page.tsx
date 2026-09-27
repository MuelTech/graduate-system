"use client";

import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface CriteriaDto {
  available: boolean;
  status: string;
  studentName: string | null;
  studentNumber: string | null;
  program: string | null;
  defenseType: string;
  defenseDate: string | null;
  evaluatorName: string | null;
  functionalRole: string | null;
  criteria: Record<string, number | null>;
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
  rating: string | null;
  recommendations: string | null;
  signatureData: string | null;
  signedAt: string | null;
  finalizedAt: string | null;
}

function CriteriaPrintView() {
  const params = useParams<{ scheduleId: string; panelAssignmentId: string }>();
  const [data, setData] = useState<CriteriaDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiClientRequest(
          `/thesis/defense/${params.scheduleId}/records/criteria/${params.panelAssignmentId}`,
        );
        if (!cancelled) setData(result as CriteriaDto);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.scheduleId, params.panelAssignmentId]);

  if (error) {
    return <p className="p-8 text-sm text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="p-8 text-sm text-(--earist-body-text)">Loading…</p>;
  }
  if (!data.available) {
    return (
      <p className="p-8 text-sm text-(--earist-body-text)">
        Official Criteria is not available — evaluation status: {data.status}.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-sm print:p-0">
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-(--earist-primary)">
            Oral Examination Criteria
          </h1>
          <p className="text-xs text-(--earist-body-text)">
            System-generated official defense record
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="space-y-1 border-b pb-4">
        <p className="text-base font-semibold">
          EARIST Graduate School — Oral Examination Criteria
        </p>
        <p className="text-xs text-(--earist-body-text)">
          System-generated official record (not an exact EARIST form facsimile)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-(--earist-body-text)">Candidate</p>
          <p>{data.studentName}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Student No.</p>
          <p>{data.studentNumber}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Program</p>
          <p>{data.program}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Defense Stage</p>
          <p>{data.defenseType}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Defense Date</p>
          <p>{data.defenseDate?.slice(0, 10) ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-(--earist-body-text)">Evaluator</p>
          <p>
            {data.evaluatorName} ({data.functionalRole})
          </p>
        </div>
      </div>

      <table className="w-full border text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-2 py-1 text-left">Criterion</th>
            <th className="border px-2 py-1 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.criteria).map(([k, v]) => (
            <tr key={k}>
              <td className="border px-2 py-1">{k}</td>
              <td className="border px-2 py-1 text-right">{v ?? "—"}</td>
            </tr>
          ))}
          <tr>
            <td className="border px-2 py-1 font-medium">Group I</td>
            <td className="border px-2 py-1 text-right">{data.groupIValue ?? "—"}</td>
          </tr>
          <tr>
            <td className="border px-2 py-1 font-medium">Group II</td>
            <td className="border px-2 py-1 text-right">{data.groupIIValue ?? "—"}</td>
          </tr>
          <tr>
            <td className="border px-2 py-1 font-medium">Overall</td>
            <td className="border px-2 py-1 text-right">{data.overallValue ?? "—"}</td>
          </tr>
          {data.rating && (
            <tr>
              <td className="border px-2 py-1 font-medium">Rating</td>
              <td className="border px-2 py-1 text-right">{data.rating}</td>
            </tr>
          )}
        </tbody>
      </table>

      {data.recommendations && (
        <div>
          <p className="text-xs font-semibold text-(--earist-body-text)">
            Recommendations
          </p>
          <p className="whitespace-pre-wrap text-sm">{data.recommendations}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 pt-8">
        <div>
          {data.signatureData && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.signatureData}
              alt="Evaluator signature"
              className="h-16 object-contain"
            />
          )}
          <div className="mt-1 border-t pt-1">
            <p className="text-xs">{data.evaluatorName}</p>
            <p className="text-xs text-(--earist-body-text)">
              Evaluator · Signed {data.signedAt?.slice(0, 10) ?? "—"}
            </p>
          </div>
        </div>
        <div className="text-xs text-(--earist-body-text)">
          Finalized: {data.finalizedAt?.slice(0, 10) ?? "—"}
        </div>
      </div>
    </div>
  );
}

export default function OfficialCriteriaPrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading…</p>}>
      <CriteriaPrintView />
    </Suspense>
  );
}
