"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import {
  studentThesisJourneyQueryKey,
  journeyStepFor,
} from "@/lib/student-thesis-journey";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import { RejectedApplicationCorrection } from "@/components/student/rejected-application-correction";
import {
  DefenseScheduleSummary,
  DefenseStatusPanel,
} from "@/components/student/defense-status-panel";
import {
  FinalAdviserReviewPanel,
  finalAdviserReviewQueryKey,
  type FinalAdviserReview,
} from "@/components/student/final-adviser-review-panel";
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
 * WP12 — Final Defense integrated with centralized Journey.
 * Journey = academic access. Eligibility endpoint = submit-time requirements.
 */
export default function FinalDefensePage() {
  const queryClient = useQueryClient();
  const {
    data: journey,
    isLoading,
    isError,
    refetch,
    refreshStatus,
    isRefreshing,
  } = useStudentThesisJourney();

  const finalStep = journeyStepFor(journey, "FINAL_DEFENSE");
  const state = finalStep?.state;

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
    queryKey: ["thesisEligibility", "FINAL_DEFENSE"],
    queryFn: async () =>
      (await apiClientRequest("/thesis/eligibility/FINAL_DEFENSE")) as {
        eligible: boolean;
        missing: MissingRequirement[];
        adviserCerts?: { proposal?: boolean; final?: boolean };
      },
    enabled: state === "CURRENT" || state === "AVAILABLE",
    retry: 1,
  });

  const { data: reviewData } = useQuery<FinalAdviserReview>({
    queryKey: finalAdviserReviewQueryKey,
    queryFn: async () =>
      (await apiClientRequest(
        "/thesis/final-adviser-review",
      )) as FinalAdviserReview,
    enabled: state === "CURRENT" || state === "AVAILABLE",
  });

  const isAdviserCertified =
    reviewData?.reviewStatus === "ISSUED" ||
    eligibility?.adviserCerts?.final === true;

  const systemGaps = useMemo(
    () =>
      (eligibility?.missing ?? []).filter(
        (m) =>
          ![
            "FINAL_MANUSCRIPT",
            "COR",
            "RECEIPT",
            ...(isAdviserCertified ? [] : ["ADVISER_CERT"]),
          ].includes(m.code),
      ),
    [eligibility, isAdviserCertified],
  );

  const eligibilityReady = eligibility != null && !eligibilityError;

  const canSubmit =
    eligibilityReady &&
    isAdviserCertified &&
    !!corFile &&
    !!receiptFile &&
    (state === "CURRENT" || state === "AVAILABLE") &&
    systemGaps.length === 0 &&
    !(eligibility?.missing ?? []).some((m) => m.code === "ADVISER_CERT");

  const submitFinal = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      // CP4: certified Final manuscript is system-owned — COR + fee only.
      formData.append("cor", corFile!);
      formData.append("receipt", receiptFile!);
      return apiClientRequest("/thesis/defense/final", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async () => {
      setSubmitError(null);
      setSubmitSuccess(true);
      toast.success("Final defense application submitted.");
      await queryClient.invalidateQueries({
        queryKey: studentThesisJourneyQueryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: ["thesisEligibility", "FINAL_DEFENSE"],
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
          Unable to load Final Defense status.
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
        activeStep="FINAL_DEFENSE"
        title="Final Defense"
        description="Step 5 of your Graduate Thesis Journey."
        journey={journey}
      >
        <JourneyStepStatusCard
          variant="locked"
          title="Final Defense is Locked"
          badgeText="Locked"
          description={
            finalStep?.lockReason || "This step is currently unavailable."
          }
          nextStepHref="/student/thesis"
          nextStepLabel="Back to Thesis Journey"
        />
      </ThesisJourneyShell>
    );
  }

  if (state === "COMPLETED") {
    return (
      <ThesisJourneyShell
        activeStep="FINAL_DEFENSE"
        title="Final Defense"
        description="Formal Final Defense is complete."
        journey={journey}
      >
        <JourneyStepStatusCard
          variant="completed"
          title="Final Defense Completed"
          badgeText="Completed"
          description={
            finalStep?.nextAction ||
            "Congratulations! Your Final Defense has been officially passed and finalized."
          }
        />
        <DefenseScheduleSummary session={finalStep?.defenseSession} />
      </ThesisJourneyShell>
    );
  }

  if (state === "WAITING") {
    return (
      <ThesisJourneyShell
        activeStep="FINAL_DEFENSE"
        title="Final Defense"
        description="Track your Final Defense application and schedule status."
        journey={journey}
      >
        <DefenseStatusPanel
          kind="Final"
          step={finalStep}
          onRefresh={refreshStatus}
          isRefreshing={isRefreshing}
          extra={
            <Link
              href="/student/thesis"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to Thesis Journey
            </Link>
          }
        />
      </ThesisJourneyShell>
    );
  }

  const rejectedHint = (finalStep?.detail || "").toLowerCase().includes("reject");
  if (rejectedHint) {
    return (
      <ThesisJourneyShell
        activeStep="FINAL_DEFENSE"
        title="Final Defense"
        description="Review feedback and resubmit your Final Defense application."
        journey={journey}
      >
        <RejectedApplicationCorrection stage="FINAL" reason={finalStep?.detail} />
      </ThesisJourneyShell>
    );
  }

  return (
    <ThesisJourneyShell
      activeStep="FINAL_DEFENSE"
      title="Final Defense Application"
      description="Complete your Adviser manuscript certification and upload your current semester COR and defense-fee proof of payment."
      journey={journey}
    >
      {/* CP4: manuscript → Adviser review/certification before Admin application */}
      <FinalAdviserReviewPanel />

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
            Your Final Defense application was submitted. Status will update from
            the Thesis Journey.
          </AlertDescription>
        </Alert>
      )}

      {eligibilityError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Requirements unavailable</AlertTitle>
          <AlertDescription>
            Application requirements could not be loaded. Submission is disabled
            until requirements load successfully.
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

      {/* CP4: certified Final manuscript is system-owned — COR + fee only */}
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
              Once your Adviser reviews and certifies your Final manuscript in{" "}
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
              Your Final manuscript is certified. Upload your current semester
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
                disabled={submitFinal.isPending}
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
                  "Upload your official Cashier proof of payment for Final Defense.",
                ]}
                accept=".pdf,.jpg,.jpeg,.png"
                file={receiptFile}
                disabled={submitFinal.isPending}
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
                !canSubmit || submitFinal.isPending || eligibilityLoading
              }
              onClick={() => submitFinal.mutate()}
              className="w-full sm:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitFinal.isPending
                ? "Submitting…"
                : "Submit Final Defense Application"}
            </Button>
          </CardContent>
        </Card>
      )}
    </ThesisJourneyShell>
  );
}
