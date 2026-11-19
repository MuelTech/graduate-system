"use client";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

type UserRole = "applicant" | "student" | "faculty" | "admin";

const roles: { value: UserRole; label: string }[] = [
  { value: "applicant", label: "Applicant" },
  { value: "student", label: "Student" },
  { value: "faculty", label: "Faculty" },
  { value: "admin", label: "Administrator" },
];

export default function LoginPage() {
  // `useSearchParams()` requires a Suspense boundary at prerender time in the
  // Next.js App Router; the fallback is shown while the search params resolve.
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<UserRole>("applicant");
  const [showPassword, setShowPassword] = useState(false);
  const [applicantId, setApplicantId] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Derived directly from the URL (no effect/state): the "password changed"
  // confirmation is a property of the query string, not mutable local state.
  const success =
    searchParams.get("passwordChanged") === "true"
      ? "Password changed successfully! Please login with your new password."
      : "";

  const clearFields = () => {
    setApplicantId("");
    setStudentNumber("");
    setEmail("");
    setPassword("");
    setError("");
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    clearFields();
  };

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // --- Validation Logic ---
    if (role === "applicant") {
      if (!applicantId) return setError("Applicant ID is required.");
      if (!password) return setError("Password is required.");
    } else if (role === "student") {
      if (!studentNumber) return setError("Student Number is required.");
      if (!password) return setError("Password is required.");
    } else {
      if (!email) return setError("Email address is required.");
      if (!validateEmail(email))
        return setError("Please enter a valid email address.");
      if (!password) return setError("Password is required.");
    }

    setIsLoading(true);

    try {
      // --- NextAuth Sign-In Logic ---
      // COR-6 FIX1: send only the credentials for the selected role.
      let res: Awaited<ReturnType<typeof signIn>> | undefined;
      if (role === "applicant") {
        res = await signIn("credentials", {
          redirect: false,
          role,
          applicantId,
          password,
        });
      } else if (role === "student") {
        res = await signIn("credentials", {
          redirect: false,
          role,
          studentNumber,
          password,
        });
      } else {
        res = await signIn("credentials", {
          redirect: false,
          role,
          email,
          password,
        });
      }

      if (res?.error) {
        if (res.error === "CredentialsSignin") {
          setError(
            "Invalid credentials. Please check your details and try again.",
          );
        } else {
          setError("An error occurred during sign in.");
        }
      } else {
        const targetDashboard =
          role === "faculty" ? "/faculty/dashboard" : `/${role}/dashboard`;
        router.push(targetDashboard); // Successfully logged in! Redirect to dashboard/home.
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error(err)
    } finally {
      setIsLoading(false);
    }
  };

  const activeRole = roles.find((r) => r.value === role) ?? roles[0];

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
            <h1 className="mb-5 text-center text-xl font-bold text-[#262220]">
              Sign In to Your Portal
            </h1>

            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-5 border-emerald-200 bg-emerald-50 text-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selector */}
              <div>
                <label
                  htmlFor="login-role"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                >
                  Login As
                </label>
                <Select
                  value={role}
                  onValueChange={(value) => {
                    if (value) handleRoleChange(value as UserRole);
                  }}
                >
                  <SelectTrigger
                    id="login-role"
                    className="w-full data-[size=default]:h-10"
                  >
                    <span className="flex-1 text-left font-medium text-[#333333]">
                      {activeRole.label}
                    </span>
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className="w-(--anchor-width)"
                  >
                    {roles.map((r) => (
                      <SelectItem
                        key={r.value}
                        value={r.value}
                        className="py-2 text-sm font-medium"
                      >
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Applicant Fields */}
              {role === "applicant" && (
                <>
                  <div>
                    <label
                      htmlFor="login-applicant-id"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Applicant ID
                    </label>
                    <Input
                      id="login-applicant-id"
                      type="text"
                      value={applicantId}
                      onChange={(e) => {
                        setApplicantId(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Enter your Applicant ID"
                      className="h-10"
                      required
                    />
                  </div>
                  <PasswordInput
                    value={password}
                    onChange={(v) => {
                      setPassword(v);
                      if (error) setError("");
                    }}
                    show={showPassword}
                    toggleShow={() => setShowPassword(!showPassword)}
                  />
                </>
              )}

              {/* Student Fields */}
              {role === "student" && (
                <>
                  <div>
                    <label
                      htmlFor="login-student-number"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Student Number
                    </label>
                    <Input
                      id="login-student-number"
                      type="text"
                      value={studentNumber}
                      onChange={(e) => {
                        setStudentNumber(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Enter your Student Number"
                      className="h-10"
                      required
                    />
                  </div>
                  <PasswordInput
                    value={password}
                    onChange={(v) => {
                      setPassword(v);
                      if (error) setError("");
                    }}
                    show={showPassword}
                    toggleShow={() => setShowPassword(!showPassword)}
                  />
                </>
              )}

              {/* Admin / Faculty Fields */}
              {(role === "admin" || role === "faculty") && (
                <>
                  <div>
                    <label
                      htmlFor="login-email"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                    >
                      Email Address
                    </label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="your.email@earist.edu.ph"
                      className="h-10"
                      required
                      autoComplete="email"
                    />
                  </div>
                  <PasswordInput
                    value={password}
                    onChange={(v) => {
                      setPassword(v);
                      if (error) setError("");
                    }}
                    show={showPassword}
                    toggleShow={() => setShowPassword(!showPassword)}
                  />
                </>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="h-10 w-full bg-[#e02b20] font-semibold text-white shadow-xs transition-colors hover:bg-[#b71c1c]"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-gray-500 transition-colors hover:text-[#8b1a1a] hover:underline"
              >
                Forgot your password?
              </Link>
            </div>

            {role === "applicant" && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-medium tracking-wider text-gray-400 uppercase">
                    First-time examinee?
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5">
                  <Link
                    href="/register"
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#8b1a1a]/30 bg-white px-4 text-sm font-semibold text-[#8b1a1a] shadow-xs transition-colors hover:border-[#e02b20] hover:bg-[#e02b20]/5 hover:text-[#e02b20]"
                  >
                    Have an Applicant ID? Create Exam Account
                  </Link>
                  <p className="text-center text-xs leading-relaxed text-gray-600">
                    No Applicant ID yet?{" "}
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
              </>
            )}
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

function PasswordInput({
  value,
  onChange,
  show,
  toggleShow,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggleShow: () => void;
}) {
  return (
    <div>
      <label
        htmlFor="login-password"
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
      >
        Password
      </label>
      <div className="relative">
        <Input
          id="login-password"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          className="h-10 pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
        />
        <button
          type="button"
          onClick={toggleShow}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-colors hover:text-[#333333]"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** Neutral fallback while the login search params resolve during prerender. */
function LoginPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#8b1a1a]" />
  );
}
