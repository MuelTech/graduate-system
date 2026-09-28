"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer } from "lucide-react";

interface EvaluationRow {
  panelAssignmentId: string;
  evaluatorName: string;
  role: string;
  status: string;
  overallValue: number | null;
  hasOfficialCriteria: boolean;
  signedAt: string | null;
  finalizedAt: string | null;
}

interface RecordDetail {
  scheduleId: string;
  defenseOverview: {
    studentName: string | null;
    studentNumber: string | null;
    program: string | null;
    defenseType: string;
    defenseDate: string | null;
    defenseTime: string | null;
    venueOrLink: string | null;
    sessionStatus: string;
    formalResult: string | null;
    concludedAt: string | null;
    committee: Array<{ userId: string; name: string; role: string }>;
    proposedTitles: Array<{ id: string; titleText: string; isSelected: boolean }>;
  };
  individualEvaluations: EvaluationRow[];
  oralExamSummary: {
    ready: boolean;
    overallAverage: number | null;
    finalRating: string | null;
    evaluatorCount?: number;
    rows: Array<{
      evaluatorName: string;
      functionalRole: string;
      groupIValue: number | null;
      groupIIValue: number | null;
      overallValue: number | null;
      rating: string | null;
    }>;
    generatedAt: string | null;
  };
  rapReport: {
    id: string;
    status: string;
    generatedAt: string | null;
    finalizedAt: string | null;
    selectedTitle: string | null;
    requiredSignatures: number;
    signedSignatures: number;
    signatories: Array<{
      name: string | null;
      roleAtDefense: string | null;
      required: boolean;
      isSigned: boolean;
      signedAt: string | null;
    }>;
  } | null;
}

export default function AdminDefenseRecordDetailPage() {
  const params = useParams<{ scheduleId: string }>();
  const scheduleId = params.scheduleId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["adminDefenseRecord", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/records`,
      )) as RecordDetail,
  });

  if (isLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--earist-primary)" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="text-sm text-red-600">
        {(error as Error)?.message || "Defense record not found."}
      </p>
    );
  }

  const o = data.defenseOverview;
  const isTitleDefense = o.defenseType === "TITLE_DEFENSE";
  const selectedTitle =
    data.rapReport?.selectedTitle ??
    o.proposedTitles.find((t) => t.isSelected)?.titleText ??
    null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-(--earist-primary)">
            Defense Record
          </h1>
          <p className="text-sm text-(--earist-body-text)">
            Read-only official record. Scores and formal results cannot be
            modified here.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Defense Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs text-(--earist-body-text)">Student</span>
            <p>
              {o.studentName} ({o.studentNumber})
            </p>
          </div>
          <div>
            <span className="text-xs text-(--earist-body-text)">Program</span>
            <p>{o.program}</p>
          </div>
          <div>
            <span className="text-xs text-(--earist-body-text)">Defense</span>
            <p>{o.defenseType}</p>
          </div>
          <div>
            <span className="text-xs text-(--earist-body-text)">Date</span>
            <p>
              {o.defenseDate?.slice(0, 10) ?? "—"} {o.defenseTime ?? ""}
            </p>
          </div>
          <div>
            <span className="text-xs text-(--earist-body-text)">Venue</span>
            <p>{o.venueOrLink ?? "—"}</p>
          </div>
          <div>
            <span className="text-xs text-(--earist-body-text)">Session</span>
            <p>{o.sessionStatus}</p>
          </div>
          <div>
            <span className="text-xs text-(--earist-body-text)">Formal result</span>
            <p>
              {o.formalResult ? (
                <Badge
                  className={
                    o.formalResult === "PASSED"
                      ? "bg-emerald-100 text-emerald-800"
                      : o.formalResult === "FAILED"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                  }
                >
                  {o.formalResult}
                </Badge>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <span className="text-xs text-(--earist-body-text)">Committee</span>
            <ul className="text-xs">
              {o.committee.map((c) => (
                <li key={c.userId}>
                  {c.name} — {c.role}
                </li>
              ))}
            </ul>
          </div>
          {isTitleDefense && selectedTitle && (
            <div>
              <span className="text-xs text-(--earist-body-text)">
                Official title
              </span>
              <p>{selectedTitle}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isTitleDefense ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Oral Examination Criteria &amp; Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-(--earist-body-text)">
            <p>
              Not applicable to Title Defense. Title Defense does not use Group
              I / Group II numerical Oral Examination Criteria or a numerical
              Oral Examination Summary.
            </p>
            <p className="mt-2">
              The formal Chairman-recorded result and RAP record remain the
              official academic outputs for this session.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Individual Evaluations</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-(--earist-body-text)">
                    <th className="py-2 pr-3">Evaluator</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Overall</th>
                    <th className="py-2 pr-3">Official Criteria</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.individualEvaluations.map((e) => (
                    <tr
                      key={e.panelAssignmentId}
                      className="border-b border-(--earist-border-gray)"
                    >
                      <td className="py-2 pr-3">{e.evaluatorName}</td>
                      <td className="py-2 pr-3">{e.role}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className={
                            e.status === "FINALIZED"
                              ? "border-emerald-500 text-emerald-700"
                              : e.status === "DRAFT"
                                ? "border-amber-500 text-amber-700"
                                : ""
                          }
                        >
                          {e.status === "NOT_STARTED"
                            ? "Draft / Not finalized"
                            : e.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">{e.overallValue ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {e.hasOfficialCriteria ? "Available" : "Not available"}
                      </td>
                      <td className="py-2">
                        {e.hasOfficialCriteria && (
                          <Link
                            href={`/admin/thesis/defense-records/${scheduleId}/criteria/${e.panelAssignmentId}`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            View / Print
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Oral Examination Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!data.oralExamSummary.ready ? (
                <p className="text-(--earist-body-text)">
                  Summary not ready — waiting for all required evaluator
                  finalizations.
                </p>
              ) : (
                <>
                  <p>
                    Overall average:{" "}
                    <strong>
                      {data.oralExamSummary.overallAverage ?? "—"}
                    </strong>
                    {data.oralExamSummary.finalRating
                      ? ` · Rating: ${data.oralExamSummary.finalRating}`
                      : " · Rating: not assigned"}
                  </p>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-(--earist-body-text)">
                        <th className="py-1 pr-2">Examiner</th>
                        <th className="py-1 pr-2">Role</th>
                        <th className="py-1 pr-2">Group I</th>
                        <th className="py-1 pr-2">Group II</th>
                        <th className="py-1 pr-2">Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.oralExamSummary.rows.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-(--earist-border-gray)"
                        >
                          <td className="py-1 pr-2">{r.evaluatorName}</td>
                          <td className="py-1 pr-2">{r.functionalRole}</td>
                          <td className="py-1 pr-2">{r.groupIValue ?? "—"}</td>
                          <td className="py-1 pr-2">{r.groupIIValue ?? "—"}</td>
                          <td className="py-1 pr-2">{r.overallValue ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Link
                    href={`/admin/thesis/defense-records/${scheduleId}/summary`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    View / Print Summary
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">RAP Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!data.rapReport ? (
            <p className="text-(--earist-body-text)">
              RAP not generated — awaiting formal conclusion.
            </p>
          ) : (
            <>
              <p>
                Status: <strong>{data.rapReport.status}</strong>
                {" · "}
                Signatures: {data.rapReport.signedSignatures}/
                {data.rapReport.requiredSignatures}
              </p>
              {data.rapReport.selectedTitle && (
                <p>Official title: {data.rapReport.selectedTitle}</p>
              )}
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-(--earist-body-text)">
                    <th className="py-1 pr-2">Signer</th>
                    <th className="py-1 pr-2">Role</th>
                    <th className="py-1 pr-2">Required</th>
                    <th className="py-1 pr-2">Signed</th>
                    <th className="py-1 pr-2">Signed at</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rapReport.signatories.map((s, i) => (
                    <tr key={i} className="border-b border-(--earist-border-gray)">
                      <td className="py-1 pr-2">{s.name}</td>
                      <td className="py-1 pr-2">{s.roleAtDefense}</td>
                      <td className="py-1 pr-2">{s.required ? "Yes" : "No"}</td>
                      <td className="py-1 pr-2">{s.isSigned ? "Yes" : "No"}</td>
                      <td className="py-1 pr-2">
                        {s.signedAt?.slice(0, 10) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.rapReport.status === "FINALIZED" && (
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Download RAP
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
