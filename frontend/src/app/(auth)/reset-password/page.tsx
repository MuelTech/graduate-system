"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { getClientBackendBaseUrl } from "@/lib/backend-origin.client";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [invalidReason, setInvalidReason] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;
    const validate = async () => {
      if (!token) {
        if (active) {
          setTokenValid(false);
          setInvalidReason("This password reset link is invalid or incomplete.");
          setChecking(false);
        }
        return;
      }
      try {
        const apiBaseUrl = getClientBackendBaseUrl();
        const res = await fetch(
          `${apiBaseUrl}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (active) {
          if (res.ok && data.valid) {
            setTokenValid(true);
          } else {
            setTokenValid(false);
            setInvalidReason(
              data.reason || "This password reset link is invalid or has expired.",
            );
          }
        }
      } catch {
        if (active) {
          setTokenValid(false);
          setInvalidReason("Unable to verify reset link. Please try again.");
        }
      } finally {
        if (active) setChecking(false);
      }
    };
    void validate();
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const apiBaseUrl = getClientBackendBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Unable to reset password.");
      } else {
        setSuccessMessage(
          data.message ||
            "Your password has been reset. You may now sign in with your new password.",
        );
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center blur-sm"
        style={{ backgroundImage: "url('/images/campus-hero.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#8b1a1a]/85 via-[#6e1414]/80 to-[#262220]/85 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-[440px] px-4 py-10">
        <Card className="overflow-hidden border-gray-200/80 border-t-4 border-t-[#8b1a1a] bg-white shadow-2xl">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white p-0.5 shadow-sm ring-2 ring-[#8b1a1a]/20">
              <Image
                src="/images/landing/earist-logo.jpg"
                alt="EARIST seal"
                width={64}
                height={64}
                priority
                className="h-full w-full rounded-full object-cover"
              />
            </div>
            <CardTitle className="text-lg font-bold tracking-tight text-[#262220]">
              EARIST Graduate School
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-2">
            <h1 className="mb-4 text-center text-xl font-bold text-[#262220]">
              Set New Password
            </h1>

            {checking ? (
              <p className="py-6 text-center text-sm text-gray-500">
                Verifying reset link...
              </p>
            ) : successMessage ? (
              <div className="space-y-4">
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
                <Button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="h-10 w-full bg-[#e02b20] font-semibold text-white hover:bg-[#b71c1c]"
                >
                  Continue to Sign In
                </Button>
              </div>
            ) : !tokenValid ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{invalidReason}</AlertDescription>
                </Alert>
                <Link
                  href="/forgot-password"
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#e02b20] text-sm font-semibold text-white transition-colors hover:bg-[#b71c1c]"
                >
                  Request a New Reset Link
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      id="reset-new-password"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="h-10 pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((prev) => !prev)}
                      aria-label={showNew ? "Hide password" : "Show password"}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-[#333333]"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Input
                      id="reset-confirm-password"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      className="h-10 pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((prev) => !prev)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-[#333333]"
                    >
                      {showConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 w-full bg-[#e02b20] font-semibold text-white shadow-xs transition-colors hover:bg-[#b71c1c]"
                >
                  {submitting ? "Updating Password..." : "Update Password"}
                </Button>
              </form>
            )}

            <div className="mt-5 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-[#8b1a1a] hover:underline"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#8b1a1a]" />
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
