"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  Image as ImageIcon,
  Mail,
  Lock,
} from "lucide-react";

type UploadState = "idle" | "uploading" | "pending" | "verified";

export default function ApplicantCORUploadPage() {
  const { data: session } = useSession();
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [examStatus, setExamStatus] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if the user already has a pending or verified upload
    const fetchStatus = async () => {
      try {
        const data = await apiClientRequest("/cor/my-upload");
        if (data && data.status) {
          setUploadState(data.status); // "pending" or "verified"
        }
      } catch (error) {
        console.log("No existing upload found or error:", error);
      }
    };

    const fetchExamStatus = async () => {
      try {
        const data = await apiClientRequest("/exam/status");
        if (data && data.examStatus) {
          setExamStatus(data.examStatus);
        }
      } catch (error) {
        console.error("Failed to fetch exam status:", error);
      }
    };

    fetchStatus();
    fetchExamStatus();
  }, []);

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

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadState("uploading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = session?.user?.accessToken;
      const apiUrl =
        process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";

      const res = await fetch(`${apiUrl}/api/cor/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Upload failed");
      }

      setUploadState("pending");
      setFile(null);
      setPreview(null);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      alert(errorMessage);
      setUploadState("idle");
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Certificate of Registration (COR)
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Upload your COR for Admin verification
        </p>
      </div>

      {uploadState === "verified" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            <span className="font-semibold">COR verified!</span> Student portal
            credentials have been sent to your email.
          </AlertDescription>
        </Alert>
      )}

      {uploadState === "pending" && (
        <Alert className="border-amber-200 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            <span className="font-semibold">COR submitted</span> — awaiting
            Admin verification.
          </AlertDescription>
        </Alert>
      )}

      {examStatus !== "passed" ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <Lock className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                Access Denied
              </h3>
              <Alert className="max-w-md border-red-200 bg-red-50">
                <X className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  You must pass the entrance examination before you can upload your Certificate of Registration.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      ) : (uploadState === "idle" || uploadState === "uploading") && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
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
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--earist-primary) text-xs font-bold text-white">
                      {item.step}
                    </div>
                    <p className="text-sm text-(--earist-body-text)">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Upload COR
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                    isDragging
                      ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                      : "border-(--earist-border-gray) hover:border-(--earist-primary) hover:bg-(--earist-surface-gray)"
                  }`}
                >
                  <Upload className="mb-3 h-10 w-10 text-(--earist-body-text)/40" />
                  <p className="mb-1 text-sm font-medium text-(--earist-primary)">
                    Drag and drop your COR file here
                  </p>
                  <p className="mb-3 text-xs text-(--earist-body-text)">
                    or click to browse files
                  </p>
                  <p className="text-[11px] text-(--earist-body-text)">
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
                  <div className="flex items-start gap-3 rounded-lg border border-(--earist-border-gray) p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-(--earist-surface-gray)">
                      {file.type === "application/pdf" ? (
                        <FileText className="h-5 w-5 text-(--earist-primary)" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-(--earist-primary)" />
                      )}
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
                      disabled={uploadState === "uploading"}
                      className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {preview && (
                    <div className="overflow-hidden rounded-lg border border-(--earist-border-gray)">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt="COR Preview"
                        className="max-h-64 w-full object-contain"
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={uploadState === "uploading"}
                    className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                  >
                    {uploadState === "uploading" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {uploadState === "uploading"
                      ? "Uploading..."
                      : "Upload Certificate of Registration"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-(--earist-surface-gray) p-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-(--earist-body-text)" />
        <p className="text-xs text-(--earist-body-text)">
          {uploadState === "verified"
            ? "Your portal credentials have been sent to your registered email address."
            : "You will receive an email notification once your COR has been verified by the Administrator."}
        </p>
      </div>
    </div>
  );
}
