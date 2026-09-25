"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Upload,
  FileText,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";

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
              Upload {label}
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
                <p className="text-xs text-(--earist-body-text)">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
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
 * WP11 — Title Defense integrated with centralized Journey.
 * Academic progression comes only from GET /thesis/journey.
 */
export default function TitleDefensePage() {
  const queryClient = useQueryClient();
  const {
    data: journey,
    isLoading,
    isError,
    refetch,
  } = useStudentThesisJourney();

  const titleStep = journeyStepFor(journey, "TITLE_DEFENSE");
  const state = titleStep?.state;
  const selectedTitle = journey?.selectedTitle ?? null;

  const [titles, setTitles] = useState({ t1: "", t2: "", t3: "" });
  const [conceptPaper, setConceptPaper] = useState<File | null>(null);
  const conceptInputRef = useRef<HTMLInputElement>(null);
  const [cor, setCor] = useState<File | null>(null);
  const corInputRef = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const allTitlesFilled =
    titles.t1.trim() && titles.t2.trim() && titles.t3.trim();
  const canSubmit =
    allTitlesFilled && conceptPaper !== null && cor !== null && receipt !== null;

  const submitTitle = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("title1", titles.t1.trim());
      formData.append("title2", titles.t2.trim());
      formData.append("title3", titles.t3.trim());
      formData.append("conceptPaper", conceptPaper!);
      formData.append("cor", cor!);
      formData.append("receipt", receipt!);
      return apiClientRequest("/thesis/defense/title", {
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
        <p className="text-sm text-red-600">Unable to load Title Defense status.</p>
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
              <p className="font-semibold">Title Defense is locked</p>
            </div>
            <p className="text-sm text-(--earist-body-text)">
              {titleStep?.lockReason ||
                "This step is currently unavailable."}
            </p>
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
            Title Defense
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Formal Title Defense is complete.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-semibold">Title Defense completed</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-(--earist-body-text)">
                Official Title
              </p>
              <p className="mt-1 font-medium text-(--earist-primary)">
                {selectedTitle?.titleText || "—"}
              </p>
            </div>
            {titleStep?.nextAction && (
              <p className="text-sm text-(--earist-body-text)">
                {titleStep.nextAction}
              </p>
            )}
            <Link
              href={journeyRouteFor("ADVISER_REQUEST")}
              className={buttonVariants()}
            >
              Continue to Adviser Request
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
            Title Defense
          </h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-5 w-5 text-amber-600" />
              Application under review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-(--earist-body-text)">
              {titleStep?.lockReason ||
                titleStep?.detail ||
                "Your Title Defense application is under review."}
            </p>
            {titleStep?.nextAction && (
              <p className="text-(--earist-body-text)">{titleStep.nextAction}</p>
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

  // CURRENT / AVAILABLE — but rejected applications must not start a duplicate.
  const rejectedHint = (titleStep?.detail || "").toLowerCase().includes("reject");
  if (rejectedHint) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Title Defense
          </h2>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Application returned</AlertTitle>
          <AlertDescription>
            {titleStep?.detail ||
              "Your Title Defense application was rejected."}{" "}
            Update your requirements and resubmit when instructed by the
            Graduate School. A new application form is not shown here to avoid
            creating a duplicate request.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          Title Defense Application
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Submit three proposed research titles and the required Title Defense
          documents. No adviser is required for Title Defense.
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
            Your Title Defense application was submitted. Status will update
            from the Thesis Journey.
          </AlertDescription>
        </Alert>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit || submitTitle.isPending) return;
          submitTitle.mutate();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Proposed Research Titles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { key: "t1", label: "Proposed Title 1" },
                { key: "t2", label: "Proposed Title 2" },
                { key: "t3", label: "Proposed Title 3" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                    {field.label} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={submitTitle.isPending}
                    value={titles[field.key as keyof typeof titles]}
                    onChange={(e) =>
                      setTitles((prev) => ({
                        ...prev,
                        [field.key]: e.target.value.slice(0, 250),
                      }))
                    }
                    placeholder="Enter your proposed research title..."
                    className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FileSlot
            label="Title Defense Proposal Package"
            file={conceptPaper}
            inputRef={conceptInputRef}
            accept=".pdf"
            hint="PDF ONLY · Upload Proposal Package"
            onPick={setConceptPaper}
            onRemove={() => {
              setConceptPaper(null);
              if (conceptInputRef.current) conceptInputRef.current.value = "";
            }}
          />
          <FileSlot
            label="Current Semester COR"
            file={cor}
            inputRef={corInputRef}
            accept=".pdf,.jpg,.jpeg,.png"
            hint="PDF, JPG, PNG"
            onPick={setCor}
            onRemove={() => {
              setCor(null);
              if (corInputRef.current) corInputRef.current.value = "";
            }}
          />
          <FileSlot
            label="Defense-fee proof of payment"
            file={receipt}
            inputRef={receiptInputRef}
            accept=".pdf,.jpg,.jpeg,.png"
            hint="PDF, JPG, PNG"
            onPick={setReceipt}
            onRemove={() => {
              setReceipt(null);
              if (receiptInputRef.current) receiptInputRef.current.value = "";
            }}
          />
        </div>

        <Button
          type="submit"
          disabled={!canSubmit || submitTitle.isPending}
          className="w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90 sm:w-auto"
        >
          <Send className="mr-2 h-4 w-4" />
          {submitTitle.isPending ? "Submitting…" : "Submit Title Defense Application"}
        </Button>
      </form>
    </div>
  );
}
