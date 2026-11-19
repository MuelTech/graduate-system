"use client";

import { useState } from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientRequest } from "@/lib/api.client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Lock } from "lucide-react";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await apiClientRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });

      // Sign out and redirect to login with success message
      await signOut({ callbackUrl: "/login?passwordChanged=true" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to change password";
      toast.error(message);
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
      <div className="absolute inset-0 bg-gradient-to-br from-[#8b1a1a]/85 via-[#6e1414]/80 to-[#262220]/85 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-[440px] px-4 py-10">
        <Card className="overflow-hidden border-gray-200/80 border-t-4 border-t-[#8b1a1a] bg-white shadow-2xl">
          <CardHeader className="pb-3 text-center">
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
            <div className="mt-2 flex items-center justify-center gap-2 text-[#262220]">
              <Lock className="h-4 w-4 text-[#8b1a1a]" aria-hidden="true" />
              <h1 className="text-xl font-bold">Change Your Password</h1>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              For security, please change your default password before continuing.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="newPassword"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-600"
                >
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={6}
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
                <p className="text-xs text-gray-500">Must be at least 6 characters</p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="confirmPassword"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-600"
                >
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
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

              <Button
                type="submit"
                disabled={isLoading || !newPassword || !confirmPassword}
                className="mt-2 h-10 w-full bg-[#e02b20] font-semibold text-white shadow-xs transition-colors hover:bg-[#b71c1c]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  "Continue to Dashboard"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
