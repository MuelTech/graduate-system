"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ShieldCheck,
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  Info,
  ExternalLink,
} from "lucide-react";

export default function PlagiarismCheckPage() {
  const checkState = "idle" as "idle" | "processing" | "passed" | "failed";

  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const result = {
    similarity: 12,
    threshold: 20,
    date: "June 1, 2026",
    reportUrl: "#",
  };

  const history = [
    {
      date: "June 1, 2026",
      similarity: 12,
      status: "passed" as "passed" | "failed",
      reportUrl: "#",
    },
    {
      date: "May 25, 2026",
      similarity: 23,
      status: "failed" as "passed" | "failed",
      reportUrl: "#",
    },
    {
      date: "May 18, 2026",
      similarity: 31,
      status: "failed" as "passed" | "failed",
      reportUrl: "#",
    },
  ];

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      alert("Only PDF files are accepted.");
      return;
    }
    setFile(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          STRIKE Plagiarism Check
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Powered by{" "}
          <a
            href="https://strikeplagiarism.com/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-(--earist-secondary) hover:underline"
          >
            StrikePlagiarism.com
          </a>
        </p>
      </div>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--earist-primary) text-[10px] font-bold text-white">
                1
              </div>
              <p className="text-sm text-(--earist-body-text)">
                Upload your final manuscript (PDF format).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--earist-primary) text-[10px] font-bold text-white">
                2
              </div>
              <p className="text-sm text-(--earist-body-text)">
                The system sends your manuscript to{" "}
                <span className="font-semibold">STRIKE API</span> for automatic
                plagiarism analysis.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--earist-primary) text-[10px] font-bold text-white">
                3
              </div>
              <p className="text-sm text-(--earist-body-text)">
                View similarity result and download the full STRIKE report.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--earist-primary) text-[10px] font-bold text-white">
                4
              </div>
              <p className="text-sm text-(--earist-body-text)">
                Similarity must be{" "}
                <span className="font-semibold">BELOW 20%</span> to pass.
              </p>
            </div>
          </div>
          <Alert className="mt-3 border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              You can run multiple checks. All results are recorded in your
              history with downloadable reports.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Manuscript Upload */}
      {checkState === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Upload Manuscript
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--earist-border-gray) p-8 transition-colors hover:border-(--earist-primary) hover:bg-(--earist-surface-gray)"
              >
                <Upload className="mb-3 h-10 w-10 text-(--earist-body-text)/40" />
                <p className="mb-1 text-sm font-medium text-(--earist-primary)">
                  Upload your manuscript
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  PDF format only
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) handleFileSelect(selected);
                  }}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-(--earist-border-gray) p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-(--earist-surface-gray)">
                    <FileText className="h-5 w-5 text-(--earist-primary)" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--earist-primary)">
                      {file.name}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={removeFile}
                    className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Button className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Run Plagiarism Check via STRIKE
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processing State */}
      {checkState === "processing" && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-(--earist-primary)" />
              <p className="mb-1 text-sm font-semibold text-(--earist-primary)">
                Sending to STRIKE API...
              </p>
              <p className="text-xs text-(--earist-body-text)">
                Your manuscript is being analyzed by StrikePlagiarism.com. This
                may take a few minutes.
              </p>
              <div className="mt-4 h-2 w-48 overflow-hidden rounded-full bg-(--earist-border-gray)">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-(--earist-primary)" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display — Passed */}
      {checkState === "passed" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Similarity Result
              </CardTitle>
              <Badge className="bg-green-100 px-3 py-1 text-sm text-green-700">
                PASSED
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-(--earist-primary)">
                    {result.similarity}%
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    Similarity &middot; {result.date}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-green-700">
                Similarity: {result.similarity}% — Below {result.threshold}%
                threshold. Your manuscript passes the plagiarism check.
              </p>
              <div className="mt-3 flex gap-2">
                <a
                  href={result.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    View Full Report
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                  }}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  Re-upload Manuscript
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display — Failed */}
      {checkState === "failed" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Similarity Result
              </CardTitle>
              <Badge className="bg-red-100 px-3 py-1 text-sm text-red-700">
                FAILED
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-10 w-10 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-(--earist-primary)">
                    {result.similarity}%
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    Similarity &middot; {result.date}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-red-700">
                Similarity: {result.similarity}% — Exceeds {result.threshold}%
                threshold. Please revise your manuscript and re-upload.
              </p>
              <div className="mt-3 flex gap-2">
                <a
                  href={result.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    View Full Report
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                  }}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  Re-upload Manuscript
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Check History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-(--earist-body-text)">
              No checks performed yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                    <th className="px-4 py-2 text-left font-semibold text-(--earist-secondary)">
                      Date
                    </th>
                    <th className="px-4 py-2 text-center font-semibold text-(--earist-secondary)">
                      Similarity
                    </th>
                    <th className="px-4 py-2 text-center font-semibold text-(--earist-secondary)">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-(--earist-secondary)">
                      Report
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, i) => (
                    <tr
                      key={i}
                      className="border-b border-(--earist-border-gray) last:border-0"
                    >
                      <td className="px-4 py-2 text-(--earist-body-text)">
                        {entry.date}
                      </td>
                      <td className="px-4 py-2 text-center font-medium text-(--earist-primary)">
                        {entry.similarity}%
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge
                          className={
                            entry.status === "passed"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }
                        >
                          {entry.status === "passed" ? "PASSED" : "FAILED"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <a
                          href={entry.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-(--earist-secondary) hover:text-(--earist-primary)"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Report
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
