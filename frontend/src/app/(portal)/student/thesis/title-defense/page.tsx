"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { TitleDefensePostSubmission } from "@/components/student/title-defense-post-submission";
import { LocalFilePreviewDialog } from "@/components/student/local-file-preview-dialog";
import {
  ThesisJourneyShell,
  JourneyStepStatusCard,
  DocumentUploadSlot,
} from "@/components/student/thesis-journey-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type DocKey = "package" | "cor" | "receipt";

interface DocConfig {
  key: DocKey;
  field: string;
  label: string;
  helper: string[];
  accept: string;
  /** Optional in-container requirement guidance (package only). */
  guidance?: ReactNode;
  /** Optional short format note shown above the picker. */
  formatNote?: string;
  /** Optional concise reminder shown next to this item in the confirm dialog. */
  dialogNote?: string;
}

const DOCUMENTS: DocConfig[] = [
  {
    key: "package",
    field: "conceptPaper",
    label: "Title Defense Proposal Package",
    helper: [
      "Upload one PDF containing your complete Title Defense proposal package.",
      "If your proposal contains three title options, include all of them inside this document.",
    ],
    accept: ".pdf",
    formatNote: "PDF only · One combined file for all 3 title proposals",
    dialogNote:
      "Confirm that the PDF contains three complete title proposals and the required supporting information for each.",
    guidance: (
      <div className="mt-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
        <p className="font-medium text-(--earist-secondary)">
          What should be included?
        </p>
        <p className="mt-1">
          Each of the three title proposals in your PDF should include:
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Rationale of the Study</li>
          <li>Statement of the Problem (SOP)</li>
          <li>Hypothesis</li>
          <li>Population</li>
          <li>Research Locale</li>
          <li>
            Student Profile with picture
            <span className="mt-0.5 block text-[11px] text-(--earist-body-text)/80">
              Name · Degree Program &amp; Major · Occupation / Position ·
              School / Office Address · Subject Taught &amp; Grade Level
            </span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: "cor",
    field: "cor",
    label: "Current Semester COR",
    helper: ["Upload your current semester Certificate of Registration."],
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    key: "receipt",
    field: "receipt",
    label: "Defense-fee Proof of Payment",
    helper: ["Upload your proof of payment for the Title Defense fee."],
    accept: ".pdf,.jpg,.jpeg,.png",
  },
];

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * WP11 / UIUX-4B (FIX-1) — Title Defense application.
 * Academic progression comes only from GET /thesis/journey.
 * Confirmed Title scope (2026-10-15): ONE combined Title Defense
 * Proposal Package + Current Semester COR + Defense-fee Proof of Payment.
 * Structured proposed titles are optional legacy input only.
 */
export default function TitleDefensePage() {
  const queryClient = useQueryClient();
  const {
    data: journey,
    isLoading,
    isError,
    refetch,
    refreshStatus,
    isRefreshing,
  } = useStudentThesisJourney();

  const titleStep = journeyStepFor(journey, "TITLE_DEFENSE");
  const state = titleStep?.state;

  const [files, setFiles] = useState<Record<DocKey, File | null>>({
    package: null,
    cor: null,
    receipt: null,
  });
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Revoke any live local preview object URL on change and unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const allDocsSelected =
    files.package !== null && files.cor !== null && files.receipt !== null;
  const canSubmit = allDocsSelected && !submitSuccess;

  const submitTitle = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      // 2026-10-15: the Title Proposal package is the academic Title submission.
      // No structured title1/title2/title3 fields are required or sent.
      for (const config of DOCUMENTS) {
        formData.append(config.field, files[config.key]!);
      }
      return apiClientRequest("/thesis/defense/title", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: async () => {
      setSubmitError(null);
      setSubmitSuccess(true);
      setConfirmOpen(false);
      toast.success("Title Defense application submitted", {
        description:
          "Your required documents were uploaded successfully and your application is now under Graduate School review.",
      });
      await queryClient.invalidateQueries({
        queryKey: studentThesisJourneyQueryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: ["student", "thesis", "current-application"],
      });
    },
    onError: (error: Error) => {
      const extra =
        error instanceof ApiError && error.missing?.length
          ? ` ${error.missing.map((m) => m.message).join(" ")}`
          : "";
      setSubmitError((error.message || "Failed to submit application") + extra);
      setSubmitSuccess(false);
      setConfirmOpen(false);
      toast.error("Submission failed", {
        description:
          "Your application was not submitted. Review the error and try again.",
      });
    },
  });

  const setSlot = (key: DocKey, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
    const ref = inputRefs.current[key];
    if (ref) ref.value = "";
    // Any change invalidates an open preview of the previous selection.
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  const openPreview = (file: File | null) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handlePreviewOpenChange = (next: boolean) => {
    if (!next) {
      setPreviewFile(null);
      setPreviewUrl(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-gray-200" />
        <div className="h-44 w-full animate-pulse rounded-xl bg-gray-200" />
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
      <ThesisJourneyShell
        activeStep="TITLE_DEFENSE"
        title="Title Defense"
        description="Step 1 of your Graduate Thesis Journey."
        journey={journey}
      >
        <JourneyStepStatusCard
          variant="locked"
          title="Title Defense is Locked"
          badgeText="Locked"
          description={
            titleStep?.lockReason || "This step is currently unavailable."
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
        activeStep="TITLE_DEFENSE"
        title="Title Defense"
        description="Formal Title Defense is complete."
        journey={journey}
      >
        <JourneyStepStatusCard
          variant="completed"
          title="Title Defense Completed"
          badgeText="Completed"
          description={
            titleStep?.nextAction ||
            "Your Title Defense has been officially passed and finalized."
          }
          nextStepHref={journeyRouteFor("ADVISER_REQUEST")}
          nextStepLabel="Continue to Adviser Request"
        />
        <DefenseScheduleSummary session={titleStep?.defenseSession} />
      </ThesisJourneyShell>
    );
  }

  if (state === "WAITING") {
    // UIUX-4C: Title post-submission status — Under Review / Approved / Scheduled.
    const ds = titleStep?.defenseStatus;
    if (
      ds === "APPLICATION_UNDER_REVIEW" ||
      ds === "APPROVED_WAITING_SCHEDULE" ||
      ds === "SCHEDULED"
    ) {
      return (
        <ThesisJourneyShell
          activeStep="TITLE_DEFENSE"
          title="Title Defense"
          description="Track your Title Defense application and schedule status."
          journey={journey}
        >
          <TitleDefensePostSubmission
            defenseStatus={ds}
            session={titleStep?.defenseSession}
          />
        </ThesisJourneyShell>
      );
    }
    return (
      <ThesisJourneyShell
        activeStep="TITLE_DEFENSE"
        title="Title Defense"
        description="Track your Title Defense session and official records."
        journey={journey}
      >
        <DefenseStatusPanel
          kind="Title"
          step={titleStep}
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

  // CURRENT / AVAILABLE — but rejected applications must not start a duplicate.
  const rejectedHint = (titleStep?.detail || "").toLowerCase().includes("reject");
  if (rejectedHint) {
    return (
      <ThesisJourneyShell
        activeStep="TITLE_DEFENSE"
        title="Title Defense"
        description="Review feedback and resubmit your Title Defense application."
        journey={journey}
      >
        <RejectedApplicationCorrection stage="TITLE" reason={titleStep?.detail} />
      </ThesisJourneyShell>
    );
  }

  return (
    <ThesisJourneyShell
      activeStep="TITLE_DEFENSE"
      title="Title Defense Application"
      description="Upload your Title Defense Proposal Package and the required documents. No adviser is required for Title Defense."
      journey={journey}
    >
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
            Your Title Defense application was submitted and is now under
            Graduate School review.
          </AlertDescription>
        </Alert>
      )}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit || submitTitle.isPending) return;
          setConfirmOpen(true);
        }}
      >
        <div className="space-y-4">
          <h2 className="text-base font-bold text-[#333333]">
            Required Documents
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {DOCUMENTS.map((config) => (
              <div
                key={config.key}
                className={config.key === "package" ? "lg:col-span-3" : "lg:col-span-1"}
              >
                <DocumentUploadSlot
                  label={config.label}
                  helper={config.helper}
                  accept={config.accept}
                  formatNote={config.formatNote}
                  guidance={config.guidance}
                  file={files[config.key]}
                  disabled={submitTitle.isPending || submitSuccess}
                  onTriggerPick={() => inputRefs.current[config.key]?.click()}
                  registerInput={(el) => {
                    inputRefs.current[config.key] = el;
                  }}
                  onPick={(f) => setSlot(config.key, f)}
                  onRemove={() => setSlot(config.key, null)}
                  onView={() => openPreview(files[config.key])}
                />
              </div>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit || submitTitle.isPending}
          className="w-full sm:w-auto"
        >
          <Send className="mr-2 h-4 w-4" />
          Submit Title Defense Application
        </Button>
      </form>

      <LocalFilePreviewDialog
        open={previewFile !== null}
        onOpenChange={handlePreviewOpenChange}
        objectUrl={previewUrl}
        file={previewFile}
        title="Document preview"
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Title Defense Application</DialogTitle>
            <DialogDescription>
              Please verify that the documents below are the correct files before
              submitting your Title Defense application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1.5 font-semibold text-[#333333]">
                Documents
              </p>
              <ul className="space-y-2 text-gray-600">
                {DOCUMENTS.map((config) => {
                  const f = files[config.key];
                  return (
                    <li key={config.key} className="space-y-0.5">
                      <div className="flex flex-wrap gap-x-1">
                        <span className="font-semibold text-[#333333]">{config.label}:</span>
                        <span className="min-w-0 break-all">
                          {f ? `${f.name} · ${formatSize(f.size)}` : "—"}
                        </span>
                      </div>
                      {config.dialogNote && (
                        <p className="text-xs text-gray-500">
                          {config.dialogNote}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
              Review all selected documents before submitting. Once submitted,
              the application will be placed under Graduate School review.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitTitle.isPending}
            >
              Go Back
            </Button>
            <Button
              type="button"
              onClick={() => submitTitle.mutate()}
              disabled={submitTitle.isPending}
            >
              {submitTitle.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading documents and submitting…
                </>
              ) : (
                "Confirm & Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ThesisJourneyShell>
  );
}
