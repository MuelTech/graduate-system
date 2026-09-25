"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import { studentThesisJourneyQueryKey } from "@/lib/student-thesis-journey";
import {
  resolveAdviserRequestUiState,
  roleLabel,
} from "@/lib/adviser-request-ui-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  Clock,
  Lock,
  Send,
  UserCheck,
  XCircle,
} from "lucide-react";

export const studentAdviserCandidatesQueryKey = [
  "student",
  "adviser",
  "candidates",
] as const;

type OdpCandidate = {
  userId: string;
  name: string;
  defenseRole: string;
  specialization: string | null;
  officeAffiliation: string | null;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
};

type CandidatesResponse = {
  sourceDefenseScheduleId: string;
  selectedTitle: { id: string; titleText: string };
  candidates: OdpCandidate[];
};

export default function AdviserRequestPage() {
  const queryClient = useQueryClient();
  const {
    data: journey,
    isLoading: journeyLoading,
    isError: journeyError,
  } = useStudentThesisJourney();

  const uiState = resolveAdviserRequestUiState({
    isLoading: journeyLoading,
    isError: journeyError,
    journey,
  });

  const [selectedUserId, setSelectedUserId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const needCandidates =
    uiState === "READY" ||
    uiState === "DECLINED_RETRY" ||
    uiState === "DEAN_REJECTED_RETRY";

  const {
    data: candidatesData,
    isLoading: candidatesLoading,
    isError: candidatesError,
    refetch: refetchCandidates,
  } = useQuery({
    queryKey: studentAdviserCandidatesQueryKey,
    enabled: needCandidates,
    queryFn: async () =>
      (await apiClientRequest("/thesis/adviser/candidates")) as CandidatesResponse,
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      return apiClientRequest("/thesis/adviser/request", {
        method: "POST",
        body: JSON.stringify({
          requestedAdviserId: selectedUserId,
          reason: remarks.trim() ? remarks.trim() : undefined,
        }),
      });
    },
    onSuccess: async () => {
      setSubmitError(null);
      setConfirmOpen(false);
      setSelectedUserId("");
      setRemarks("");
      await queryClient.invalidateQueries({
        queryKey: studentThesisJourneyQueryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: studentAdviserCandidatesQueryKey,
      });
    },
    onError: (error: Error) => {
      setSubmitError(error.message || "Unable to send adviser request.");
      setConfirmOpen(false);
      void queryClient.invalidateQueries({
        queryKey: studentThesisJourneyQueryKey,
      });
      void refetchCandidates();
    },
  });

  const officialTitle =
    candidatesData?.selectedTitle?.titleText ||
    journey?.selectedTitle?.titleText ||
    null;

  const selectedCandidate = useMemo(
    () =>
      candidatesData?.candidates.find((c) => c.userId === selectedUserId) ??
      null,
    [candidatesData, selectedUserId],
  );

  const adviserStep = journey?.steps.find((s) => s.key === "ADVISER_REQUEST");
  const req = journey?.adviserRequest;
  const activeAdviser = journey?.activeAdviser;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          Adviser Request
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Select an eligible member of your Title Defense panel (GS-020). Flow:
          Request → Adviser CONFORME → Dean approval → active adviser.
        </p>
      </div>

      {officialTitle && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-(--earist-body-text)">
              Official Title
            </p>
            <p className="mt-1 text-sm font-semibold text-(--earist-primary)">
              {officialTitle}
            </p>
          </CardContent>
        </Card>
      )}

      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {uiState === "LOADING" && (
        <Card>
          <CardContent className="pt-6 text-sm text-(--earist-body-text)">
            Loading Adviser Request status…
          </CardContent>
        </Card>
      )}

      {uiState === "ERROR" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-red-600">
              Unable to load Adviser Request status.
            </p>
            <Link
              href="/student/thesis"
              className={buttonVariants({ variant: "outline" })}
            >
              Retry from Thesis Journey
            </Link>
          </CardContent>
        </Card>
      )}

      {uiState === "LOCKED" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-(--earist-secondary)" />
              <p className="font-semibold">Adviser Request is locked</p>
            </div>
            <p className="text-sm text-(--earist-body-text)">
              {adviserStep?.lockReason ||
                "Complete and pass Title Defense with an official selected title first."}
            </p>
            <Link
              href="/student/thesis/title-defense"
              className={buttonVariants({ variant: "outline" })}
            >
              Go to Title Defense
            </Link>
          </CardContent>
        </Card>
      )}

      {uiState === "APPROVED_ACTIVE" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              Adviser Request complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-(--earist-body-text)">
              Your Adviser Request process is complete.
            </p>
            <p>
              Active adviser:{" "}
              <span className="font-semibold">
                {activeAdviser?.name ?? "Assigned adviser"}
              </span>
            </p>
            <Link
              href="/student/thesis/proposal-defense"
              className={buttonVariants()}
            >
              Continue to Proposal Defense
            </Link>
          </CardContent>
        </Card>
      )}

      {uiState === "WAITING_ADVISER" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-5 w-5 text-amber-600" />
              Waiting for Adviser Response
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-(--earist-body-text)">
              Your adviser request has been sent to{" "}
              <span className="font-semibold text-(--earist-primary)">
                {req?.requestedAdviserName || "the selected adviser"}
              </span>
              . The requested adviser must respond before the request can
              proceed to Dean review.
            </p>
            <p className="text-xs text-(--earist-body-text)">
              This is not yet an active adviser assignment.
            </p>
          </CardContent>
        </Card>
      )}

      {uiState === "WAITING_DEAN" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-5 w-5 text-amber-600" />
              Adviser CONFORME Recorded
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-(--earist-body-text)">
              Your requested adviser has accepted the request. The request is
              now waiting for Dean approval.
            </p>
            <p className="font-medium">
              Requested adviser:{" "}
              {req?.requestedAdviserName || "the selected adviser"}
            </p>
            <p className="text-xs text-(--earist-body-text)">
              No active adviser assignment exists until Dean approval is
              completed.
            </p>
          </CardContent>
        </Card>
      )}

      {(uiState === "DECLINED_RETRY" || uiState === "DEAN_REJECTED_RETRY") && (
        <Alert>
          {uiState === "DECLINED_RETRY" ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {uiState === "DECLINED_RETRY"
              ? "Adviser declined"
              : "Dean rejected"}
          </AlertTitle>
          <AlertDescription>
            {uiState === "DECLINED_RETRY"
              ? "The requested adviser declined this request. You may select another eligible Title Defense panel member below."
              : "Dean review rejected this request. You may select another eligible Title Defense panel member below."}
            {uiState === "DEAN_REJECTED_RETRY" && req ? (
              <span className="mt-1 block text-xs">
                Previous request: {req.requestedAdviserName}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {uiState === "UNEXPECTED" && (
        <Card>
          <CardContent className="pt-6 text-sm text-(--earist-body-text)">
            Adviser Request status is unavailable. Open Thesis Journey to
            refresh.
          </CardContent>
        </Card>
      )}

      {needCandidates && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Eligible Adviser Candidates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-(--earist-body-text)">
              These candidates come from your Title Defense panel (Chairman and
              Panelists).
            </p>

            {candidatesLoading && (
              <p className="text-sm text-(--earist-body-text)">
                Loading eligible candidates…
              </p>
            )}

            {candidatesError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Candidate load failed</AlertTitle>
                <AlertDescription>
                  Unable to load Title Defense panel candidates.
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => refetchCandidates()}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!candidatesLoading &&
              !candidatesError &&
              (candidatesData?.candidates.length ?? 0) === 0 && (
                <p className="text-sm text-(--earist-body-text)">
                  No eligible Title Defense panel member is currently available
                  for adviser selection.
                </p>
              )}

            <div className="grid gap-3 sm:grid-cols-2">
              {(candidatesData?.candidates ?? []).map((c) => {
                const selected = selectedUserId === c.userId;
                return (
                  <button
                    key={c.userId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedUserId(c.userId)}
                    className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-(--earist-primary) ${
                      selected
                        ? "border-(--earist-primary) bg-(--earist-surface-light-red) ring-1 ring-(--earist-primary)"
                        : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-(--earist-primary)">
                          Dr. {c.name}
                        </p>
                        <p className="text-xs text-(--earist-body-text)">
                          {roleLabel(c.defenseRole)} — Title Defense
                        </p>
                      </div>
                      <Badge variant={selected ? "default" : "outline"}>
                        {selected ? "Selected" : "Select"}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-(--earist-body-text)">
                      <p>Specialization: {c.specialization || "—"}</p>
                      <p>Office: {c.officeAffiliation || "—"}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <label
                className="text-xs font-medium text-(--earist-body-text)"
                htmlFor="request-remarks"
              >
                Request Remarks (Optional)
              </label>
              <Textarea
                id="request-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Brief note for the requested adviser"
                rows={3}
              />
            </div>

            <Button
              type="button"
              disabled={!selectedUserId || createRequest.isPending}
              onClick={() => setConfirmOpen(true)}
              className="w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90 sm:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              Review &amp; Send Adviser Request
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Adviser Request</DialogTitle>
            <DialogDescription>
              Review the details before sending your GS-020 adviser request.
            </DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-(--earist-body-text)">Official title: </span>
                <span className="font-medium">{officialTitle || "—"}</span>
              </p>
              <p>
                <span className="text-(--earist-body-text)">Selected adviser: </span>
                <span className="font-medium">Dr. {selectedCandidate.name}</span>
              </p>
              <p>
                <span className="text-(--earist-body-text)">Title Defense role: </span>
                {roleLabel(selectedCandidate.defenseRole)}
              </p>
              <p>
                <span className="text-(--earist-body-text)">Specialization: </span>
                {selectedCandidate.specialization || "—"}
              </p>
              <p>
                <span className="text-(--earist-body-text)">Office: </span>
                {selectedCandidate.officeAffiliation || "—"}
              </p>
              <p>
                <span className="text-(--earist-body-text)">Remarks: </span>
                {remarks.trim() || "—"}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={createRequest.isPending}
            >
              Go Back
            </Button>
            <Button
              type="button"
              disabled={createRequest.isPending}
              onClick={() => createRequest.mutate()}
              className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
            >
              <Send className="mr-2 h-4 w-4" />
              {createRequest.isPending ? "Sending…" : "Send Adviser Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
