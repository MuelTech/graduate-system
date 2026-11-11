"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import {
  studentThesisJourneyQueryKey,
  journeyRouteFor,
  journeyStepFor,
} from "@/lib/student-thesis-journey";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import { RejectedApplicationCorrection } from "@/components/student/rejected-application-correction";
import {
  DefenseScheduleSummary,
  DefenseStatusPanel,
} from "@/components/student/defense-status-panel";
import {
  ProposalAdviserReviewPanel,
  proposalAdviserReviewQueryKey,
} from "@/components/student/proposal-adviser-review-panel";
import type { ProposalAdviserReview } from "@/types/proposal-adviser-review";
import {
  ThesisJourneyShell,
  JourneyStepStatusCard,
  DocumentUploadSlot,
} from "@/components/student/thesis-journey-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Send,
} from "lucide-react";

type MissingRequirement = {
  code: string;
  message: string;
  stage: string;
};

/**
 * WP11 — Proposal Defense integrated with centralized Journey.
 * Journey = academic access. Eligibility endpoint = submit-time requirements.
 */
export default function ProposalDefensePage() {
  const queryClient = useQueryClient();
  const {
    data: journey,
    isLoading,
    isError,
    refetch,
    refreshStatus,
    isRefreshing,
  } = useStudentThesisJourney();

  const proposalStep = journeyStepFor(journey, "PROPOSAL_DEFENSE");
  const state = proposalStep?.state;
  const activeAdviser = journey?.activeAdviser ?? null;

  const [corFile, setCorFile] = useState<File | null>(null);
  const corInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    data: eligibility,
    isLoading: eligibilityLoading,
    isError: eligibilityError,
    refetch: refetchEligibility,
  } = useQuery({
    queryKey: ["thesisEligibility", "PROPOSAL_DEFENSE"],
    queryFn: async () =>
      (await apiClientRequest("/thesis/eligibility/PROPOSAL_DEFENSE")) as {
        eligible: boolean;
        missing: MissingRequirement[];
        adviserCerts?: { proposal?: boolean; final?: boolean };
      },
    enabled: state === "CURRENT" || state === "AVAILABLE",
    retry: 1,
  });

  const { data: reviewData } = useQuery<ProposalAdviserReview>({
    queryKey: proposalAdviserReviewQueryKey,
    queryFn: async () =>
      (await apiClientRequest(
        "/thesis/proposal-adviser-review",
      )) as ProposalAdviserReview,
    enabled: state === "CURRENT" || state === "AVAILABLE",
  });

  const isAdviserCertified =
    reviewData?.reviewStatus === "ISSUED" ||
    eligibility?.adviserCerts?.proposal === true;

  const systemGaps = useMemo(
    () =>
      (eligibility?.missing ?? []).filter(
        (m) =>
          ![
            "PROPOSAL_CHAPTERS",
            "COR",
            "RECEIPT",
            ...(isAdviserCertified ? [] : ["ADVISER_CERT"]),
          ].includes(m.code),
      ),
    [eligibility, isAdviserCertified],
  );

  // Fail closed: submit only when eligibility actually loaded successfully.
  const eligibilityReady = eligibility != null && !eligibilityError;

  // CP3-FIX1: no second manuscript — certified manuscript is system-owned.
  const canSubmit =
    eligibilityReady &&
    isAdviserCertified &&
    !!corFile &&
    !!receiptFile &&
    (state === "CURRENT" || state === "AVAILABLE") &&
    systemGaps.length === 0 &&
    !(eligibility?.missing ?? []).some((m) => m.code === "ADVISER_CERT");

  const submitProposal = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("cor", corFile!);
      formData.append("receipt", receiptFile!);
      return apiClientRequest("/thesis/defense/proposal", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async () => {
      setSubmitError(null);
      setSubmitSuccess(true);
      toast.success("Proposal defense application submitted.");
      await queryClient.invalidateQueries({
        queryKey: studentThesisJourneyQueryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: ["thesisEligibility", "PROPOSAL_DEFENSE"],
      });
    },
    onError: (error: Error) => {
      const extra =
        error instanceof ApiError && error.missing?.length
          ? ` ${error.missing.map((m) => m.message).join(" ")}`
          : "";
      const fullError = (error.message || "Failed to submit application") + extra;
      setSubmitError(fullError);
      setSubmitSuccess(false);
      toast.error(fullError);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--earist-primary)" />
      </div>
    );
  }

  if (isError || !journey) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8 text-center">
        <p className="text-sm text-red-600">
          Unable to load Proposal Defense status.
        </p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (state === "LOCKED") {
    return (
      <ThesisJourneyShell
        activeStep="PROPOSAL_DEFENSE"
        title="Proposal Defense"
        description="Step 3 of your Graduate Thesis Journey."
        journey={journey}
      >
        <JourneyStepStatusCard
          variant="locked"
          title="Proposal Defense is Locked"
          badgeText="Locked"
          description={
            proposalStep?.lockReason || "This step is currently unavailable."
          }
          nextStepHref="/student/thesis"
          nextStepLabel="Back to Thesis Journey"
        />
      </ThesisJourneyShell>
    );
  }

  if (state === "COMPLETED") {
    const nextHref = journey.policy?.strikeRequired
      ? journeyRouteFor("STRIKE")
      : journeyRouteFor("FINAL_DEFENSE");
    const nextLabel = journey.policy?.strikeRequired
      ? "Continue to STRIKE / Plagiarism"
      : "Continue to Final Defense";

    return (
      <ThesisJourneyShell
        activeStep="PROPOSAL_DEFENSE"
        title="Proposal Defense"
        description="Formal Proposal Defense is complete."
        journey={journey}
      >
        <JourneyStepStatusCard
          variant="completed"
          title="Proposal Defense Completed"
          badgeText="Completed"
          description={
            proposalStep?.nextAction ||
            "Your Proposal Defense has been officially passed and finalized."
          }
          nextStepHref={nextHref}
          nextStepLabel={nextLabel}
        />
        <DefenseScheduleSummary session={proposalStep?.defenseSession} />
      </ThesisJourneyShell>
    );
  }

  if (state === "WAITING") {
    return (
      <ThesisJourneyShell
        activeStep="PROPOSAL_DEFENSE"
        title="Proposal Defense"
        description="Track your Proposal Defense application, schedule, and official records."
        journey={journey}
      >
        <DefenseStatusPanel
          kind="Proposal"
          step={proposalStep}
          onRefresh={refreshStatus}
          isRefreshing={isRefreshing}
          extra={
            <Link
              href="/student/thesis"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to Thesis Journey
            </Link>
          }
        />
      </ThesisJourneyShell>
    );
  }

  const rejectedHint = (proposalStep?.detail || "")
    .toLowerCase()
    .includes("reject");
  if (rejectedHint) {
    return (
      <ThesisJourneyShell
        activeStep="PROPOSAL_DEFENSE"
        title="Proposal Defense"
        description="Review feedback and resubmit your Proposal Defense application."
        journey={journey}
      >
        <RejectedApplicationCorrection stage="PROPOSAL" reason={proposalStep?.detail} />
      </ThesisJourneyShell>
    );
  }

  void activeAdviser;

  // CURRENT / AVAILABLE
  return (
    <ThesisJourneyShell
      activeStep="PROPOSAL_DEFENSE"
      title="Proposal Defense Application"
      description="Complete your Adviser manuscript certification and upload your current semester COR and defense-fee proof of payment."
      journey={journey}
    >
      {/* CP3: manuscript → Adviser review/certification before Admin application */}
      <ProposalAdviserReviewPanel />

      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Submission failed</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      {submitSuccess && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Application submitted</AlertTitle>
          <AlertDescription>
            Your Proposal Defense application was submitted. Status will update
            from the Thesis Journey.
          </AlertDescription>
        </Alert>
      )}

      {eligibilityError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Requirements unavailable</AlertTitle>
          <AlertDescription>
            Application requirements could not be loaded. Submission is
            disabled until requirements load successfully.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => refetchEligibility()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {systemGaps.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>System requirements not met</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {systemGaps.map((m) => (
                <li key={m.code}>{m.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* CP3-FIX1: certified Proposal manuscript is system-owned — COR + fee only */}
      {!isAdviserCertified ? (
        <Card className="border-dashed border-gray-200 bg-gray-50/60 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-gray-500">
                <Lock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                2. Defense Application Requirements — COR &amp; Proof of Payment
              </CardTitle>
              <Badge
                variant="outline"
                className="border-gray-200 bg-white text-gray-600"
              >
                Locked until Adviser Certification
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Once your Adviser reviews and certifies your Proposal manuscript in{" "}
              <span className="font-semibold text-[#333333]">Step 1</span>, this
              section will automatically unlock so you can upload your current
              semester{" "}
              <span className="font-medium text-[#333333]">
                Certificate of Registration (COR)
              </span>{" "}
              and{" "}
              <span className="font-medium text-[#333333]">
                Defense-fee Proof of Payment
              </span>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base font-bold text-[#333333]">
                2. Defense Application Requirements — COR &amp; Proof of Payment
              </CardTitle>
              <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                Ready for Upload
              </Badge>
            </div>
            <p className="text-xs text-gray-500">
              Your Proposal manuscript is certified. Upload your current semester
              COR and Cashier defense-fee receipt below to submit your application.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DocumentUploadSlot
                label="Certificate of Registration (COR)"
                helper={[
                  "Upload your current semester Certificate of Registration.",
                ]}
                accept=".pdf,.jpg,.jpeg,.png"
                file={corFile}
                disabled={submitProposal.isPending}
                onTriggerPick={() => corInputRef.current?.click()}
                registerInput={(el) => {
                  corInputRef.current = el;
                }}
                onPick={setCorFile}
                onRemove={() => {
                  setCorFile(null);
                  if (corInputRef.current) corInputRef.current.value = "";
                }}
              />
              <DocumentUploadSlot
                label="Defense-fee Proof of Payment"
                helper={[
                  "Upload your official Cashier proof of payment for Proposal Defense.",
                ]}
                accept=".pdf,.jpg,.jpeg,.png"
                file={receiptFile}
                disabled={submitProposal.isPending}
                onTriggerPick={() => receiptInputRef.current?.click()}
                registerInput={(el) => {
                  receiptInputRef.current = el;
                }}
                onPick={setReceiptFile}
                onRemove={() => {
                  setReceiptFile(null);
                  if (receiptInputRef.current) receiptInputRef.current.value = "";
                }}
              />
            </div>

            <Button
              type="button"
              disabled={
                !canSubmit || submitProposal.isPending || eligibilityLoading
              }
              onClick={() => submitProposal.mutate()}
              className="w-full sm:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitProposal.isPending
                ? "Submitting…"
                : "Submit Proposal Defense Application"}
            </Button>
          </CardContent>
        </Card>
      )}
    </ThesisJourneyShell>
  );
}
