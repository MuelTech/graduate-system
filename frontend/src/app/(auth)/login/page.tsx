"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { GraduationCap, Eye, EyeOff, AlertCircle } from "lucide-react";

type UserRole = "applicant" | "student" | "admin" | "panelist" | "other";

const roles: { value: UserRole; label: string }[] = [
  { value: "applicant", label: "Applicant" },
  { value: "student", label: "Student" },
  { value: "admin", label: "Administrator" },
  { value: "panelist", label: "Panelist" },
  { value: "other", label: "Other Roles" },
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("applicant");
  const [showPassword, setShowPassword] = useState(false);
  const [applicantId, setApplicantId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const clearFields = () => {
    setApplicantId("");
    setStudentId("");
    setBirthdate("");
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
      if (!studentId) return setError("Student ID is required.");
      if (!birthdate) return setError("Date of Birth is required.");
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
      const res = await signIn("credentials", {
        redirect: false,
        role: role,
        email: email,
        password: password,
        applicantId: applicantId,
        studentId: studentId,
        birthdate: birthdate,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push(`/${role}/dashboard`); // Successfully logged in! Redirect to dashboard/home.
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm scale-105"
        style={{ backgroundImage: "url('/images/campus-hero.jpg')" }}
      />
      <div className="absolute inset-0 bg-[var(--earist-primary)]/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-[420px] px-4 py-12">
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
            <CardDescription>Information System</CardDescription>
          </CardHeader>
          <CardContent>
            <h2
              className="mb-6 text-center text-xl font-bold text-[var(--earist-secondary)]"
              style={{ fontFamily: '"Calibri", sans-serif' }}
            >
              Sign In to Your Portal
            </h2>

            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role Selector */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                  Login As
                </label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-[var(--earist-border-gray)] px-4 py-3 text-sm transition-colors focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
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
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
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
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Student ID
                    </label>
                    <Input
                      type="text"
                      value={studentId}
                      onChange={(e) => {
                        setStudentId(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Enter your Student ID"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
                      Date of Birth
                    </label>
                    <Input
                      type="date"
                      value={birthdate}
                      onChange={(e) => {
                        setBirthdate(e.target.value);
                        if (error) setError("");
                      }}
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

              {/* Admin / Panelist / Other Fields */}
              {(role === "admin" ||
                role === "panelist" ||
                role === "other") && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
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
                className="w-full bg-[var(--earist-accent)] text-[var(--earist-primary)] hover:bg-[var(--earist-accent)]/90"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/forgot-password"
                className="text-sm text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)] hover:underline"
              >
                Forgot your password?
              </Link>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--earist-border-gray)]" />
              <span className="text-xs text-[var(--earist-body-text)]">or</span>
              <div className="h-px flex-1 bg-[var(--earist-border-gray)]" />
            </div>

            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--earist-primary)] py-2.5 text-sm font-semibold text-[var(--earist-primary)] transition-colors hover:bg-[var(--earist-surface-light-red)]"
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
      <label className="mb-1.5 block text-sm font-semibold text-[var(--earist-secondary)]">
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
          className="pr-10"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--earist-body-text)] transition-colors hover:text-[var(--earist-primary)]"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
