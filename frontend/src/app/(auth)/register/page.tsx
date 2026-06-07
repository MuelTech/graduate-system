"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  GraduationCap,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Info,
  AlertCircle,
} from "lucide-react";

const programs = [
  "Master of Arts in Education",
  "Doctor of Education",
  "Master of Science in Computer Science",
  "Master in Public Administration",
  "Doctor of Public Administration",
  "Master of Arts in Nursing",
  "Master of Science in Industrial Engineering",
  "Master of Arts in Mathematics",
  "Doctor of Philosophy in Education",
];

const undergraduateCourses = [
  "Bachelor of Elementary Education",
  "Bachelor of Secondary Education",
  "Bachelor of Science in Computer Science",
  "Bachelor of Science in Information Technology",
  "Bachelor of Science in Public Administration",
  "Bachelor of Science in Nursing",
  "Bachelor of Science in Industrial Engineering",
  "Bachelor of Science in Mathematics",
  "Bachelor of Arts in Political Science",
  "Bachelor of Science in Business Administration",
];

const stepTitles = [
  "Verify Your Applicant ID",
  "Personal Information",
  "Program Selection",
  "Create Your Password",
];

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    applicantId: "",
    firstName: "",
    lastName: "",
    email: "",
    cellphone: "",
    dateOfBirth: "",
    program: "",
    programType: "Masters",
    undergraduateCourse: "",
    password: "",
    confirmPassword: "",
  });

  const updateForm = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear any previous errors when the user starts typing again
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        return;
      }

      setIsSubmitted(true);
    } catch (err) {
      setError("A network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center blur-sm scale-105"
          style={{ backgroundImage: "url('/images/campus-hero.jpg')" }}
        />
        <div className="absolute inset-0 bg-[var(--earist-primary)]/60 backdrop-blur-sm" />

        <div className="relative z-10 w-full max-w-[480px] px-4 py-12">
          <Card className="shadow-2xl">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-[var(--earist-primary)]">
                Registration Complete
              </h2>
              <p className="mb-6 text-sm text-[var(--earist-body-text)]">
                Your applicant account has been created successfully.
              </p>

              <Alert className="mb-6 border-[var(--earist-accent)]/30 bg-[var(--earist-surface-cream)]">
                <Info className="h-4 w-4 text-[var(--earist-warning)]" />
                <AlertDescription>
                  <p className="mb-3 text-sm font-bold text-[var(--earist-primary)]">
                    What happens next:
                  </p>
                  <div className="space-y-3">
                    {[
                      "Schedule your entrance examination through your Applicant Portal.",
                      "Take the exam on your scheduled date",
                      "If you pass, complete your enrollment to get your Certificate of Registration (COR).",
                      "Upload your COR here for verification.",
                      "Once verified, you will receive your Student credentials via email.",
                    ].map((item, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--earist-primary)] text-xs font-bold text-white">
                          {i + 1}
                        </div>
                        <p className="text-sm text-[var(--earist-body-text)] text-left">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>

              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--earist-accent)] py-2.5 text-sm font-bold text-[var(--earist-primary)] transition-colors hover:bg-[var(--earist-accent)]/90"
              >
                Sign In to Your Portal
              </Link>
            </CardContent>
          </Card>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-white/80 transition-colors hover:text-white"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm scale-105"
        style={{ backgroundImage: "url('/images/campus-hero.jpg')" }}
      />
      <div className="absolute inset-0 bg-[var(--earist-primary)]/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-[480px] px-4 py-12">
        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--earist-surface-light-red)]">
              <GraduationCap className="h-9 w-9 text-[var(--earist-primary)]" />
            </div>
            <CardTitle
              className="text-lg text-[var(--earist-primary)]"
              style={{ fontFamily: '"Calibri", sans-serif' }}
            >
              EARIST Graduate School
            </CardTitle>
            <CardDescription>Graduate School Admission</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step Progress */}
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                {[0, 1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        s === step
                          ? "bg-[var(--earist-accent)] text-[var(--earist-primary)] ring-2 ring-[var(--earist-accent)]/30"
                          : s < step
                            ? "bg-[var(--earist-primary)] text-white"
                            : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)]"
                      }`}
                    >
                      {s < step ? "✓" : s + 1}
                    </div>
                    {s < 3 && (
                      <div
                        className={`h-1 w-12 sm:w-20 transition-colors ${
                          s < step
                            ? "bg-[var(--earist-primary)]"
                            : "bg-[var(--earist-border-gray)]"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-center text-sm font-semibold text-[var(--earist-primary)]">
                {stepTitles[step]}
              </p>
            </div>

            {/* Error Message Display */}
            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              {/* Step 0: Applicant ID */}
              {step === 0 && (
                <div className="space-y-5">
                  <Alert className="border-[var(--earist-accent)]/30 bg-[var(--earist-surface-cream)]">
                    <Info className="h-4 w-4 text-[var(--earist-warning)]" />
                    <AlertDescription className="text-[var(--earist-warning)]">
                      You must have an <strong>Applicant ID</strong> to
                      register. This is issued after your initial application is
                      processed.
                    </AlertDescription>
                  </Alert>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Applicant ID <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.applicantId}
                      onChange={(e) =>
                        updateForm("applicantId", e.target.value)
                      }
                      placeholder="Enter your Applicant ID"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Step 1: Personal Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) =>
                          updateForm("firstName", e.target.value)
                        }
                        placeholder="First Name"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) =>
                          updateForm("lastName", e.target.value)
                        }
                        placeholder="Last Name"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      placeholder="your.email@gmail.com"
                      required
                    />
                    <p className="mt-1.5 text-xs text-[var(--earist-body-text)]">
                      Gmail only
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Cellphone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="tel"
                      value={formData.cellphone}
                      onChange={(e) => updateForm("cellphone", e.target.value)}
                      placeholder="09XX-XXX-XXXX"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) =>
                        updateForm("dateOfBirth", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Program Selection */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Program Type <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {["Masters", "Doctoral"].map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant={
                            formData.programType === type
                              ? "default"
                              : "outline"
                          }
                          onClick={() => updateForm("programType", type)}
                          className={
                            formData.programType === type
                              ? "bg-[var(--earist-primary)] hover:bg-[var(--earist-primary)]/90"
                              : "border-[var(--earist-border-gray)]"
                          }
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Intended Graduate Program{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.program}
                      onChange={(e) => updateForm("program", e.target.value)}
                      required
                      className="w-full rounded-lg border border-[var(--earist-border-gray)] px-4 py-3 text-sm transition-colors focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
                    >
                      <option value="">Select a program</option>
                      {programs.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Undergraduate Program{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.undergraduateCourse}
                      onChange={(e) =>
                        updateForm("undergraduateCourse", e.target.value)
                      }
                      required
                      className="w-full rounded-lg border border-[var(--earist-border-gray)] px-4 py-3 text-sm transition-colors focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
                    >
                      <option value="">Select your undergraduate course</option>
                      {undergraduateCourses.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-[var(--earist-body-text)]">
                      Used for Program Alignment Check
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Account Setup */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          updateForm("password", e.target.value)
                        }
                        placeholder="Create a password"
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--earist-body-text)] transition-colors hover:text-[var(--earist-primary)]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        updateForm("confirmPassword", e.target.value)
                      }
                      placeholder="Confirm your password"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep(step - 1);
                      setError(""); // Clear error on back navigation
                    }}
                    className="text-[var(--earist-secondary)]"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                ) : (
                  <div />
                )}
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setStep(step + 1);
                      setError(""); // Clear error on forward navigation
                    }}
                    className="bg-[var(--earist-primary)] hover:bg-[var(--earist-primary)]/90"
                  >
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[var(--earist-accent)] text-[var(--earist-primary)] hover:bg-[var(--earist-accent)]/90 disabled:opacity-70"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Registration"}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--earist-border-gray)]" />
              <span className="text-xs text-[var(--earist-body-text)]">or</span>
              <div className="h-px flex-1 bg-[var(--earist-border-gray)]" />
            </div>

            <Link
              href="/login"
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-[var(--earist-primary)] py-2.5 text-sm font-semibold text-[var(--earist-primary)] transition-colors hover:bg-[var(--earist-surface-light-red)]"
            >
              Already registered? Sign in
            </Link>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm text-white/80 transition-colors hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}