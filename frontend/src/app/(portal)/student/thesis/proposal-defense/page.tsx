"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lock,
  Send,
  Upload,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";

type MissingRequirement = {
  code: string;
  message: string;
  stage: string;
};

export default function ProposalDefensePage() {
  const queryClient = useQueryClient();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [corFile, setCorFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const { data: studentJourney } = useQuery({
    queryKey: ["studentJourney"],
    queryFn: async () => (await apiClientRequest("/student/journey")) || null,
  });

  const activeThesis = studentJourney?.thesisRecords?.[0];
  const isTitlePassed =
    !!activeThesis &&
    ((activeThesis.stage === "TITLE" && activeThesis.outcome === "PASSED") ||
      (activeThesis.stage === "TITLE" &&
        activeThesis.status === "PASSED" &&
        activeThesis.outcome == null) ||
      activeThesis.stage === "PROPOSAL" ||
      activeThesis.stage === "FINAL");

  const applicationState =
    activeThesis?.stage === "PROPOSAL" && activeThesis?.status === "PENDING"
      ? "submitted"
      : "form";

  // Server eligibility (same rules as apply gate) — no mock "verified" flags.
  const { data: eligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["thesisEligibility", "PROPOSAL_DEFENSE"],
    queryFn: async () =>
      (await apiClientRequest("/thesis/eligibility/PROPOSAL_DEFENSE")) as {
        eligible: boolean;
        missing: MissingRequirement[];
        researchVariables: string;
        adviserCerts: { proposal: boolean; final: boolean };
        titleRapSigned: boolean;
      },
    enabled: isTitlePassed,
  });

  const systemGaps = useMemo(
    () =>
      (eligibility?.missing ?? []).filter(
        (m) =>
          !["PROPOSAL_CHAPTERS", "COR", "RECEIPT"].includes(m.code),
      ),
    [eligibility],
  );

  const canSubmit =
    !!documentFile && !!corFile && !!receiptFile && isTitlePassed;

  const submitMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiClientRequest("/thesis/defense/proposal", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      alert("Proposal Defense application submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["studentJourney"] });
      queryClient.invalidateQueries({ queryKey: ["thesisEligibility"] });
    },
    onError: (error: Error & { missing?: MissingRequirement[] }) => {
      const detail = error.missing?.map((m) => m.message).join("\n");
      alert("Failed to submit: " + error.message + (detail ? `\n${detail}` : ""));
    },
  });

  const handleSubmit = () => {
    if (!canSubmit || !documentFile || !corFile || !receiptFile) return;
    const formData = new FormData();
    formData.append("document", documentFile);
    formData.append("cor", corFile);
    formData.append("receipt", receiptFile);
    submitMutation.mutate(formData);
  };

  const FileRow = ({
    label,
    file,
    onPick,
    onClear,
  }: {
    label: string;
    file: File | null;
    onPick: (f: File) => void;
    onClear: () => void;
  }) => (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <FileText className="h-4 w-4 text-(--earist-secondary)" />
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">
            {file ? file.name : "Stage-scoped upload — prior-stage files do not count"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {file ? (
          <>
            <Badge className="bg-amber-100 text-amber-700">Uploaded</Badge>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
            <span className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">
              <Upload className="mr-1 h-3 w-3" /> Upload
            </span>
          </label>
        )}
      </div>
    </div>
  );

  if (!studentJourney) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!isTitlePassed) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <Card className="border-red-200 shadow-sm">
          <CardHeader className="border-b border-red-100 bg-red-50/50">
            <CardTitle className="text-red-700">Locked</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto mb-2 h-8 w-8 text-red-400" />
            <p className="text-gray-700">
              Title Defense must be formally PASSED (selected title + finalized
              Title RAP) before Proposal application. Application approval alone
              is not enough.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Proposal Defense Application
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Stage-scoped uploads for Proposal Defense (Cashier payment happens
          outside GS-IS — upload proof only).
        </p>
      </div>

      {systemGaps.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              System requirements not met
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
              {systemGaps.map((m) => (
                <li key={m.code}>{m.message}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              Research Variables:{" "}
              {eligibility?.researchVariables === "NOT_APPLICABLE"
                ? "Not applicable (accepted)"
                : eligibility?.researchVariables === "APPROVED"
                  ? "Approved"
                  : "Pending — approve or mark NOT_APPLICABLE"}
            </p>
          </CardContent>
        </Card>
      )}

      {applicationState === "submitted" ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
            <p className="font-medium">Submitted for review</p>
            <p className="text-sm text-gray-500">
              Admin review may approve, reject, or return for compliance. This
              is not a defense result.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Required uploads (Proposal stage)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileRow
              label="Manuscript Chapters 1–3"
              file={documentFile}
              onPick={setDocumentFile}
              onClear={() => setDocumentFile(null)}
            />
            <FileRow
              label="Certificate of Registration (COR) — this application"
              file={corFile}
              onPick={setCorFile}
              onClear={() => setCorFile(null)}
            />
            <FileRow
              label="Defense-fee proof of payment (Cashier) — this application"
              file={receiptFile}
              onPick={setReceiptFile}
              onClear={() => setReceiptFile(null)}
            />
            <Button
              className="mt-4 w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90"
              disabled={!canSubmit || submitMutation.isPending || eligibilityLoading}
              onClick={handleSubmit}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit Proposal Defense Application
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
