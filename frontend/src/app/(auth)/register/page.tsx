"use client";

import { useState, useEffect } from "react";
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
    programId: "",
    programType: "Masters",
    undergraduateProgramId: "",
    password: "",
    confirmPassword: "",
  });

  const [graduateProgramsList, setGraduateProgramsList] = useState<
    { id: string; programName: string; programType: string }[]
  >([]);

  const [undergraduateProgramsList, setUndergraduateProgramsList] = useState<
    { id: string; programName: string }[]
  >([]);

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";
        const res = await fetch(`${apiUrl}/api/programs`);
        if (res.ok) {
          const data = await res.json();
          setGraduateProgramsList(data.graduatePrograms);
          setUndergraduateProgramsList(data.undergraduatePrograms);
        }
      } catch (err) {
        console.error("Failed to fetch programs", err);
      }
    };
    fetchPrograms();
  }, []);

  const updateForm = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear any previous errors when the user starts typing again
    if (error) setError("");
  };

  const validateStep = (currentStep: number) => {
    switch (currentStep) {
      case 0:
        if (!formData.applicantId.trim()) {
          setError("Applicant ID is required.");
          return false;
        }
        break;
      case 1:
        if (!formData.firstName.trim()) {
          setError("First Name is required.");
          return false;
        }
        if (!formData.lastName.trim()) {
          setError("Last Name is required.");
          return false;
        }
        if (!formData.email.trim()) {
          setError("Email Address is required.");
          return false;
        }
        // Optional: Simple email format validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          setError("Please enter a valid email address.");
          return false;
        }
        if (!formData.cellphone.trim()) {
          setError("Cellphone Number is required.");
          return false;
        }
        if (!formData.dateOfBirth.trim()) {
          setError("Date of Birth is required.");
          return false;
        }
        break;
      case 2:
        if (!formData.programId) {
          setError("Intended Program is required.");
          return false;
        }
        if (!formData.undergraduateProgramId) {
          setError("Prerequisite Program is required.");
          return false;
        }
        break;
      case 3:
        if (!formData.password) {
          setError("Password is required.");
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match.");
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateStep(3)) {
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
          className="absolute inset-0 scale-105 bg-cover bg-center blur-sm"
          style={{ backgroundImage: "url('/images/campus-hero.jpg')" }}
        />
        <div className="absolute inset-0 bg-(--earist-primary)/60 backdrop-blur-sm" />

        <div className="relative z-10 w-full max-w-[480px] px-4 py-12">
          <Card className="shadow-2xl">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-(--earist-primary)">
                Registration Complete
              </h2>
              <p className="mb-6 text-sm text-(--earist-body-text)">
                Your applicant account has been created successfully.
              </p>

              <Alert className="mb-6 border-(--earist-accent)/30 bg-(--earist-surface-cream)">
                <Info className="h-4 w-4 text-(--earist-warning)" />
                <AlertDescription>
                  <p className="mb-3 text-sm font-bold text-(--earist-primary)">
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
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--earist-primary) text-xs font-bold text-white">
                          {i + 1}
                        </div>
                        <p className="text-left text-sm text-(--earist-body-text)">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>

              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-(--earist-accent) py-2.5 text-sm font-bold text-(--earist-primary) transition-colors hover:bg-(--earist-accent)/90"
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
        className="absolute inset-0 scale-105 bg-cover bg-center blur-sm"
        style={{ backgroundImage: "url('/images/campus-hero.jpg')" }}
      />
      <div className="absolute inset-0 bg-(--earist-primary)/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-[480px] px-4 py-12">
        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-(--earist-surface-light-red)">
              <GraduationCap className="h-9 w-9 text-(--earist-primary)" />
            </div>
            <CardTitle
              className="text-lg text-(--earist-primary)"
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
                          ? "bg-(--earist-accent) text-(--earist-primary) ring-2 ring-(--earist-accent)/30"
                          : s < step
                            ? "bg-(--earist-primary) text-white"
                            : "bg-(--earist-surface-gray) text-(--earist-body-text)"
                      }`}
                    >
                      {s < step ? "✓" : s + 1}
                    </div>
                    {s < 3 && (
                      <div
                        className={`h-1 w-12 transition-colors sm:w-20 ${
                          s < step
                            ? "bg-(--earist-primary)"
                            : "bg-(--earist-border-gray)"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-center text-sm font-semibold text-(--earist-primary)">
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
                  <Alert className="border-(--earist-accent)/30 bg-(--earist-surface-cream)">
                    <Info className="h-4 w-4 text-(--earist-warning)" />
                    <AlertDescription className="text-(--earist-warning)">
                      You must have an <strong>Applicant ID</strong> to
                      register. This is issued after your initial application is
                      processed.
                    </AlertDescription>
                  </Alert>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                      <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                      <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => updateForm("lastName", e.target.value)}
                        placeholder="Last Name"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      placeholder="your.email@gmail.com"
                      required
                    />
                    <p className="mt-1.5 text-xs text-(--earist-body-text)">
                      Gmail only
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                    <label className="mb-2 block text-sm font-semibold text-(--earist-secondary)">
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
                          onClick={() => {
                            updateForm("programType", type);
                            updateForm("programId", "");
                            updateForm("undergraduateProgramId", "");
                          }}
                          className={
                            formData.programType === type
                              ? "bg-(--earist-primary) hover:bg-(--earist-primary)/90"
                              : "border-(--earist-border-gray)"
                          }
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    // Separate the graduate programs into their respective lists
                    const mastersPrograms = graduateProgramsList.filter(
                      (p) => p.programType === "MASTERS",
                    );
                    const doctoralPrograms = graduateProgramsList.filter(
                      (p) => p.programType === "DOCTORAL",
                    );

                    // Establish logic variables based on selected type
                    const isDoctoral = formData.programType === "Doctoral";
                    const intendedProgramList = isDoctoral
                      ? doctoralPrograms
                      : mastersPrograms;
                    const prerequisiteProgramList = isDoctoral
                      ? mastersPrograms
                      : undergraduateProgramsList;

                    const intendedProgramLabel = isDoctoral
                      ? "Intended Doctorate Program"
                      : "Intended Masters Program";
                    const prerequisiteProgramLabel = isDoctoral
                      ? "Masters Program"
                      : "Undergraduate Program";
                    const prerequisitePlaceholder = isDoctoral
                      ? "Select your masters course (or closest equivalent)"
                      : "Select your undergraduate course";

                    return (
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
                            {intendedProgramLabel}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.programId}
                            onChange={(e) =>
                              updateForm("programId", e.target.value)
                            }
                            required
                            className="w-full rounded-lg border border-(--earist-border-gray) px-4 py-3 text-sm transition-colors focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                          >
                            <option value="">Select a program</option>
                            {intendedProgramList.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.programName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
                            {prerequisiteProgramLabel}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.undergraduateProgramId}
                            onChange={(e) =>
                              updateForm(
                                "undergraduateProgramId",
                                e.target.value,
                              )
                            }
                            required
                            className="w-full rounded-lg border border-(--earist-border-gray) px-4 py-3 text-sm transition-colors focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                          >
                            <option value="">{prerequisitePlaceholder}</option>
                            {prerequisiteProgramList.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.programName}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-xs text-(--earist-body-text)">
                            Used for Program Alignment Check.{" "}
                            {isDoctoral &&
                              "If you graduated from another school, select the closest equivalent program."}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Step 3: Account Setup */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => updateForm("password", e.target.value)}
                        placeholder="Create a password"
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-(--earist-body-text) transition-colors hover:text-(--earist-primary)"
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
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                    className="text-(--earist-secondary)"
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
                      if (validateStep(step)) {
                        setStep(step + 1);
                        setError(""); // Clear error on forward navigation
                      }
                    }}
                    className="bg-(--earist-primary) hover:bg-(--earist-primary)/90"
                  >
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-(--earist-accent) text-(--earist-primary) hover:bg-(--earist-accent)/90 disabled:opacity-70"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Registration"}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-(--earist-border-gray)" />
              <span className="text-xs text-(--earist-body-text)">or</span>
              <div className="h-px flex-1 bg-(--earist-border-gray)" />
            </div>

            <Link
              href="/login"
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-(--earist-primary) py-2.5 text-sm font-semibold text-(--earist-primary) transition-colors hover:bg-(--earist-surface-light-red)"
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
