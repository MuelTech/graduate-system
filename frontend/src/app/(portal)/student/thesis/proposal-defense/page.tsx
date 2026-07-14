"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Copy,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";

export default function ProposalDefensePage() {
  const queryClient = useQueryClient();

  //Fetch student journey to get thesis status
  const { data: studentJourney } = useQuery({
    queryKey: ["studentJourney"],
    queryFn: async () => {
      const res = await apiClientRequest("/student/journey");
      return res || null;
    },
  });

  const activeThesis = studentJourney?.thesisRecords?.[0];
  const applicationState =
    (activeThesis?.stage === "PROPOSAL" && activeThesis?.status === "PENDING"
      ? "submitted"
      : "form") as "form" | "submitted" | "post_defense";

  const isTitlePassed =
    activeThesis &&
    ((activeThesis.stage === "TITLE" && (activeThesis.status === "PASSED" || activeThesis.status === "APPROVED")) ||
      activeThesis.stage === "PROPOSAL" ||
      activeThesis.stage === "FINAL");

  const [requirements, setRequirements] = useState([
    {
      name: "Certificate of Registration (COR) — Current Semester",
      status: "pending" as "pending" | "uploaded" | "verified",
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
    Array(7).fill(null),
  );

  const postDefenseInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const submitMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiClientRequest("/thesis/defense/proposal", {
        method: "POST",
        body: formData, // FormData automatically sets multipart/form-data
      });
    },
    onSuccess: () => {
      alert("Proposal Defense application submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["studentJourney"] });
    },
    onError: (error: Error) => {
      alert("Failed to submit: " + error.message);
    },
  });

  // Only require COR (index 0) and Manuscript to be uploaded for now
  const allRequirementsMet = requirements.every(
    (r) => r.status === "verified" || r.status === "uploaded"
  );
  const corUploaded =
    requirements[0].status === "uploaded" ||
    requirements[0].status === "verified";
  const canSubmit = corUploaded && manuscript !== null;

  const handleSubmit = () => {
    if (!canSubmit || !requirements[0].file || !manuscript) return;

    const formData = new FormData();
    formData.append("cor", requirements[0].file);
    formData.append("document", manuscript);

    submitMutation.mutate(formData);
  };

  const handleRequirementUpload = (index: number, file: File) => {
    setRequirements((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, file, status: "uploaded" as const } : r,
      ),
    );
  };

  const handlePostDefenseUpload = (index: number, file: File) => {
    setPostDefenseCopies((prev) =>
      prev.map((f, i) => (i === index ? file : f)),
    );
  };

  const removePostDefenseCopy = (index: number) => {
    setPostDefenseCopies((prev) =>
      prev.map((f, i) => (i === index ? null : f)),
    );
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

  if (!studentJourney) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!isTitlePassed) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <Card className="border-red-200 shadow-sm">
          <CardHeader className="border-b border-red-100 bg-red-50/50">
            <CardTitle className="text-red-700">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-center">
            <h3 className="mb-2 text-lg font-bold text-gray-900">
              Requirements Not Met
            </h3>
            <p className="text-gray-600">
              You must pass your Title Defense before you can apply for your Proposal Defense.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Proposal Defense Application
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Submit your Proposal Defense requirements and upload Chapters 1–3
        </p>
      </div>

      {/* Requirements Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
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
                className="flex items-center gap-3 rounded-lg border border-(--earist-border-gray) p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--earist-primary)">
                    {req.name}
                  </p>
                  {req.file && (
                    <p className="mt-0.5 truncate text-xs text-(--earist-body-text)">
                      {req.file.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(req.status)}
                  {req.status === "pending" ? (
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
                      <div className="rounded-lg border border-(--earist-border-gray) px-3 py-1.5 text-xs font-medium text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-gray)">
                        <Upload className="mr-1 inline h-3 w-3" />
                        Upload
                      </div>
                    </label>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  )}
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
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
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
          <p className="mb-3 text-xs text-(--earist-body-text)">
            Upload your combined manuscript containing Chapters 1, 2, and 3 (PDF
            format).
          </p>
          {!manuscript ? (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--earist-border-gray) p-8 transition-colors hover:border-(--earist-primary) hover:bg-(--earist-surface-gray)">
              <Upload className="mb-3 h-10 w-10 text-(--earist-body-text)/40" />
              <p className="mb-1 text-sm font-medium text-(--earist-primary)">
                Upload Manuscript
              </p>
              <p className="text-xs text-(--earist-body-text)">
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
            <div className="flex items-center gap-3 rounded-lg border border-(--earist-border-gray) p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-(--earist-surface-gray)">
                <FileText className="h-5 w-5 text-(--earist-primary)" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-(--earist-primary)">
                  {manuscript.name}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {(manuscript.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => setManuscript(null)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
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
              disabled={!canSubmit || submitMutation.isPending}
              onClick={handleSubmit}
              className={`w-full ${
                canSubmit
                  ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              <Send className="mr-2 h-4 w-4" />
              {submitMutation.isPending
                ? "Submitting..."
                : "File Proposal Defense Application"}
            </Button>

            {!canSubmit && (
              <p className="mt-2 text-center text-xs text-(--earist-body-text)">
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
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
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
                  className="flex items-center gap-3 rounded-lg border border-(--earist-border-gray) p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-(--earist-surface-gray)">
                    <span className="text-xs font-bold text-(--earist-primary)">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {file ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-(--earist-primary)" />
                        <span className="truncate text-xs text-(--earist-body-text)">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-(--earist-body-text)">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-(--earist-body-text)">
                        Copy {i + 1} — Chapters 1–3
                      </span>
                    )}
                  </div>
                  {file ? (
                    <button
                      onClick={() => removePostDefenseCopy(i)}
                      className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
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
                      <div className="rounded-lg border border-(--earist-border-gray) px-3 py-1.5 text-xs font-medium text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-gray)">
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
                    ? "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
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
