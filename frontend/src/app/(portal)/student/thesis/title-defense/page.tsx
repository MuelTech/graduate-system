"use client";

import { useEffect, useRef, useState } from "react";
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
import { TitleDefenseUnderReview } from "@/components/student/title-defense-under-review";
import { LocalFilePreviewDialog } from "@/components/student/local-file-preview-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  Loader2,
} from "lucide-react";

const TITLE_FIELDS = [
  { key: "t1", label: "Proposed Title 1" },
  { key: "t2", label: "Proposed Title 2" },
  { key: "t3", label: "Proposed Title 3" },
] as const;

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Single Title Defense Proposal Package slot.
 * Before submission a locally selected file is never called "Uploaded".
 */
function PackageSlot({
  file,
  inputRef,
  disabled,
  onPick,
  onRemove,
  onView,
}: {
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
  onView: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          Title Defense Proposal Package
        </CardTitle>
        <p className="text-sm text-(--earist-body-text)">
          Upload one document containing the supporting proposal details for all
          three proposed research titles.
        </p>
        <p className="text-xs text-(--earist-body-text)">
          The three titles in this package should appear in the same order as the
          titles entered above.
        </p>
      </CardHeader>
      <CardContent>
        {!file ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--earist-border-gray) p-6 transition-colors hover:border-(--earist-primary) hover:bg-(--earist-surface-gray) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="mb-2 h-8 w-8 text-(--earist-body-text)/40" />
              <span className="text-center text-sm font-medium text-(--earist-primary)">
                Select proposal package
              </span>
              <span className="text-xs text-(--earist-body-text)">
                PDF only · No file selected
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              disabled={disabled}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-(--earist-surface-gray)">
                <FileText className="h-4 w-4 text-(--earist-primary)" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--earist-primary)">
                  {file.name}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {formatSize(file.size)}
                  {file.type ? ` · ${file.type}` : ""}
                </p>
              </div>
              <Badge className="bg-(--earist-surface-light-red) text-(--earist-primary)">
                Selected · Ready to upload
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onView}
                disabled={disabled}
              >
                <Eye className="mr-1 h-4 w-4" /> View
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
              >
                <Upload className="mr-1 h-4 w-4" /> Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={disabled}
                className="text-red-600 hover:bg-red-50"
              >
                <X className="mr-1 h-4 w-4" /> Remove
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                disabled={disabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                }}
                className="hidden"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * WP11 / UIUX-4B — Title Defense application.
 * Academic progression comes only from GET /thesis/journey.
 * Confirmed Title digital scope: three proposed titles + ONE Title Defense
 * Proposal Package (no COR / no defense-fee proof).
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
  const selectedTitle = journey?.selectedTitle ?? null;

  const [titles, setTitles] = useState({ t1: "", t2: "", t3: "" });
  const [pkg, setPkg] = useState<File | null>(null);
  const packageInputRef = useRef<HTMLInputElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Revoke any live local preview object URL on change and unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const allTitlesFilled = !!(
    titles.t1.trim() &&
    titles.t2.trim() &&
    titles.t3.trim()
  );
  const canSubmit = allTitlesFilled && pkg !== null && !submitSuccess;

  const submitTitle = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("title1", titles.t1.trim());
      formData.append("title2", titles.t2.trim());
      formData.append("title3", titles.t3.trim());
      formData.append("conceptPaper", pkg!);
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
          "Your proposal package was uploaded successfully and your application is now under Graduate School review.",
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

  const clearPackage = () => {
    setPkg(null);
    setPreviewUrl(null);
    if (packageInputRef.current) packageInputRef.current.value = "";
  };

  const openPreview = () => {
    if (!pkg) return;
    // Revoke any prior preview URL before creating a new one (no same-batch leak).
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(pkg));
    setPreviewOpen(true);
  };

  const handlePreviewOpenChange = (next: boolean) => {
    setPreviewOpen(next);
    if (!next) setPreviewUrl(null);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
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
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <PageHeader title="Title Defense" />
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-(--earist-secondary)" />
              <p className="font-semibold">Title Defense is locked</p>
            </div>
            <p className="text-sm text-(--earist-body-text)">
              {titleStep?.lockReason || "This step is currently unavailable."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "COMPLETED") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader
          title="Title Defense"
          description="Formal Title Defense is complete."
        />
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
        <DefenseScheduleSummary session={titleStep?.defenseSession} />
      </div>
    );
  }

  if (state === "WAITING") {
    // UIUX-4B: immediate post-submission receipt state.
    if (titleStep?.defenseStatus === "APPLICATION_UNDER_REVIEW") {
      return <TitleDefenseUnderReview />;
    }
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Title Defense" />
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
              Continue in Thesis Journey
            </Link>
          }
        />
      </div>
    );
  }

  // CURRENT / AVAILABLE — but rejected applications must not start a duplicate.
  const rejectedHint = (titleStep?.detail || "").toLowerCase().includes("reject");
  if (rejectedHint) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Title Defense" />
        <RejectedApplicationCorrection stage="TITLE" reason={titleStep?.detail} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <PageHeader
        title="Title Defense Application"
        description="Enter your three proposed research titles and upload one Title Defense Proposal Package. No adviser is required for Title Defense."
      />

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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Proposed Research Titles
            </CardTitle>
            <p className="text-sm text-(--earist-body-text)">
              Enter your three proposed research titles exactly as they appear in
              your Title Defense Proposal Package.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {TITLE_FIELDS.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`title-${field.key}`}
                    className="mb-1 block text-sm font-medium text-(--earist-secondary)"
                  >
                    {field.label} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={`title-${field.key}`}
                    type="text"
                    disabled={submitTitle.isPending || submitSuccess}
                    value={titles[field.key]}
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

        <PackageSlot
          file={pkg}
          inputRef={packageInputRef}
          disabled={submitTitle.isPending || submitSuccess}
          onPick={(f) => {
            setPkg(f);
            setPreviewUrl(null);
            setSubmitError(null);
          }}
          onRemove={clearPackage}
          onView={openPreview}
        />

        <Button
          type="submit"
          disabled={!canSubmit || submitTitle.isPending}
          className="w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90 sm:w-auto"
        >
          <Send className="mr-2 h-4 w-4" />
          Submit Title Defense Application
        </Button>
      </form>

      <LocalFilePreviewDialog
        open={previewOpen}
        onOpenChange={handlePreviewOpenChange}
        objectUrl={previewUrl}
        file={pkg}
        title="Title Defense Proposal Package"
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Title Defense Application</DialogTitle>
            <DialogDescription>
              Please verify that the three titles entered below match the titles
              in your uploaded proposal package.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 font-medium text-(--earist-secondary)">
                Proposed Titles
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-(--earist-body-text)">
                <li>{titles.t1.trim() || "—"}</li>
                <li>{titles.t2.trim() || "—"}</li>
                <li>{titles.t3.trim() || "—"}</li>
              </ol>
            </div>
            <div>
              <p className="mb-1 font-medium text-(--earist-secondary)">
                Proposal Package
              </p>
              <p className="text-(--earist-body-text)">
                {pkg?.name || "—"}
                {pkg ? ` · ${formatSize(pkg.size)}` : ""}
              </p>
            </div>
            <p className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
              Make sure the uploaded package contains the supporting details for
              all three titles above. Once submitted, the application will be
              placed under Graduate School review.
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
              className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
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
    </div>
  );
}
