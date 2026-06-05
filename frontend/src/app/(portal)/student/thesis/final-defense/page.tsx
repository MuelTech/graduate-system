"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  Clock,
  Upload,
  FileText,
  X,
  Send,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Calendar,
  Database,
} from "lucide-react";

export default function FinalDefensePage() {
  const applicationState = "form" as
    | "form"
    | "submitted"
    | "strike_check"
    | "post_defense"
    | "corrections"
    | "databank";

  const [requirements, setRequirements] = useState([
    {
      name: "Certificate of Registration (COR) — Current Semester",
      status: "uploaded" as "pending" | "uploaded" | "verified",
      file: null as File | null,
    },
    {
      name: "Application for Defense (with proof of payment)",
      status: "pending" as "pending" | "uploaded" | "verified",
      file: null as File | null,
    },
    {
      name: "Adviser / Thesis Adviser Certification",
      status: "pending" as "pending" | "uploaded" | "verified",
      file: null as File | null,
    },
    {
      name: "Rapporteur's Report (RAP from Proposal Defense)",
      status: "verified" as "pending" | "uploaded" | "verified",
      file: null as File | null,
    },
    {
      name: "Manuscript — Chapters 1–5 (PDF)",
      status: "pending" as "pending" | "uploaded" | "verified",
      file: null as File | null,
    },
  ]);

  const strikeResult = {
    status: "passed" as "passed" | "failed" | "not_submitted",
    similarity: 12,
    threshold: 20,
    date: "June 1, 2026",
  };

  const hardCopyDeadline = {
    dueDate: "June 6, 2026",
    daysRemaining: 2,
  };

  const [grammarianFile, setGrammarianFile] = useState<File | null>(null);
  const [correctedManuscript, setCorrectedManuscript] = useState<File | null>(
    null
  );

  const allRequirementsMet = requirements.every(
    (r) => r.status === "verified" || r.status === "uploaded"
  );
  const canSubmit = allRequirementsMet;

  const handleRequirementUpload = (index: number, file: File) => {
    setRequirements((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, file, status: "uploaded" as const } : r
      )
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-gray-100 text-gray-500">
            <Clock className="mr-1 h-3 w-3" />
            Not Uploaded
          </Badge>
        );
      case "uploaded":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Upload className="mr-1 h-3 w-3" />
            Uploaded
          </Badge>
        );
      case "verified":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Final Defense Application
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Submit your Final Defense requirements and complete your thesis journey
        </p>
      </div>

      {/* Requirements Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Requirements Checklist
            </CardTitle>
            <Badge
              className={
                allRequirementsMet
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }
            >
              {requirements.filter((r) => r.status !== "pending").length} /{" "}
              {requirements.length} complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {requirements.map((req, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-[var(--earist-border-gray)] p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    {req.name}
                  </p>
                  {req.file && (
                    <p className="mt-0.5 text-xs text-[var(--earist-body-text)] truncate">
                      {req.file.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(req.status)}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleRequirementUpload(i, file);
                      }}
                      className="hidden"
                    />
                    <div className="rounded-lg border border-[var(--earist-border-gray)] px-3 py-1.5 text-xs font-medium text-[var(--earist-body-text)] transition-colors hover:bg-[var(--earist-surface-gray)]">
                      <Upload className="mr-1 inline h-3 w-3" />
                      Upload
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plagiarism Check Card (STRIKE) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              STRIKE Plagiarism Check
            </CardTitle>
            <Link
              href="/student/plagiarism"
              className="text-xs font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
            >
              View Full Report <ExternalLink className="ml-1 inline h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {strikeResult.status === "not_submitted" ? (
            <div className="flex items-center gap-3 rounded-lg bg-[var(--earist-surface-gray)] p-4">
              <ShieldCheck className="h-8 w-8 text-[var(--earist-body-text)]/40" />
              <div>
                <p className="text-sm font-medium text-[var(--earist-primary)]">
                  No STRIKE report yet
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  Upload your manuscript to the STRIKE system for plagiarism
                  checking.
                </p>
              </div>
              <Link
                href="/student/plagiarism"
                className="ml-auto shrink-0 rounded-lg bg-[var(--earist-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--earist-primary)]/90"
              >
                Run Check
              </Link>
            </div>
          ) : (
            <div
              className={`rounded-lg border p-4 ${
                strikeResult.status === "passed"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {strikeResult.status === "passed" ? (
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[var(--earist-primary)]">
                      Similarity: {strikeResult.similarity}%
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      Threshold: below {strikeResult.threshold}% &middot;{" "}
                      {strikeResult.date}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    strikeResult.status === "passed"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  {strikeResult.status === "passed" ? "PASSED" : "FAILED"}
                </Badge>
              </div>
              {strikeResult.status === "passed" && (
                <p className="mt-2 text-xs text-green-700">
                  Your manuscript is below the similarity threshold. You may
                  proceed to print 8 hard copies and submit to the GS Office
                  within 3 working days.
                </p>
              )}
              {strikeResult.status === "failed" && (
                <p className="mt-2 text-xs text-red-700">
                  Your manuscript exceeds the 20% threshold. Please revise and
                  re-upload.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hard Copy Deadline */}
      {strikeResult.status === "passed" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Hard Copy Submission Deadline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    Due: {hardCopyDeadline.dueDate}
                  </p>
                  <p className="text-xs text-amber-700">
                    {hardCopyDeadline.daysRemaining} working day(s) remaining
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Request Extension
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      {applicationState === "form" && (
        <Card>
          <CardContent className="py-4">
            <Button
              disabled={!canSubmit}
              className={`w-full ${
                canSubmit
                  ? "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              <Send className="mr-2 h-4 w-4" />
              File Final Defense Application
            </Button>
            {!canSubmit && (
              <p className="mt-2 text-center text-xs text-[var(--earist-body-text)]">
                Complete all requirements and upload the manuscript to submit.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Post-Defense Corrections */}
      {applicationState === "corrections" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Post-Defense Corrections
              </CardTitle>
              <Badge className="bg-amber-100 text-amber-700">
                <Clock className="mr-1 h-3 w-3" />
                Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Grammarian Certification */}
              <div className="rounded-lg border border-[var(--earist-border-gray)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    Grammarian Certification
                  </p>
                  {grammarianFile && (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Uploaded
                    </Badge>
                  )}
                </div>
                {!grammarianFile ? (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--earist-border-gray)] px-3 py-4 transition-colors hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]">
                    <Upload className="h-4 w-4 text-[var(--earist-body-text)]/40" />
                    <span className="text-xs text-[var(--earist-body-text)]">
                      Upload Grammarian Certification (PDF)
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setGrammarianFile(file);
                      }}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--earist-border-gray)] px-3 py-2">
                    <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                    <span className="flex-1 truncate text-xs text-[var(--earist-body-text)]">
                      {grammarianFile.name}
                    </span>
                    <button
                      onClick={() => setGrammarianFile(null)}
                      className="rounded p-0.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Corrected Final Manuscript */}
              <div className="rounded-lg border border-[var(--earist-border-gray)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    Corrected Final Manuscript
                  </p>
                  {correctedManuscript && (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Uploaded
                    </Badge>
                  )}
                </div>
                {!correctedManuscript ? (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--earist-border-gray)] px-3 py-4 transition-colors hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]">
                    <Upload className="h-4 w-4 text-[var(--earist-body-text)]/40" />
                    <span className="text-xs text-[var(--earist-body-text)]">
                      Upload Corrected Manuscript (PDF)
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setCorrectedManuscript(file);
                      }}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--earist-border-gray)] px-3 py-2">
                    <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                    <span className="flex-1 truncate text-xs text-[var(--earist-body-text)]">
                      {correctedManuscript.name}
                    </span>
                    <button
                      onClick={() => setCorrectedManuscript(null)}
                      className="rounded p-0.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <Button
                disabled={!grammarianFile || !correctedManuscript}
                className={`w-full ${
                  grammarianFile && correctedManuscript
                    ? "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit Corrections
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload to Databank */}
      {applicationState === "databank" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Upload to Research Databank
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-700">
                <Database className="mr-1 h-3 w-3" />
                Final Step
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-[var(--earist-body-text)]">
              Upload your approved final manuscript to the Research Databank for
              publication in the Repository.
            </p>
            <Button className="w-full bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90">
              <Database className="mr-2 h-4 w-4" />
              Upload to Databank
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
