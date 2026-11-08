"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import { facultyKey } from "@/lib/faculty-access";
import {
  essayEndpoint,
  essayError,
  scoreInput,
  type EssayDetail,
} from "@/lib/faculty-essays";
import { useFacultyAccess } from "./faculty-access-provider";
import { FacultyEssayImage } from "./essay-image";
import { SemanticText } from "@/components/exam-content/semantic-text";
import { StructuredStimulusRenderer } from "@/components/exam-content/stimulus-renderer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

const queuePath = "/panelist/essay-evaluations";
export function FacultyEssayDetail({
  applicationId,
}: {
  applicationId: string;
}) {
  const { accountId, refresh, loading: refreshingAccess } = useFacultyAccess();
  const router = useRouter();
  const client = useQueryClient();
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [complete, setComplete] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inFlight = useRef(false);
  const detailKey = facultyKey(accountId, "essays", "detail", applicationId);
  const query = useQuery<EssayDetail>({
    queryKey: detailKey,
    enabled: !complete,
    queryFn: ({ signal }) =>
      apiClientRequest(essayEndpoint(applicationId), {
        signal,
        cache: "no-store",
      }),
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: (essayScore: number) =>
      apiClientRequest(`${essayEndpoint(applicationId)}/grade`, {
        method: "POST",
        body: JSON.stringify({ essayScore }),
      }),
    onSuccess: () => {
      setComplete(true);
      setDraft("");
      setConfirm(false);
      client.removeQueries({ queryKey: detailKey, exact: true });
      void client.invalidateQueries({
        queryKey: facultyKey(accountId, "essays", "queue"),
      });
      toast.success("Essay evaluation saved.");
      router.replace(queuePath);
    },
    onError: (error) => {
      setConfirm(false);
      if (error instanceof ApiError && error.statusCode === 403) void refresh();
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const score = query.data ? scoreInput(draft, query.data.maximumScore) : null;
  const conflict =
    mutation.error instanceof ApiError &&
    [404, 409].includes(mutation.error.statusCode ?? 0);
  const save = () => {
    if (
      score === null ||
      inFlight.current ||
      complete ||
      conflict ||
      refreshingAccess
    )
      return;
    inFlight.current = true;
    mutation.mutate(score);
  };
  const error = query.error ?? mutation.error;
  const noLongerPending =
    error instanceof ApiError && [404, 409].includes(error.statusCode ?? 0);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Breadcrumb
        items={[
          { label: "Essay Evaluations", href: queuePath },
          { label: "Review Essay" },
        ]}
      />
      <PageHeader title="Review Essay" />
      {complete ? (
        <p role="status">
          Essay evaluation saved.{" "}
          <Link href={queuePath}>Return to Essay Evaluations</Link>
        </p>
      ) : query.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : query.isError || !query.data ? (
        <Card>
          <CardContent role="alert" className="space-y-3 p-6">
            <p>{essayError(query.error)}</p>
            {!noLongerPending && (
              <Button variant="outline" onClick={() => void query.refetch()}>
                Retry
              </Button>
            )}
            <p>
              <Link
                className="font-semibold text-(--earist-primary) underline"
                href={queuePath}
              >
                Return to Essay Evaluations
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold break-words">
                  {query.data.applicant.firstName}{" "}
                  {query.data.applicant.lastName}
                </h2>
                <p className="mt-1 text-sm">
                  Applicant ID: {query.data.applicant.pinnacleApplicantId}
                </p>
              </div>
              <div className="min-w-0">
                <p className="break-words">{query.data.programName}</p>
                <p className="mt-1 text-sm text-(--earist-body-text)">
                  Submitted{" "}
                  {new Date(query.data.finalizedAt).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2}>
                    Essay Question
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 space-y-4 break-words leading-relaxed">
                  <SemanticText
                    text={query.data.question.questionText}
                    emphasis={query.data.question.questionTextEmphasis}
                  />
                  {query.data.question.stimulusType === "STRUCTURED" && (
                    <StructuredStimulusRenderer
                      stimulus={query.data.question.structuredStimulus}
                      emphasis={query.data.question.structuredStimulusEmphasis}
                    />
                  )}
                  {query.data.question.stimulusType === "IMAGE" &&
                    (query.data.question.stimulusMediaId ? (
                      <FacultyEssayImage
                        applicationId={applicationId}
                        mediaId={query.data.question.stimulusMediaId}
                      />
                    ) : (
                      <p role="alert">Essay image is unavailable.</p>
                    ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2}>
                    Applicant Response
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {query.data.responseState === "MISSING" ? (
                    <p>No response was recorded.</p>
                  ) : query.data.responseState === "BLANK" ? (
                    <p>The response was left blank.</p>
                  ) : (
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {query.data.responseText}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                  Essay Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Maximum score: <strong>{query.data.maximumScore}</strong>
                </p>
                {mutation.isError && (
                  <div role="alert" className="space-y-2 text-sm">
                    <p>{essayError(mutation.error)}</p>
                    {conflict && (
                      <Link
                        href={queuePath}
                        className="font-semibold text-(--earist-primary) underline"
                      >
                        Return to Essay Evaluations
                      </Link>
                    )}
                  </div>
                )}
                {!conflict && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="essay-score">Essay Score</Label>
                      <Input
                        id="essay-score"
                        type="number"
                        min="0"
                        max={query.data.maximumScore}
                        step="any"
                        value={draft}
                        disabled={mutation.isPending || refreshingAccess}
                        aria-invalid={invalid}
                        aria-describedby={
                          invalid ? "essay-score-error" : undefined
                        }
                        onChange={(event) => {
                          setDraft(event.target.value);
                          setInvalid(false);
                        }}
                      />
                      {invalid && (
                        <p
                          id="essay-score-error"
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          Enter a score from 0 to {query.data.maximumScore}.
                        </p>
                      )}
                    </div>
                    <Dialog
                      open={confirm}
                      onOpenChange={(open) => {
                        if (open && score === null) {
                          setInvalid(true);
                          return;
                        }
                        if (!mutation.isPending) setConfirm(open);
                      }}
                    >
                      <DialogTrigger
                        render={
                          <Button
                            className="w-full"
                            disabled={mutation.isPending || refreshingAccess}
                            onClick={(event) => {
                              if (score === null) {
                                event.preventDefault();
                                setInvalid(true);
                              }
                            }}
                          />
                        }
                      >
                        Save Evaluation
                      </DialogTrigger>
                      <DialogContent showCloseButton={!mutation.isPending}>
                        <DialogHeader>
                          <DialogTitle>Save Essay Evaluation?</DialogTitle>
                          <DialogDescription>
                            Essay Score: {score} / {query.data.maximumScore}.
                            This evaluation is final and cannot be regraded.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() => setConfirm(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            disabled={
                              mutation.isPending ||
                              score === null ||
                              refreshingAccess
                            }
                            onClick={save}
                          >
                            {mutation.isPending
                              ? "Saving…"
                              : "Confirm Evaluation"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
