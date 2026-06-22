"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, X, Send, AlertCircle, CheckCircle2, Lock } from "lucide-react";

export default function TitleDefensePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const customSession = session as { user?: { accessToken?: string } } | null;

  const { data: journeyData, isLoading: isJourneyLoading } = useQuery({
    queryKey: ["studentJourney", customSession?.user?.accessToken],
    queryFn: async () => {
      const res = await fetch("http://localhost:5000/api/student/journey", {
        headers: {
          Authorization: `Bearer ${customSession?.user?.accessToken}`,
        },
      });
      if (!res.ok) throw new Error("Failed to load journey");
      return res.json();
    },
    enabled: !!session,
  });

  const passedCompExam = journeyData?.compExamRecords?.length > 0 && journeyData.compExamRecords[0].status === "PASSED";
  const hasAdviser = journeyData?.adviserAssignments?.length > 0;
  const isLoadingData = isJourneyLoading || sessionStatus === "loading";

  const [titles, setTitles] = useState({ t1: "", t2: "", t3: "" });
  
  const [conceptPaper, setConceptPaper] = useState<File | null>(null);
  const conceptInputRef = useRef<HTMLInputElement>(null);
  
  const [cor, setCor] = useState<File | null>(null);
  const corInputRef = useRef<HTMLInputElement>(null);
  
  const [receipt, setReceipt] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const allTitlesFilled = titles.t1.trim() && titles.t2.trim() && titles.t3.trim();
  const canSubmit = allTitlesFilled && conceptPaper !== null && cor !== null && receipt !== null;

  const handleConceptUpload = (file: File) => setConceptPaper(file);
  const handleCorUpload = (file: File) => setCor(file);
  const handleReceiptUpload = (file: File) => setReceipt(file);

  const removeConcept = () => {
    setConceptPaper(null);
    if (conceptInputRef.current) conceptInputRef.current.value = "";
  };
  const removeCor = () => {
    setCor(null);
    if (corInputRef.current) corInputRef.current.value = "";
  };
  const removeReceipt = () => {
    setReceipt(null);
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    
    const formData = new FormData();
    formData.append("title1", titles.t1.trim());
    formData.append("title2", titles.t2.trim());
    formData.append("title3", titles.t3.trim());
    formData.append("conceptPaper", conceptPaper!);
    formData.append("cor", cor!);
    formData.append("receipt", receipt!);

    try {
      const res = await fetch("http://localhost:5000/api/thesis/defense/title", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.user?.accessToken}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit application");

      setStatus("success");
      setTimeout(() => router.push("/student/thesis"), 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      setStatus("error");
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--earist-primary)]"></div>
      </div>
    );
  }

  if (!passedCompExam || !hasAdviser) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card className="border-red-100 shadow-sm">
          <CardHeader className="bg-red-50/50 border-b border-red-100">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Application Locked
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
                <Lock className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Requirements Not Met</h3>
              <p className="text-gray-600 max-w-md">
                You cannot file a Title Defense Application until the following requirements are fulfilled:
              </p>
              <ul className="text-left bg-gray-50 rounded-lg p-4 w-full max-w-md space-y-3">
                <li className="flex items-start gap-3">
                  {passedCompExam ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className={`font-semibold ${passedCompExam ? 'text-green-700' : 'text-red-700'}`}>Comprehensive Examination</span>
                    <p className="text-xs text-gray-500 mt-1">Must be marked as PASSED by the Admin.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  {hasAdviser ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className={`font-semibold ${hasAdviser ? 'text-green-700' : 'text-red-700'}`}>Thesis Adviser Assignment</span>
                    <p className="text-xs text-gray-500 mt-1">You must have an official Thesis Adviser assigned.</p>
                  </div>
                </li>
              </ul>
              <Button 
                variant="outline" 
                onClick={() => router.push("/student/thesis")}
                className="mt-4"
              >
                Return to Thesis Pipeline
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--earist-primary)]" style={{ fontFamily: '"Calibri", sans-serif' }}>
          Title Defense Application
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Submit your concept paper, administrative requirements, and proposed research titles.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {status === "error" && (
          <Alert variant="destructive" className="bg-red-50 text-red-600 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {status === "success" && (
          <Alert className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Application submitted successfully! Redirecting to dashboard...
            </AlertDescription>
          </Alert>
        )}

        {/* Research Titles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
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
                  <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                    {field.label} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={status === "loading" || status === "success"}
                    value={titles[field.key as keyof typeof titles]}
                    onChange={(e) =>
                      setTitles((prev) => ({ ...prev, [field.key]: e.target.value.slice(0, 250) }))
                    }
                    placeholder="Enter your proposed research title..."
                    className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Document Uploads */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Concept Paper Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Concept Paper
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!conceptPaper ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--earist-border-gray)] p-6 transition-colors hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]">
                  <Upload className="mb-2 h-8 w-8 text-[var(--earist-body-text)]/40" />
                  <p className="text-sm font-medium text-center text-[var(--earist-primary)]">Upload Concept Paper</p>
                  <p className="text-xs text-[var(--earist-body-text)]">PDF ONLY</p>
                  <input
                    ref={conceptInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleConceptUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-[var(--earist-border-gray)] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--earist-surface-gray)]">
                      <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--earist-primary)] truncate">{conceptPaper.name}</p>
                      <p className="text-xs text-[var(--earist-body-text)]">{(conceptPaper.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeConcept}
                    className="flex items-center justify-center w-full rounded p-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-1" /> Remove
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* COR Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Current Semester COR
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!cor ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--earist-border-gray)] p-6 transition-colors hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]">
                  <Upload className="mb-2 h-8 w-8 text-[var(--earist-body-text)]/40" />
                  <p className="text-sm font-medium text-center text-[var(--earist-primary)]">Upload COR</p>
                  <p className="text-xs text-[var(--earist-body-text)]">PDF, JPG, PNG</p>
                  <input
                    ref={corInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCorUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-[var(--earist-border-gray)] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--earist-surface-gray)]">
                      <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--earist-primary)] truncate">{cor.name}</p>
                      <p className="text-xs text-[var(--earist-body-text)]">{(cor.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeCor}
                    className="flex items-center justify-center w-full rounded p-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-1" /> Remove
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Receipt Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Application Receipt
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!receipt ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--earist-border-gray)] p-6 transition-colors hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]">
                  <Upload className="mb-2 h-8 w-8 text-[var(--earist-body-text)]/40" />
                  <p className="text-sm font-medium text-center text-[var(--earist-primary)]">Upload Payment Receipt</p>
                  <p className="text-xs text-[var(--earist-body-text)]">PDF, JPG, PNG</p>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReceiptUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-[var(--earist-border-gray)] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--earist-surface-gray)]">
                      <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--earist-primary)] truncate">{receipt.name}</p>
                      <p className="text-xs text-[var(--earist-body-text)]">{(receipt.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="flex items-center justify-center w-full rounded p-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-1" /> Remove
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Submit Button */}
        <Card>
          <CardContent className="py-4">
            <Button
              type="submit"
              disabled={!canSubmit || status === "loading" || status === "success"}
              className={`w-full ${
                canSubmit
                  ? "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              <Send className="mr-2 h-4 w-4" />
              {status === "loading" ? "Uploading files to Server..." : "File Title Defense Application"}
            </Button>
            {!canSubmit && (
              <p className="mt-2 text-center text-xs text-[var(--earist-body-text)]">
                All proposed titles and documents are required.
              </p>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
