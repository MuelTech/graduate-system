"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { getClientBackendBaseUrl } from "@/lib/backend-origin.client";
import {
  ArrowLeft,
  ArrowUpRight,
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

const stepLabels = ["Applicant ID", "Personal Info", "Program", "Password"];

const PH_MOBILE_REGEX = /^\+639\d{9}$/;

function extractPhilippineMobileSuffix(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length > 2) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function toPhilippineMobileValue(raw: string): string {
  const suffix = extractPhilippineMobileSuffix(raw);
  return suffix ? `+63${suffix}` : "";
}

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
    programId: "",
    programType: "Masters",
    password: "",
    confirmPassword: "",
  });

  const [isLoaded, setIsLoaded] = useState(false);

  const [graduateProgramsList, setGraduateProgramsList] = useState<
    { id: string; programName: string; programType: string }[]
  >([]);

  useEffect(() => {
    // 1. Restore draft progress on initial load
    const draft = localStorage.getItem("registrationDraft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setTimeout(() => {
          if (parsed.step !== undefined) setStep(parsed.step);
          if (parsed.formData) {
            setFormData((prev) => ({
              ...prev,
              ...parsed.formData,
              cellphone: parsed.formData.cellphone
                ? toPhilippineMobileValue(String(parsed.formData.cellphone))
                : "",
              password: "",
              confirmPassword: "",
            }));
          }
          setIsLoaded(true);
        }, 0);
      } catch (e) {
        console.error("Failed to parse registration draft", e);
        setTimeout(() => setIsLoaded(true), 0);
      }
    } else {
      setTimeout(() => setIsLoaded(true), 0);
    }

    // 2. Fetch programs
    const fetchPrograms = async () => {
      try {
        const apiUrl = getClientBackendBaseUrl();
        const res = await fetch(`${apiUrl}/api/programs`);
        if (res.ok) {
          const data = await res.json();
          setGraduateProgramsList(data.graduatePrograms);
        }
      } catch (err) {
        console.error("Failed to fetch programs", err);
      }
    };
    fetchPrograms();
  }, []);

  // Save progress to localStorage whenever step or form data changes
  useEffect(() => {
    if (isLoaded) {
      const { ...safeFormData } = formData;
      localStorage.setItem("registrationDraft", JSON.stringify({ step, formData: safeFormData }));
    }
  }, [step, formData, isLoaded]);

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
        if (!PH_MOBILE_REGEX.test(formData.cellphone)) {
          setError(
            "Please enter a valid 10-digit Philippine mobile number starting with 9 (e.g., +63 9171234567).",
          );
          return false;
        }
        break;
      case 2:
        if (!formData.programId) {
          setError("Intended Program is required.");
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
      const apiUrl = getClientBackendBaseUrl();
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

      // Clear the draft on successful registration
      localStorage.removeItem("registrationDraft");
      setIsSubmitted(true);
    } catch {
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#8b1a1a]/85 via-[#6e1414]/80 to-[#262220]/85 backdrop-blur-sm" />

        <div className="relative z-10 w-full max-w-[480px] px-4 py-10">
          <Card className="overflow-hidden border-gray-200/80 border-t-4 border-t-[#8b1a1a] bg-white shadow-2xl">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white p-0.5 shadow-sm ring-2 ring-[#8b1a1a]/20">
                <Image
                  src="/images/landing/earist-logo.jpg"
                  alt="EARIST seal"
                  width={56}
                  height={56}
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-7 w-7 text-emerald-600" />
              </div>
              <h1 className="mb-1.5 text-2xl font-bold text-[#262220]">
                Exam Account Created
              </h1>
              <p className="mb-6 text-sm text-gray-600">
                Your applicant account for the online Entrance Examination is ready.
              </p>

              <div className="mb-6 rounded-xl border border-[#d4a843]/40 bg-[#FFF8F0] p-4 text-left">
                <div className="mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-[#8b1a1a]" aria-hidden="true" />
                  <p className="text-sm font-bold text-[#262220]">
                    What happens next:
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    "Sign in to the Applicant Portal using your Applicant ID and password.",
                    "Select an available Entrance Examination schedule for your program.",
                    "Take the online Entrance Examination on your scheduled date.",
                    "View your official examination result in the portal once evaluation is complete.",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e02b20] text-xs font-bold text-white">
                        {i + 1}
                      </div>
                      <p className="pt-0.5 text-sm leading-snug text-[#4a4a5a]">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href="/login"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#e02b20] text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#b71c1c]"
              >
                Sign In to Your Portal
              </Link>
            </CardContent>
          </Card>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Home
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
      <div className="absolute inset-0 bg-gradient-to-br from-[#8b1a1a]/85 via-[#6e1414]/80 to-[#262220]/85 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-[500px] px-4 py-10">
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
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-[#8b1a1a]">
              Online Entrance Examination Registration
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {/* Step Progress */}
            <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-[#8b1a1a]/10 px-2.5 py-0.5 text-xs font-semibold text-[#8b1a1a]">
                  Step {step + 1} of 4
                </span>
                <span className="text-xs font-semibold text-[#262220]">
                  {stepTitles[step]}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {stepLabels.map((label, s) => (
                  <div key={label} className="space-y-1.5">
                    <div
                      className={`h-1.5 w-full rounded-full transition-colors ${
                        s < step
                          ? "bg-emerald-600"
                          : s === step
                            ? "bg-[#e02b20]"
                            : "bg-gray-200"
                      }`}
                    />
                    <p
                      className={`hidden text-center text-[11px] font-medium sm:block ${
                        s === step
                          ? "font-semibold text-[#262220]"
                          : s < step
                            ? "text-emerald-700"
                            : "text-gray-400"
                      }`}
                    >
                      {s + 1}. {label}
                    </p>
                  </div>
                ))}
              </div>
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
                  <div className="rounded-xl border border-[#d4a843]/40 bg-[#FFF8F0] p-4 text-sm text-[#4a4a5a]">
                    <div className="flex items-start gap-2.5">
                      <Info
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#8b1a1a]"
                        aria-hidden="true"
                      />
                      <div className="space-y-2 leading-relaxed">
                        <p>
                          Enter the <strong className="text-[#262220]">Applicant ID</strong>{" "}
                          issued from the EARIST Admissions Portal to create your
                          account for the online Entrance Examination.
                        </p>
                        <p className="text-xs text-gray-600">
                          Don&apos;t have an Applicant ID yet?{" "}
                          <a
                            href="https://ap.earist.edu.ph/login_applicant"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 font-semibold text-[#8b1a1a] underline decoration-[#8b1a1a]/40 underline-offset-2 transition-colors hover:text-[#e02b20]"
                          >
                            Apply via EARIST Admissions Portal
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="register-applicant-id"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Applicant ID <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="register-applicant-id"
                      type="text"
                      value={formData.applicantId}
                      onChange={(e) =>
                        updateForm("applicantId", e.target.value)
                      }
                      placeholder="Enter your Applicant ID"
                      className="h-10"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Step 1: Personal Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="register-first-name"
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                      >
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="register-first-name"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) =>
                          updateForm("firstName", e.target.value)
                        }
                        placeholder="First Name"
                        className="h-10"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="register-last-name"
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                      >
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="register-last-name"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => updateForm("lastName", e.target.value)}
                        placeholder="Last Name"
                        className="h-10"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="register-email"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="register-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="h-10"
                      required
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      Gmail only (used for official exam updates)
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="register-cellphone"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Cellphone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex h-10 w-full overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors focus-within:border-[#e02b20] focus-within:ring-2 focus-within:ring-[#e02b20]/20">
                      <span className="inline-flex items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-[#333333] select-none">
                        +63
                      </span>
                      <input
                        id="register-cellphone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={13}
                        value={extractPhilippineMobileSuffix(formData.cellphone)}
                        onChange={(e) =>
                          updateForm(
                            "cellphone",
                            toPhilippineMobileValue(e.target.value),
                          )
                        }
                        placeholder="9171234567"
                        className="h-full w-full flex-1 bg-transparent px-3 text-sm text-[#333333] placeholder:text-gray-400 focus:outline-none"
                        required
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Enter 10-digit Philippine mobile number starting with 9 (e.g., +63 9171234567)
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Program Selection */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Program Type <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {["Masters", "Doctoral"].map((type) => {
                        const active = formData.programType === type;
                        return (
                          <Button
                            key={type}
                            type="button"
                            variant={active ? "default" : "outline"}
                            onClick={() => {
                              updateForm("programType", type);
                              updateForm("programId", "");
                            }}
                            className={`h-10 font-semibold ${
                              active
                                ? "bg-[#e02b20] text-white hover:bg-[#b71c1c]"
                                : "border-gray-200 bg-white text-[#333333] hover:bg-gray-50"
                            }`}
                          >
                            {type}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const mastersPrograms = graduateProgramsList.filter(
                      (p) => p.programType === "MASTERS",
                    );
                    const doctoralPrograms = graduateProgramsList.filter(
                      (p) => p.programType === "DOCTORAL",
                    );

                    const isDoctoral = formData.programType === "Doctoral";
                    const intendedProgramList = isDoctoral
                      ? doctoralPrograms
                      : mastersPrograms;

                    const intendedProgramLabel = isDoctoral
                      ? "Intended Doctorate Program"
                      : "Intended Masters Program";

                    const selectedProgram = intendedProgramList.find(
                      (p) => p.id === formData.programId,
                    );

                    return (
                      <div>
                        <label
                          htmlFor="register-program"
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                        >
                          {intendedProgramLabel}{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <Select
                          value={formData.programId || null}
                          onValueChange={(value) =>
                            updateForm("programId", value ?? "")
                          }
                        >
                          <SelectTrigger
                            id="register-program"
                            className="w-full py-2.5 text-left whitespace-normal data-[size=default]:h-auto data-[size=default]:min-h-10"
                          >
                            <span
                              className={`flex-1 leading-snug ${
                                selectedProgram
                                  ? "text-[#333333]"
                                  : "text-gray-400"
                              }`}
                            >
                              {selectedProgram
                                ? selectedProgram.programName
                                : "Select a program"}
                            </span>
                          </SelectTrigger>
                          <SelectContent
                            alignItemWithTrigger={false}
                            className="max-h-72 w-(--anchor-width)"
                          >
                            {intendedProgramList.map((p) => (
                              <SelectItem
                                key={p.id}
                                value={p.id}
                                className="items-start py-2 [&>*:first-child]:shrink [&>*:first-child]:whitespace-normal [&>*:first-child]:leading-snug [&>div]:shrink [&>div]:whitespace-normal [&>div]:leading-snug"
                              >
                                {p.programName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Step 3: Account Setup */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="register-password"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => updateForm("password", e.target.value)}
                        placeholder="Create a password"
                        required
                        className="h-10 pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-colors hover:text-[#333333]"
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
                    <label
                      htmlFor="register-confirm-password"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="register-confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          updateForm("confirmPassword", e.target.value)
                        }
                        placeholder="Confirm your password"
                        required
                        className="h-10 pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-colors hover:text-[#333333]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-7 flex items-center justify-between gap-3">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep(step - 1);
                      setError(""); // Clear error on back navigation
                    }}
                    className="h-10 border-gray-200 text-gray-700 hover:bg-gray-50"
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
                    className="h-10 bg-[#e02b20] px-5 font-semibold text-white shadow-xs hover:bg-[#b71c1c]"
                  >
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 bg-[#e02b20] px-5 font-semibold text-white shadow-xs hover:bg-[#b71c1c] disabled:opacity-70"
                  >
                    {isSubmitting ? "Creating Account..." : "Create Exam Account"}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Already registered?
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <Link
              href="/login"
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-[#333333] transition-colors hover:border-[#8b1a1a]/40 hover:bg-[#8b1a1a]/5 hover:text-[#8b1a1a]"
            >
              Sign In to Your Portal
            </Link>
          </CardContent>
        </Card>

        <div className="mt-5 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/85 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
