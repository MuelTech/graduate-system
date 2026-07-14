"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Send, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export default function AdviserRequestPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [facultyId, setFacultyId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasPendingRequest, setHasPendingRequest] = useState<boolean | null>(null);

  // Fetch the current journey to see if there is already a pending request
  useEffect(() => {
    if (!session?.user?.accessToken) return;
    
    const fetchJourney = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/student/journey", {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const pending = data?.adviserRequests?.some((req: { status: string }) => req.status === "PENDING");
          setHasPendingRequest(pending || false);
        } else {
          setHasPendingRequest(false);
        }
      } catch(err) {
        setHasPendingRequest(false);
        console.error("Error:", err);
      }
    };
    
    fetchJourney();
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyId) return;

    setStatus("loading");
    try {
      const res = await fetch(
        "http://localhost:5000/api/thesis/adviser/request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.user?.accessToken}`,
          },
          body: JSON.stringify({
            requestedAdviserId: facultyId.trim(),
            reason: remarks.trim(),
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");

      setStatus("success");
      // Redirect back to the pipeline after 2 seconds
      setTimeout(() => router.push("/student/thesis"), 2000);
    } catch (err) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred");
      }
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Request Thesis Adviser
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          You must secure an approved faculty adviser before you can apply for
          your Title Defense.
        </p>
      </div>

      {hasPendingRequest === null && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Checking your request status...
          </CardContent>
        </Card>
      )}

      {hasPendingRequest === true && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-amber-900">
              Request Pending Admin Approval
            </h3>
            <p className="text-sm text-amber-700">
              You have already successfully submitted an adviser request. We are currently waiting for the admin to approve and formally assign your requested faculty member.
            </p>
            <Button
              className="mt-6 bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => router.push("/student/thesis")}
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {hasPendingRequest === false && (
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-(--earist-secondary)">
            <UserPlus className="h-5 w-5" />
            Adviser Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {status === "error" && (
              <Alert
                variant="destructive"
                className="border-red-200 bg-red-50 text-red-600"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {status === "success" && (
              <Alert className="border-green-200 bg-green-50 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Request submitted successfully! The admin must now approve it.
                  Redirecting...
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                Faculty User ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={status === "loading" || status === "success"}
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                placeholder="Paste the Faculty UUID here (e.g. 550e8400-e29b-...)"
                className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                *We will replace this with a beautiful searchable dropdown once
                the Users API is built in Phase 5.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                Request Remarks (Optional)
              </label>
              <textarea
                rows={3}
                disabled={status === "loading" || status === "success"}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Briefly explain your research interest..."
                className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
              />
            </div>

            <Button
              type="submit"
              disabled={
                status === "loading" || status === "success" || !facultyId
              }
              className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
            >
              <Send className="mr-2 h-4 w-4" />
              {status === "loading" ? "Submitting..." : "Send Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
