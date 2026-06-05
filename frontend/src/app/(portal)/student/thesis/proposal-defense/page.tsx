"use client";

import { useState, useRef } from "react";
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
  Lock,
  Image,
  Copy,
} from "lucide-react";

export default function ProposalDefensePage() {
  const applicationState = "form" as "form" | "submitted" | "post_defense";

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
      name: "Approved RAP Report from Title Defense",
      status: "verified" as "pending" | "uploaded" | "verified",
      file: null as File | null,
    },
    {
      name: "Approved Research Variables (signed by Panelists)",
      status: "verified" as "pending" | "uploaded" | "verified",
      file: null as File | null,
    },
  ]);

  const [manuscript, setManuscript] = useState<File | null>(null);

  const [postDefenseCopies, setPostDefenseCopies] = useState<(File | null)[]>(
    Array(7).fill(null)
  );

  const postDefenseInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const allRequirementsMet = requirements.every(
    (r) => r.status === "verified" || r.status === "uploaded"
  );
  const canSubmit = allRequirementsMet && manuscript !== null;

  const handleRequirementUpload = (index: number, file: File) => {
    setRequirements((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, file, status: "uploaded" as const } : r
      )
    );
  };

  const handlePostDefenseUpload = (index: number, file: File) => {
    setPostDefenseCopies((prev) => prev.map((f, i) => (i === index ? file : f)));
  };

  const removePostDefenseCopy = (index: number) => {
    setPostDefenseCopies((prev) => prev.map((f, i) => (i === index ? null : f)));
    if (postDefenseInputRefs.current[index])
      postDefenseInputRefs.current[index]!.value = "";
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

  const FileUploadItem = ({
    file,
    onUpload,
    onRemove,
  }: {
    file: File | null;
    onUpload: (file: File) => void;
    onRemove: () => void;
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    if (!file) {
      return (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--earist-border-gray)] px-3 py-2 transition-colors hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]">
          <Upload className="h-4 w-4 text-[var(--earist-body-text)]/40" />
          <span className="text-xs text-[var(--earist-body-text)]">
            Upload PDF
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) onUpload(selected);
            }}
            className="hidden"
          />
        </label>
      );
    }

    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--earist-border-gray)] px-3 py-2">
        <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
        <span className="flex-1 truncate text-xs text-[var(--earist-body-text)]">
          {file.name}
        </span>
        <span className="text-[11px] text-[var(--earist-body-text)]">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </span>
        <button
          onClick={onRemove}
          className="rounded p-0.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Proposal Defense Application
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Submit your Proposal Defense requirements and upload Chapters 1–3
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

      {/* Manuscript Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Manuscript (Chapters 1–3)
            </CardTitle>
            {manuscript ? (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Uploaded
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700">
                <Clock className="mr-1 h-3 w-3" />
                Required
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-[var(--earist-body-text)]">
            Upload your combined manuscript containing Chapters 1, 2, and 3 (PDF
            format).
          </p>
          {!manuscript ? (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--earist-border-gray)] p-8 transition-colors hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]">
              <Upload className="mb-3 h-10 w-10 text-[var(--earist-body-text)]/40" />
              <p className="mb-1 text-sm font-medium text-[var(--earist-primary)]">
                Upload Manuscript
              </p>
              <p className="text-xs text-[var(--earist-body-text)]">
                PDF format only
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setManuscript(file);
                }}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--earist-border-gray)] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--earist-surface-gray)]">
                <FileText className="h-5 w-5 text-[var(--earist-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--earist-primary)] truncate">
                  {manuscript.name}
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  {(manuscript.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => setManuscript(null)}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

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
              File Proposal Defense Application
            </Button>
            {!canSubmit && (
              <p className="mt-2 text-center text-xs text-[var(--earist-body-text)]">
                Complete all requirements and upload the manuscript to submit.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Post-Defense 7 Copies Upload */}
      {applicationState === "post_defense" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Post-Defense: 7 Digital Copies
              </CardTitle>
              <Badge className="bg-amber-100 text-amber-700">
                <Clock className="mr-1 h-3 w-3" />
                Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4 border-amber-200 bg-amber-50">
              <Copy className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                After your Proposal Defense, you must upload 7 digital copies of
                Chapters 1–3 to the system.
              </AlertDescription>
            </Alert>
            <div className="space-y-3">
              {postDefenseCopies.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-[var(--earist-border-gray)] p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--earist-surface-gray)]">
                    <span className="text-xs font-bold text-[var(--earist-primary)]">
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {file ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                        <span className="truncate text-xs text-[var(--earist-body-text)]">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-[var(--earist-body-text)]">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--earist-body-text)]">
                        Copy {i + 1} — Chapters 1–3
                      </span>
                    )}
                  </div>
                  {file ? (
                    <button
                      onClick={() => removePostDefenseCopy(i)}
                      className="rounded p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const selected = e.target.files?.[0];
                          if (selected) handlePostDefenseUpload(i, selected);
                        }}
                        className="hidden"
                      />
                      <div className="rounded-lg border border-[var(--earist-border-gray)] px-3 py-1.5 text-xs font-medium text-[var(--earist-body-text)] transition-colors hover:bg-[var(--earist-surface-gray)]">
                        <Upload className="mr-1 inline h-3 w-3" />
                        Upload
                      </div>
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button
                disabled={!postDefenseCopies.every((f) => f !== null)}
                className={`w-full ${
                  postDefenseCopies.every((f) => f !== null)
                    ? "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit 7 Copies
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
