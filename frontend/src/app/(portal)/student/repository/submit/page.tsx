"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  AlertTriangle,
  Database,
  ArrowLeft,
  ShieldCheck,
  Upload,
  FileText,
  FileSpreadsheet,
  Trash2,
  Lock,
  Download,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

type EligibilityReason =
  | "FINAL_DEFENSE_NOT_PASSED"
  | "FINAL_RAP_NOT_FINALIZED"
  | "OFFICIAL_TITLE_MISSING"
  | "RESEARCH_CONTEXT_MISSING"
  | "RESEARCH_CONTEXT_AMBIGUOUS"
  | string;

interface DatabankArchiveContext {
  eligible: boolean;
  reasons: EligibilityReason[];
  researchContext: {
    thesisId: string;
    officialTitle: string;
    finalDefenseConcludedAt: string | null;
    finalRapFinalizedAt: string | null;
  } | null;
  archive: {
    id: string;
    officialTitle: string;
    abstract: string | null;
    keywords: string | null;
    registeredAt: string;
    hasManuscript?: boolean;
    hasRespondentData?: boolean;
  } | null;
  artifactPolicy: { archivalArtifactLinked: boolean; policyResolved: boolean };
}

const REASON_MESSAGES: Record<string, string> = {
  FINAL_DEFENSE_NOT_PASSED:
    "Final Defense is not yet formally PASSED and concluded.",
  FINAL_RAP_NOT_FINALIZED:
    "The Final Defense RAP is not yet FINALIZED (all signatures complete).",
  OFFICIAL_TITLE_MISSING:
    "The official research title is not yet recorded from the Title Defense.",
  RESEARCH_CONTEXT_MISSING:
    "No completed Final Defense research context was found for your account.",
  RESEARCH_CONTEXT_AMBIGUOUS:
    "More than one completed research context was found. Please contact the Graduate School to reconcile your records.",
};

function reasonMessage(reason: string): string {
  return REASON_MESSAGES[reason] ?? "The requirement is not yet satisfied.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadSlotProps {
  id: string;
  title: string;
  description: string;
  accept: string;
  acceptLabel: string;
  file: File | null;
  onFileSelect: (f: File | null) => void;
  required?: boolean;
  isPrivate?: boolean;
}

function UploadSlot({
  id,
  title,
  description,
  accept,
  acceptLabel,
  file,
  onFileSelect,
  required = true,
  isPrivate = false,
}: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border border-(--earist-border-gray) p-4 space-y-2 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label htmlFor={id} className="text-sm font-semibold text-(--earist-primary) flex items-center gap-1.5">
            {title}
            {required && <span className="text-red-500 font-bold">*</span>}
            {isPrivate && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-300 gap-1 ml-1">
                <Lock className="h-3 w-3" /> Data Privacy Restricted
              </Badge>
            )}
          </Label>
          <p className="text-xs text-(--earist-body-text) mt-0.5">{description}</p>
        </div>
        <span className="text-[11px] font-mono text-(--earist-body-text)/70 uppercase">{acceptLabel}</span>
      </div>

      {!file ? (
        <label
          htmlFor={id}
          className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-(--earist-border-gray) p-4 hover:border-(--earist-primary) transition-colors bg-(--earist-surface-gray)/40"
        >
          <Upload className="mb-1 h-5 w-5 text-(--earist-body-text)/40" />
          <p className="text-xs font-medium text-(--earist-primary)">Click to browse or drag file here</p>
          <p className="text-[11px] text-(--earist-body-text)">Max file size: 50 MB</p>
          <input
            id={id}
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              onFileSelect(selected);
            }}
          />
        </label>
      ) : (
        <div className="flex items-center justify-between rounded border border-green-200 bg-green-50/50 p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-(--earist-primary)">{file.name}</p>
              <p className="text-[10px] text-(--earist-body-text)">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              onFileSelect(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DatabankSubmitPage() {
  const queryClient = useQueryClient();
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");

  // 4 Archival Upload Elements
  const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
  const [certificationsFile, setCertificationsFile] = useState<File | null>(null);
  const [instrumentsFile, setInstrumentsFile] = useState<File | null>(null);
  const [respondentDataFile, setRespondentDataFile] = useState<File | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["databank-archive-context"],
    queryFn: async () =>
      (await apiClientRequest("/databank/archive/me")) as DatabankArchiveContext,
  });

  const wordCount = abstract.trim() ? abstract.trim().split(/\s+/).length : 0;
  const keywordList = keywords
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const isFormValid =
    wordCount >= 150 &&
    keywordList.length >= 3 &&
    Boolean(manuscriptFile) &&
    Boolean(certificationsFile) &&
    Boolean(instrumentsFile) &&
    Boolean(respondentDataFile);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("abstract", abstract.trim());
      formData.append("keywords", keywords.trim());

      if (manuscriptFile) formData.append("manuscript", manuscriptFile);
      if (certificationsFile) formData.append("certifications", certificationsFile);
      if (instrumentsFile) formData.append("instruments", instrumentsFile);
      if (respondentDataFile) formData.append("respondentData", respondentDataFile);

      return apiClientRequest("/databank/archive", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      setAbstract("");
      setKeywords("");
      setManuscriptFile(null);
      setCertificationsFile(null);
      setInstrumentsFile(null);
      setRespondentDataFile(null);
      queryClient.invalidateQueries({ queryKey: ["databank-archive-context"] });
    },
    onError: (error: Error) => {
      alert(error.message || "Databank registration could not be completed.");
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/student/repository"
          className="mb-2 inline-flex items-center text-xs text-(--earist-secondary) hover:underline"
        >
          <ArrowLeft className="mr-1 h-3 w-3" /> Back to Research Repository
        </Link>
        <h2
          className="text-3xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Research Databank Archive
        </h2>
        <p className="mt-2 text-sm text-(--earist-body-text)">
          Submit your post-defense revised research package to the controlled Graduate School Databank (DL-9).
          All archival records are private by default and subject to administrator curation.
        </p>
      </div>

      {isLoading && (
        <p className="py-8 text-center text-sm text-(--earist-body-text)">
          Loading your Databank archive status…
        </p>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            Unable to load your Databank archive status. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Ineligibility Banner */}
      {data && !data.eligible && (
        <Card className="border-t-4 border-t-amber-400 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Not yet eligible for Databank registration
            </CardTitle>
            <CardDescription>
              Your research must first conclude the Final Defense and finalize the defense report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-(--earist-body-text)">Required completed research gates:</p>
            <ul className="space-y-1">
              <li className="flex items-start gap-2">
                <Badge variant="outline">Final Defense — PASSED</Badge>
                <span className="text-xs text-(--earist-body-text)">
                  {data.reasons.includes("FINAL_DEFENSE_NOT_PASSED")
                    ? "Not yet recorded."
                    : "Recorded."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline">Final RAP — FINALIZED</Badge>
                <span className="text-xs text-(--earist-body-text)">
                  {data.reasons.includes("FINAL_RAP_NOT_FINALIZED")
                    ? "Not yet finalized (pending panelist/adviser signatures)."
                    : "Finalized."}
                </span>
              </li>
            </ul>
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700">
              {data.reasons.map((reason) => (
                <li key={reason}>{reasonMessage(reason)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Active Submission Form */}
      {data && data.eligible && !data.archive && (
        <>
          <Card className="border-t-4 border-t-(--earist-primary) shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
                <ShieldCheck className="h-5 w-5" />
                Completed Research Context
              </CardTitle>
              <CardDescription>
                Authoritative research parameters confirmed from institutional defense records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-(--earist-secondary)">Official Research Title</p>
                <p className="break-words font-medium text-base text-(--earist-primary)">
                  {data.researchContext?.officialTitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Final Defense — Passed
                </Badge>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Final RAP — Finalized
                </Badge>
              </div>
              <p className="text-xs text-(--earist-body-text)">
                Final Defense concluded {formatDate(data.researchContext?.finalDefenseConcludedAt ?? null)} ·
                Final RAP finalized {formatDate(data.researchContext?.finalRapFinalizedAt ?? null)}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
                <Database className="h-5 w-5" />
                Archival Submission Form
              </CardTitle>
              <CardDescription>
                Provide the comprehensive archival payload incorporating all panel-required post-defense revisions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Metadata Inputs */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="abstract" className="text-sm font-semibold text-(--earist-primary)">
                    Abstract <span className="text-red-500">*</span>
                  </Label>
                  <span
                    className={`text-xs ${
                      wordCount >= 150 ? "text-green-600 font-medium" : "text-(--earist-body-text)"
                    }`}
                  >
                    {wordCount} / 150 words minimum
                  </span>
                </div>
                <Textarea
                  id="abstract"
                  placeholder="Paste your comprehensive research abstract here (minimum 150 words)..."
                  className="min-h-36 focus-visible:ring-(--earist-primary)"
                  value={abstract}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAbstract(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="keywords" className="text-sm font-semibold text-(--earist-primary)">
                    Keywords (comma-separated) <span className="text-red-500">*</span>
                  </Label>
                  <span
                    className={`text-xs ${
                      keywordList.length >= 3 ? "text-green-600 font-medium" : "text-(--earist-body-text)"
                    }`}
                  >
                    {keywordList.length} / 3 keywords minimum
                  </span>
                </div>
                <Input
                  id="keywords"
                  placeholder="e.g. Artificial Intelligence, Natural Language Processing, Higher Education"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>

              {/* 4 Required File Upload Slots */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-(--earist-secondary) flex items-center gap-1.5">
                  <Upload className="h-4 w-4" /> Required Archival Artifacts (Chapters 1–5 & Data)
                </h4>

                <UploadSlot
                  id="manuscript"
                  title="1. Approved Final Manuscript (Chapters 1–5)"
                  description="Upload the complete revised final manuscript incorporating all panel recommendations."
                  accept=".pdf"
                  acceptLabel="PDF"
                  file={manuscriptFile}
                  onFileSelect={setManuscriptFile}
                  required
                />

                <UploadSlot
                  id="certifications"
                  title="2. Research Certifications"
                  description="Upload certified Grammarian Certification and adviser endorsement clearance."
                  accept=".pdf"
                  acceptLabel="PDF"
                  file={certificationsFile}
                  onFileSelect={setCertificationsFile}
                  required
                />

                <UploadSlot
                  id="instruments"
                  title="3. Research Instruments"
                  description="Upload research questionnaires, survey tools, interview schedules, or protocols."
                  accept=".pdf,.doc,.docx"
                  acceptLabel="PDF / DOCX"
                  file={instrumentsFile}
                  onFileSelect={setInstrumentsFile}
                  required
                />

                <UploadSlot
                  id="respondentData"
                  title="4. Respondent Data & Datasets"
                  description="Upload survey questionnaires, participant forms, or raw datasets. Kept confidential under the Data Privacy Act."
                  accept=".pdf,.zip,.xlsx,.csv"
                  acceptLabel="PDF / ZIP / XLSX / CSV"
                  file={respondentDataFile}
                  onFileSelect={setRespondentDataFile}
                  required
                  isPrivate
                />
              </div>

              {/* Data Privacy & Compliance Notice */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-700" />
                  Data Privacy Act Compliance (NFR11)
                </div>
                <p>
                  Raw respondent data and questionnaires are strictly restricted to the Graduate School
                  Administrator and the original researcher. They will never be accessible publicly or to other students.
                </p>
              </div>

              {/* Submission Button & Validation Notice */}
              {!isFormValid && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-700">Please complete all required fields:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {wordCount < 150 && <li>Abstract must contain at least 150 words (current: {wordCount})</li>}
                    {keywordList.length < 3 && (
                      <li>Enter at least 3 comma-separated keywords (current: {keywordList.length})</li>
                    )}
                    {!manuscriptFile && <li>Attach Approved Final Manuscript (.pdf)</li>}
                    {!certificationsFile && <li>Attach Research Certifications (.pdf)</li>}
                    {!instrumentsFile && <li>Attach Research Instruments (.pdf / .docx)</li>}
                    {!respondentDataFile && <li>Attach Respondent Data (.pdf / .zip / .xlsx / .csv)</li>}
                  </ul>
                </div>
              )}

              <Button
                disabled={!isFormValid || registerMutation.isPending}
                onClick={() => registerMutation.mutate()}
                className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90 py-5 text-sm font-semibold"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {registerMutation.isPending
                  ? "Uploading Archival Package..."
                  : "Submit to Research Databank"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Post-Submission Active Archive View */}
      {data && data.eligible && data.archive && (
        <Card className="border-t-4 border-t-green-500 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg text-(--earist-secondary)">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Databank Archive Submitted
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                Private Databank (DL-9)
              </Badge>
            </div>
            <CardDescription>
              Your research is securely registered in the Graduate School Databank.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-(--earist-secondary)">Official Research Title</p>
              <p className="break-words font-medium text-base text-(--earist-primary)">
                {data.archive.officialTitle}
              </p>
            </div>

            <p className="text-xs text-(--earist-body-text)">
              Registered at: {formatDate(data.archive.registeredAt)}
            </p>

            {data.archive.abstract && (
              <div>
                <p className="text-xs font-semibold text-(--earist-secondary)">Abstract</p>
                <p className="break-words text-xs text-(--earist-body-text) leading-relaxed mt-1 bg-(--earist-surface-gray)/40 p-3 rounded border">
                  {data.archive.abstract}
                </p>
              </div>
            )}

            {data.archive.keywords && (
              <div>
                <p className="text-xs font-semibold text-(--earist-secondary)">Keywords</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {data.archive.keywords.split(",").map((kw, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {kw.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Document Download Section for the author */}
            <div className="pt-2 border-t space-y-2">
              <p className="text-xs font-semibold text-(--earist-secondary)">Your Archival Files</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/documents/elibrary-manuscript/${data.archive.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Download Final Manuscript
                  </Button>
                </a>
                <a
                  href={`/api/documents/elibrary-respondent-data/${data.archive.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Download Respondent Dataset
                  </Button>
                </a>
              </div>
            </div>

            <div className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text) space-y-1">
              <p className="font-semibold text-(--earist-secondary)">Next Step: Institutional Publication Review</p>
              <p>
                The Graduate School Administrator will review your submitted archival manuscript and metadata.
                Once approved, the publication projection will become discoverable in the public Research Repository.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
