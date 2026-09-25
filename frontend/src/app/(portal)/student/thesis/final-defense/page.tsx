"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest, ApiError } from "@/lib/api.client";
import {
  studentThesisJourneyQueryKey,
  journeyRouteFor,
  journeyStepFor,
} from "@/lib/student-thesis-journey";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Send,
  Upload,
  X,
} from "lucide-react";

type MissingRequirement = {
  code: string;
  message: string;
  stage: string;
};

function FileSlot({
  label,
  file,
  inputRef,
  accept,
  hint,
  onPick,
  onRemove,
}: {
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  hint: string;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!file ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--earist-border-gray) p-6 transition-colors hover:border-(--earist-primary) hover:bg-(--earist-surface-gray)">
            <Upload className="mb-2 h-8 w-8 text-(--earist-body-text)/40" />
            <p className="text-center text-sm font-medium text-(--earist-primary)">
              Upload
            </p>
            <p className="text-xs text-(--earist-body-text)">{hint}</p>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-(--earist-surface-gray)">
                <FileText className="h-4 w-4 text-(--earist-primary)" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--earist-primary)">
                  {file.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="flex w-full items-center justify-center rounded p-2 text-xs text-red-500 hover:bg-red-50"
            >
              <X className="mr-1 h-4 w-4" /> Remove
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  } = useStudentThesisJourney();

  const finalStep = journeyStepFor(journey, "FINAL_DEFENSE");
  const state = finalStep?.state;

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
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
      },
    enabled: state === "CURRENT" || state === "AVAILABLE",
    retry: 1,
  });

  const systemGaps = useMemo(
    () =>
      (eligibility?.missing ?? []).filter(
        (m) => !["FINAL_MANUSCRIPT", "COR", "RECEIPT"].includes(m.code),
      ),
    [eligibility],
  );

  const eligibilityReady = eligibility != null && !eligibilityError;

  const canSubmit =
    eligibilityReady &&
    !!documentFile &&
    !!corFile &&
    !!receiptFile &&
    (state === "CURRENT" || state === "AVAILABLE") &&
    systemGaps.length === 0;

  const submitFinal = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("document", documentFile!);
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
      setSubmitError((error.message || "Failed to submit application") + extra);
      setSubmitSuccess(false);
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
      <div className="mx-auto max-w-3xl py-8">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-(--earist-secondary)" />
              <p className="font-semibold">Final Defense is locked</p>
            </div>
            <p className="text-sm text-(--earist-body-text)">
              {finalStep?.lockReason || "This step is currently unavailable."}
            </p>
            <Link
              href={journeyRouteFor("STRIKE")}
              className={buttonVariants({ variant: "outline" })}
            >
              Go to STRIKE / Plagiarism
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "COMPLETED") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Final Defense
          </h2>
        </div>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-semibold">Final Defense completed</p>
            </div>
            {finalStep?.nextAction && (
              <p className="text-sm text-(--earist-body-text)">
                {finalStep.nextAction}
              </p>
            )}
            <Link href="/student/thesis" className={buttonVariants()}>
              Continue in Thesis Journey
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "WAITING") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Final Defense
          </h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-5 w-5 text-amber-600" />
              Application in progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-(--earist-body-text)">
              {finalStep?.detail ||
                finalStep?.lockReason ||
                "Your Final Defense application is under review."}
            </p>
            {finalStep?.nextAction && (
              <p className="text-(--earist-body-text)">{finalStep.nextAction}</p>
            )}
            <Link
              href="/student/thesis"
              className={buttonVariants({ variant: "outline" })}
            >
              Continue in Thesis Journey
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rejectedHint = (finalStep?.detail || "").toLowerCase().includes("reject");
  if (rejectedHint) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Final Defense
          </h2>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Application returned</AlertTitle>
          <AlertDescription>
            {finalStep?.detail ||
              "Your Final Defense application was rejected."}{" "}
            Update your requirements and resubmit when instructed. A new
            application form is not shown here to avoid creating a duplicate
            request.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          Final Defense Application
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Stage-scoped uploads for Final Defense (Cashier payment happens outside
          GS-IS — upload proof only).
        </p>
      </div>

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FileSlot
          label="Complete manuscript — preliminaries through Chapters 1–5"
          file={documentFile}
          inputRef={documentInputRef}
          accept=".pdf,.doc,.docx"
          hint="Final stage upload"
          onPick={setDocumentFile}
          onRemove={() => {
            setDocumentFile(null);
            if (documentInputRef.current) documentInputRef.current.value = "";
          }}
        />
        <FileSlot
          label="Certificate of Registration (COR)"
          file={corFile}
          inputRef={corInputRef}
          accept=".pdf,.jpg,.jpeg,.png"
          hint="This application"
          onPick={setCorFile}
          onRemove={() => {
            setCorFile(null);
            if (corInputRef.current) corInputRef.current.value = "";
          }}
        />
        <FileSlot
          label="Defense-fee proof of payment"
          file={receiptFile}
          inputRef={receiptInputRef}
          accept=".pdf,.jpg,.jpeg,.png"
          hint="Cashier proof"
          onPick={setReceiptFile}
          onRemove={() => {
            setReceiptFile(null);
            if (receiptInputRef.current) receiptInputRef.current.value = "";
          }}
        />
      </div>

      <Button
        type="button"
        disabled={!canSubmit || submitFinal.isPending || eligibilityLoading}
        onClick={() => submitFinal.mutate()}
        className="w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90 sm:w-auto"
      >
        <Send className="mr-2 h-4 w-4" />
        {submitFinal.isPending
          ? "Submitting…"
          : "Submit Final Defense Application"}
      </Button>
    </div>
  );
}
