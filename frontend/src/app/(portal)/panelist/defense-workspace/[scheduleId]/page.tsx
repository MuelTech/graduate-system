"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DefenseWorkspaceHeader } from "@/components/defense-workspace/workspace-header";
import { DefenseRoster } from "@/components/defense-workspace/defense-roster";
import { OralEvaluationForm } from "@/components/defense-workspace/oral-evaluation-form";
import { RapporteurNotesWorkspace } from "@/components/defense-workspace/rapporteur-notes-workspace";
import { ChairmanConclusionPanel } from "@/components/defense-workspace/chairman-conclusion-panel";
import { ChairmanOralSummary } from "@/components/defense-workspace/chairman-oral-summary";
import type { DefenseWorkspace } from "@/types/defense-workspace";

/** CP7-FIX3: shared detailed Summary contract for Chairman review + conclusion gate. */
export interface OralExamSummaryDetail {
  scheduleId: string;
  defenseType: string;
  ready: boolean;
  evaluatorAssignments: number;
  finalizedEvaluations: number;
  overallAverage: number | null;
  finalRating: string | null;
  generatedAt: string | null;
  evaluators: Array<{
    evaluatorName: string;
    functionalRole: string;
    groupIValue: number | null;
    groupIIValue: number | null;
    overallValue: number | null;
    rating: string | null;
    recommendations?: string | null;
  }>;
}

export default function DefenseWorkspacePage() {
  const params = useParams<{ scheduleId: string }>();
  const scheduleId = params.scheduleId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["defenseWorkspace", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/workspace`,
      )) as DefenseWorkspace,
    refetchInterval: (q) => {
      const ws = q.state.data as DefenseWorkspace | undefined;
      const s = ws?.schedule.sessionStatus;
      return s === "SCHEDULED" || s === "IN_PROGRESS" || s === "AWAITING_CONCLUSION"
        ? 20000
        : false;
    },
  });

  const isTitle =
    data?.schedule.defenseType === "TITLE_DEFENSE";
  const isChairman = data?.myAssignment.role === "CHAIRMAN";
  const workspaceSummaryReady = data?.oralSummary?.ready === true;
  // CP7-FIX3: only Chairman + Proposal/Final + aggregate ready loads detailed rows.
  const showDetailedSummary =
    Boolean(data) &&
    isChairman &&
    !isTitle &&
    workspaceSummaryReady;

  // Parent owns the single detailed Summary fetch (Option A).
  const {
    data: detailedSummary,
    isLoading: detailedSummaryLoading,
    isFetching: detailedSummaryFetching,
    error: detailedSummaryError,
    refetch: refetchDetailedSummary,
  } = useQuery({
    queryKey: ["oralExamSummary", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/${scheduleId}/records/summary`,
      )) as OralExamSummaryDetail,
    enabled: showDetailedSummary,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--earist-primary)" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8 text-center">
        <p className="text-sm text-red-600">
          {(error as Error)?.message ||
            "You are not assigned to this defense session."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded border border-(--earist-border-gray) px-3 py-1.5 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  const canEvaluate = data.capabilities.canEvaluate && !isTitle;
  const isRapporteur = data.capabilities.canEditRapporteurNotes;
  const primaryDoc = data.documents[0];
  const progress = data.evaluationProgress;

  // CP7-FIX3: successful detailed load + ready for Proposal/Final Chairman gate.
  const detailedSummaryLoadedSuccessfully =
    !detailedSummaryLoading &&
    !detailedSummaryFetching &&
    !detailedSummaryError &&
    detailedSummary !== undefined;
  const detailedSummaryReady =
    !isTitle &&
    showDetailedSummary &&
    detailedSummaryLoadedSuccessfully &&
    detailedSummary?.ready === true;

  const oralSummaryLabel = isTitle
    ? null
    : data.oralSummary?.ready
      ? "Ready"
      : "Waiting for evaluator completion";
  const formalResultLabel = data.formalResult
    ? data.formalResult
    : data.conclusionsPresent
      ? "Recorded"
      : data.sessionStatus === "AWAITING_CONCLUSION"
        ? "Awaiting Chairman"
        : "Not yet recorded";
  const rapLabel = data.rapStatus ?? "Not yet generated";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <DefenseWorkspaceHeader workspace={data} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {!isTitle && (
            <Card>
              <CardContent className="pt-5 text-xs text-(--earist-body-text)">
                <p>
                  Evaluations finalized: {progress.finalizedEvaluations} /{" "}
                  {progress.evaluatorAssignments}
                </p>
                <p>
                  Summary:{" "}
                  {data.oralSummary?.ready
                    ? `Ready${data.oralSummary.overallAverage != null ? ` — avg ${data.oralSummary.overallAverage}` : ""}`
                    : "Not ready"}
                </p>
              </CardContent>
            </Card>
          )}

          {isTitle && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Proposed Titles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.proposedTitles.map((t, i) => (
                  <p key={t.id} className="rounded border border-(--earist-border-gray) p-2">
                    <span className="mr-2 text-xs text-(--earist-body-text)">
                      Title {i + 1}
                    </span>
                    {t.titleText}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {canEvaluate && (
            <OralEvaluationForm scheduleId={scheduleId} />
          )}

          {(isRapporteur ||
            (Boolean(data.rapporteurNotesFinalizedAt) &&
              (isChairman || isRapporteur))) && (
            <RapporteurNotesWorkspace
              scheduleId={scheduleId}
              initialNotes={data.rapporteurDraft?.notes ?? ""}
              notesFinalizedAt={data.rapporteurNotesFinalizedAt}
              canFinalize={data.capabilities.canFinalizeRapporteurNotes}
              evaluationProgress={progress}
            />
          )}

          {showDetailedSummary && (
            <ChairmanOralSummary
              data={detailedSummary ?? null}
              isLoading={detailedSummaryLoading || detailedSummaryFetching}
              error={
                detailedSummaryError
                  ? (detailedSummaryError as Error)
                  : null
              }
              onRetry={() => {
                void refetchDetailedSummary();
              }}
            />
          )}

          {isChairman && (
            <ChairmanConclusionPanel
              scheduleId={scheduleId}
              workspace={data}
              detailedSummaryReady={detailedSummaryReady}
              detailedSummaryLoading={showDetailedSummary && (detailedSummaryLoading || detailedSummaryFetching)}
              detailedSummaryError={
                showDetailedSummary ? Boolean(detailedSummaryError) : false
              }
            />
          )}

          {!canEvaluate && !isRapporteur && !isChairman && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Your session role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-(--earist-body-text)">
                <p>
                  {data.myAssignment.role === "FACILITATOR"
                    ? "No dedicated digital action is assigned to the Facilitator in the current workflow."
                    : "Read-only defense session view. Evaluation is limited to assigned evaluators."}
                </p>
                {data.sessionStatus === "AWAITING_CONCLUSION" && (
                  <p>Evaluations complete — awaiting formal conclusion.</p>
                )}
              </CardContent>
            </Card>
          )}

          <DefenseRoster roster={data.roster} />
        </div>

        <div className="lg:col-span-3">
          <Tabs defaultValue="doc" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="doc">Student Document</TabsTrigger>
              <TabsTrigger value="info">Session</TabsTrigger>
            </TabsList>
            <TabsContent value="doc" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {primaryDoc?.displayName || "Student document"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {primaryDoc ? (
                    <iframe
                      title="Student document"
                      src={`/api/documents/thesis-document/${primaryDoc.id}/file`}
                      className="h-[70vh] w-full rounded border border-(--earist-border-gray)"
                    />
                  ) : (
                    <p className="text-sm text-(--earist-body-text)">
                      No stage document is available yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="info" className="mt-3 space-y-3">
              <Card>
                <CardContent className="space-y-2 pt-5 text-sm">
                  <p>
                    <Badge variant="outline" className="mr-2">
                      {data.myAssignment.role}
                    </Badge>
                    Evaluation status:{" "}
                    <strong>
                      {data.evaluationStatus === "NONE"
                        ? "Not required"
                        : data.evaluationStatus}
                    </strong>
                  </p>
                  <p className="text-(--earist-body-text)">
                    Session: {data.schedule.sessionStatus}
                    {data.conclusionsPresent ? " · formal result recorded" : ""}
                  </p>
                  <div className="space-y-1 text-xs text-(--earist-body-text)">
                    {oralSummaryLabel !== null && (
                      <p>Oral Summary: {oralSummaryLabel}</p>
                    )}
                    <p>Formal Result: {formalResultLabel}</p>
                    <p>RAP: {rapLabel}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
