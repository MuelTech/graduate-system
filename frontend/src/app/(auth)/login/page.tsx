"use client";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { GraduationCap, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

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
  const searchParams = useSearchParams();
  const [role, setRole] = useState<UserRole>("applicant");
  const [showPassword, setShowPassword] = useState(false);
  const [applicantId, setApplicantId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("passwordChanged") === "true") {
      setSuccess("Password changed successfully! Please login with your new password.");
    }
  }, [searchParams]);

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
        if (res.error === "CredentialsSignin") {
          setError(
            "Invalid credentials. Please check your details and try again.",
          );
        } else {
          setError("An error occurred during sign in.");
        }
      } else {
        router.push(`/${role}/dashboard`); // Successfully logged in! Redirect to dashboard/home.
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
            <CardDescription>Information System</CardDescription>
          </CardHeader>
          <CardContent>
            <h2
              className="mb-6 text-center text-xl font-bold text-(--earist-secondary)"
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

            {success && (
              <Alert className="mb-5 border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role Selector */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
                  Login As
                </label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-(--earist-border-gray) px-4 py-3 text-sm transition-colors focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
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
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                    <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
                className="w-full bg-(--earist-accent) text-(--earist-primary) hover:bg-(--earist-accent)/90"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/forgot-password"
                className="text-sm text-(--earist-secondary) transition-colors hover:text-(--earist-primary) hover:underline"
              >
                Forgot your password?
              </Link>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-(--earist-border-gray)" />
              <span className="text-xs text-(--earist-body-text)">or</span>
              <div className="h-px flex-1 bg-(--earist-border-gray)" />
            </div>

            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center rounded-lg border border-(--earist-primary) py-2.5 text-sm font-semibold text-(--earist-primary) transition-colors hover:bg-(--earist-surface-light-red)"
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
      <label className="mb-1.5 block text-sm font-semibold text-(--earist-secondary)">
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
          className="absolute top-1/2 right-3 -translate-y-1/2 text-(--earist-body-text) transition-colors hover:text-(--earist-primary)"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
