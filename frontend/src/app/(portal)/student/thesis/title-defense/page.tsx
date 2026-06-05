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
  AlertTriangle,
  Send,
  Lock,
  Image,
} from "lucide-react";

export default function TitleDefensePage() {
  const applicationState = "form" as "form" | "submitted" | "approved" | "panel_assigned" | "scheduled" | "completed";

  const [titles, setTitles] = useState({ t1: "", t2: "", t3: "" });
  const [orNumber, setOrNumber] = useState("");
  const [requirements, setRequirements] = useState([
    {
      name: "Certificate of Comprehensive Exam (Passed)",
      status: "verified" as "pending" | "uploaded" | "verified",
      file: null as File | null,
      required: true,
    },
    {
      name: "COR (Current Semester)",
      status: "pending" as "pending" | "uploaded" | "verified",
      file: null as File | null,
      required: true,
    },
    {
      name: "Application for Defense",
      status: "pending" as "pending" | "uploaded" | "verified",
      file: null as File | null,
      required: true,
    },
  ]);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);

  const allRequirementsMet = requirements.every(
    (r) => r.status === "verified" || r.status === "uploaded"
  );
  const allTitlesFilled = titles.t1.trim() && titles.t2.trim() && titles.t3.trim();
  const canSubmit = allRequirementsMet && allTitlesFilled;

  const handleRequirementUpload = (index: number, file: File) => {
    setRequirements((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, file, status: "uploaded" as const } : r
      )
    );
  };

  const handlePaymentUpload = (file: File) => {
    setPaymentFile(file);
  };

  const removePaymentFile = () => {
    setPaymentFile(null);
    if (paymentInputRef.current) paymentInputRef.current.value = "";
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

  if (applicationState === "submitted") {
    return (
      <div className="space-y-4">
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Title Defense Application
        </h2>
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">
                Application Submitted
              </h3>
              <p className="mb-4 max-w-md text-sm text-[var(--earist-body-text)]">
                Your Title Defense application has been submitted and is under
                Admin review. You will be notified once it is approved.
              </p>
              <Badge className="bg-amber-100 text-amber-700">
                <Clock className="mr-1 h-3 w-3" />
                Admin Review
              </Badge>
            </div>
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
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Title Defense Application
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Submit your Title Defense requirements and proposed research titles
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

      {/* Research Titles Form */}
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
                <div className="relative">
                  <input
                    type="text"
                    value={titles[field.key as keyof typeof titles]}
                    onChange={(e) =>
                      setTitles((prev) => ({
                        ...prev,
                        [field.key]: e.target.value.slice(0, 250),
                      }))
                    }
                    placeholder="Enter your proposed research title..."
                    className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--earist-body-text)]">
                    {titles[field.key as keyof typeof titles].length}/250
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Proof of Payment Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
            Proof of Payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                OR Number
              </label>
              <input
                type="text"
                value={orNumber}
                onChange={(e) => setOrNumber(e.target.value)}
                placeholder="Enter OR number..."
                className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                Upload Receipt
              </label>
              {!paymentFile ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--earist-border-gray)] p-6 transition-colors hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]">
                  <Upload className="mb-2 h-8 w-8 text-[var(--earist-body-text)]/40" />
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    Upload payment receipt
                  </p>
                  <p className="text-xs text-[var(--earist-body-text)]">
                    PDF, JPG, PNG — Max 5MB
                  </p>
                  <input
                    ref={paymentInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePaymentUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-[var(--earist-border-gray)] p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--earist-surface-gray)]">
                    {paymentFile.type === "application/pdf" ? (
                      <FileText className="h-4 w-4 text-[var(--earist-primary)]" />
                    ) : (
                      <Image className="h-4 w-4 text-[var(--earist-primary)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--earist-primary)] truncate">
                      {paymentFile.name}
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      {(paymentFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={removePaymentFile}
                    className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
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
            File Title Defense Application
          </Button>
          {!canSubmit && (
            <p className="mt-2 text-center text-xs text-[var(--earist-body-text)]">
              Complete all requirements and fill in all three proposed titles to
              submit.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Post-Submission Status Flow (shown when submitted) */}
      {applicationState !== "form" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Application Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {[
                "Submitted",
                "Admin Review",
                "Approved",
                "Panel Assigned",
                "Scheduled",
                "Completed",
              ].map((step, i) => {
                const isCompleted = i < 2;
                const isCurrent = i === 2;
                return (
                  <div key={step} className="flex flex-col items-center">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? "bg-[var(--earist-accent)] text-[var(--earist-primary)]"
                            : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)]"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className="mt-1 text-center text-[10px] text-[var(--earist-body-text)]">
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
