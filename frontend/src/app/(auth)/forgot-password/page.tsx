"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your registered email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Unable to send password reset link.");
      } else {
        setSubmittedMessage(
          data.message ||
            "If an active account matches that email address, a password reset link has been sent.",
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
            <h1 className="mb-1.5 text-center text-xl font-bold text-[#262220]">
              Reset Your Password
            </h1>
            <p className="mb-5 text-center text-xs leading-relaxed text-gray-500">
              Enter the email address associated with your account to receive a
              one-time password reset link.
            </p>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {submittedMessage ? (
              <div className="space-y-4">
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <AlertDescription>{submittedMessage}</AlertDescription>
                </Alert>
                <p className="text-center text-xs text-gray-500">
                  Check your inbox and spam folder. Reset links expire after 30
                  minutes.
                </p>
                <Link
                  href="/login"
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#e02b20] text-sm font-semibold text-white transition-colors hover:bg-[#b71c1c]"
                >
                  Return to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                  >
                    Registered Email Address
                  </label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="name@gmail.com"
                    className="h-10"
                    autoComplete="email"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 w-full bg-[#e02b20] font-semibold text-white shadow-xs transition-colors hover:bg-[#b71c1c]"
                >
                  {submitting ? "Sending Reset Link..." : "Send Reset Link"}
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
