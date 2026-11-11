"use client";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
import { GraduationCap, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center blur-sm"
        style={{ backgroundImage: "url('/images/campus-hero.jpg')" }}
      />
      <div className="absolute inset-0 bg-(--earist-primary)/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-105 px-4 py-12">
        <Card className="border-gray-100 shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e02b20]/10">
              <GraduationCap className="h-9 w-9 text-[#e02b20]" />
            </div>
            <CardTitle className="text-lg font-bold text-[#333333]">
              EARIST Graduate School
            </CardTitle>
            <CardDescription className="text-gray-500">Information System</CardDescription>
          </CardHeader>
          <CardContent>
            <h2 className="mb-6 text-center text-xl font-bold text-[#333333]">
              Sign In to Your Portal
            </h2>

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

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Login As
                </label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#333333] transition-colors focus:border-[#e02b20] focus:ring-2 focus:ring-[#e02b20]/20 focus:outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Applicant Fields */}
              {role === "applicant" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Applicant ID
                    </label>
                    <Input
                      type="text"
                      value={applicantId}
                      onChange={(e) => {
                        setApplicantId(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Enter your Applicant ID"
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
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Student Number
                    </label>
                    <Input
                      type="text"
                      value={studentNumber}
                      onChange={(e) => {
                        setStudentNumber(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Enter your Student Number"
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
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="your.email@earist.edu.ph"
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
                className="w-full bg-[#e02b20] font-semibold text-white hover:bg-[#c62828]"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-gray-500 transition-colors hover:text-[#e02b20] hover:underline"
              >
                Forgot your password?
              </Link>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-semibold text-[#333333] transition-colors hover:border-[#e02b20]/40 hover:bg-[#e02b20]/5 hover:text-[#e02b20]"
            >
              New applicant? Apply here
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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
        Password
      </label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          className="pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
        />
        <button
          type="button"
          onClick={toggleShow}
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
    <div className="flex min-h-screen items-center justify-center bg-(--earist-primary)" />
  );
}
