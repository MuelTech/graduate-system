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
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  Image,
  Mail,
  Key,
  AlertTriangle,
  Eye,
} from "lucide-react";

export default function ApplicantCORUploadPage() {
  const uploadState = "idle" as "idle" | "uploaded" | "processing" | "pending" | "verified";

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractedData = {
    registrationNumber: "2026-1-00456",
    academicYear: "2025-2026",
    semester: "Second Semester",
    program: "Master of Science in Computer Science",
    yearLevel: "1st Year",
    studentNumber: "2026-GS-00456",
  };

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("File size must not exceed 5MB.");
      return;
    }
    const validTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!validTypes.includes(selectedFile.type)) {
      alert("Only PDF, JPG, and PNG files are accepted.");
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Certificate of Registration (COR)
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Upload your COR for Admin verification
        </p>
      </div>

      {/* Verification Status — Verified */}
      {uploadState === "verified" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            <span className="font-semibold">COR verified!</span> Student portal
            credentials have been sent to your email.
          </AlertDescription>
        </Alert>
      )}

      {/* Verification Status — Pending */}
      {uploadState === "pending" && (
        <Alert className="border-amber-200 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            <span className="font-semibold">COR submitted</span> — awaiting
            Admin verification.
          </AlertDescription>
        </Alert>
      )}

      {/* Credential Dispatch Note — After Verification */}
      {uploadState === "verified" && (
        <Card>
          <CardContent className="py-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="mb-2 text-sm font-semibold text-green-800">
                Your Portal Credentials
              </p>
              <div className="space-y-1 text-sm text-green-700">
                <p className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <span>
                    <span className="font-medium">Username:</span>{" "}
                    {extractedData.studentNumber}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <span>
                    <span className="font-medium">Password:</span> Your Date of
                    Birth (MM/DD/YYYY)
                  </span>
                </p>
              </div>
              <p className="mt-2 text-xs text-green-600">
                Please change your password after your first login.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
            How to Upload Your COR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                step: 1,
                text: "Complete your enrollment in EARIST Pinnacle.",
              },
              {
                step: 2,
                text: "Download your Certificate of Registration (COR) from Pinnacle.",
              },
              {
                step: 3,
                text: "Upload the COR file here for Admin verification.",
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--earist-primary)] text-xs font-bold text-white">
                  {item.step}
                </div>
                <p className="text-sm text-[var(--earist-body-text)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* File Upload Zone */}
      {uploadState === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Upload COR
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                  isDragging
                    ? "border-[var(--earist-primary)] bg-[var(--earist-surface-light-red)]"
                    : "border-[var(--earist-border-gray)] hover:border-[var(--earist-primary)] hover:bg-[var(--earist-surface-gray)]"
                }`}
              >
                <Upload className="mb-3 h-10 w-10 text-[var(--earist-body-text)]/40" />
                <p className="mb-1 text-sm font-medium text-[var(--earist-primary)]">
                  Drag and drop your COR file here
                </p>
                <p className="mb-3 text-xs text-[var(--earist-body-text)]">
                  or click to browse files
                </p>
                <p className="text-[11px] text-[var(--earist-body-text)]">
                  Accepted formats: PDF, JPG, PNG &middot; Max 5MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) handleFileSelect(selected);
                  }}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Preview */}
                <div className="flex items-start gap-3 rounded-lg border border-[var(--earist-border-gray)] p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--earist-surface-gray)]">
                    {file.type === "application/pdf" ? (
                      <FileText className="h-5 w-5 text-[var(--earist-primary)]" />
                    ) : (
                      <Image className="h-5 w-5 text-[var(--earist-primary)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--earist-primary)] truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={removeFile}
                    className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Image Preview */}
                {preview && (
                  <div className="overflow-hidden rounded-lg border border-[var(--earist-border-gray)]">
                    <img
                      src={preview}
                      alt="COR Preview"
                      className="max-h-64 w-full object-contain"
                    />
                  </div>
                )}

                {/* Upload Button */}
                <Button className="w-full bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Certificate of Registration
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* OCR Processing State */}
      {uploadState === "processing" && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="mb-3 h-10 w-10 animate-spin text-[var(--earist-primary)]" />
              <p className="mb-1 text-sm font-semibold text-[var(--earist-primary)]">
                Processing your COR...
              </p>
              <p className="text-xs text-[var(--earist-body-text)]">
                Extracting data from your document. This may take a moment.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Data Review */}
      {(uploadState === "pending" || uploadState === "verified") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Extracted COR Data
              </CardTitle>
              <Badge
                className={
                  uploadState === "verified"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }
              >
                {uploadState === "verified" ? "Verified" : "Pending Review"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: "Student Number", value: extractedData.studentNumber },
                {
                  label: "Registration Number",
                  value: extractedData.registrationNumber,
                },
                { label: "Program", value: extractedData.program },
                { label: "Year Level", value: extractedData.yearLevel },
                {
                  label: "Academic Year",
                  value: extractedData.academicYear,
                },
                { label: "Semester", value: extractedData.semester },
              ].map((field) => (
                <div
                  key={field.label}
                  className="rounded-lg bg-[var(--earist-surface-gray)] p-3"
                >
                  <p className="text-xs text-[var(--earist-body-text)]">
                    {field.label}
                  </p>
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Notice */}
      <div className="flex items-start gap-2 rounded-lg bg-[var(--earist-surface-gray)] p-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--earist-body-text)]" />
        <p className="text-xs text-[var(--earist-body-text)]">
          {uploadState === "verified"
            ? "Your portal credentials have been sent to your registered email address."
            : "You will receive an email notification once your COR has been verified by the Administrator."}
        </p>
      </div>
    </div>
  );
}
