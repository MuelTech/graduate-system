"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Download, Clock, CheckCircle2, AlertTriangle, Printer } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { getSession } from "next-auth/react";
import { useState } from "react";

export default function ApplicantAlignmentPage() {
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  // 1. Fetch Applicant Profile (to get their alignmentStatus)
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["applicant-profile"],
    queryFn: async () => await apiClientRequest("/applicant/profile"),
  });

  // 2. Fetch Waiver Details (only if they are pending a waiver)
  const { data: waiver, isLoading: isWaiverLoading } = useQuery({
    queryKey: ["my-waiver"],
    queryFn: async () => await apiClientRequest("/waivers/me"),
    enabled: profile?.alignmentStatus === "pending_waiver",
  });

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const session = await getSession();
      const token = session?.user?.accessToken;
      
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/waivers/me/download`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to download waiver");
      }

      // Turn response into a downloadable PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bridging-Waiver-${profile?.firstName || "Form"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Refresh the waiver data so the UI updates to show it was downloaded
      queryClient.invalidateQueries({ queryKey: ["my-waiver"] });
    } catch (error) {
      console.error("Error downloading waiver:", error);
      alert("Something went wrong while generating the PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isProfileLoading) {
    return <div className="p-8 text-center text-(--earist-body-text)">Loading alignment status...</div>;
  }

  const isAligned = profile?.alignmentStatus === "aligned" || profile?.alignmentStatus === "cleared";

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Program Alignment
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Check your program alignment status and bridging waiver requirements.
        </p>
      </div>

      <div className="rounded-lg border border-(--earist-border-gray) bg-white p-8">
        
        {/* SUCCESS STATE */}
        {isAligned && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-green-700">
              Program Alignment Cleared
            </h3>
            <p className="mb-6 text-sm text-(--earist-body-text)">
              Congratulations! Your undergraduate degree is aligned with your intended master&apos;s program (or your waiver has been approved). You do not need to take any bridging subjects.
            </p>
          </div>
        )}

        {/* PENDING WAIVER STATE */}
        {!isAligned && (
          <div className="text-center max-w-2xl mx-auto">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-amber-700">
              Bridging Subjects Required
            </h3>
            <p className="mb-6 text-sm text-(--earist-body-text)">
              Your undergraduate course does not perfectly align with your intended Master&apos;s program. You are required to submit a signed Bridging Waiver before you can schedule your entrance exam.
            </p>

            <div className="bg-(--earist-surface-gray) rounded-lg p-6 text-left space-y-4 mb-6 border border-(--earist-border-gray)">
              <h4 className="font-semibold text-(--earist-secondary) flex items-center gap-2">
                <Printer className="h-4 w-4" /> Next Steps:
              </h4>
              <ol className="list-decimal list-inside text-sm text-(--earist-body-text) space-y-2">
                <li>Click the button below to download your auto-filled Bridging Waiver form.</li>
                <li>Print the downloaded PDF document.</li>
                <li>Sign your name at the bottom of the printed document.</li>
                <li>Submit the physical hardcopy to the Graduate School Office.</li>
              </ol>
            </div>

            {/* If they haven't downloaded it yet */}
            {!waiver?.waiverFormDownloadedAt && (
              <Button 
                onClick={handleDownload} 
                disabled={isDownloading}
                className="bg-(--earist-primary) hover:bg-(--earist-primary)/90 text-white font-bold w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" /> 
                {isDownloading ? "Generating PDF..." : "Download Bridging Form"}
              </Button>
            )}

            {/* If they have already downloaded it */}
            {waiver?.waiverFormDownloadedAt && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
                <div className="flex gap-3">
                  <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <h5 className="font-semibold text-blue-800 text-sm">Form Downloaded & Pending Submission</h5>
                    <p className="text-xs text-blue-700 mt-1">
                      You downloaded the form on {new Date(waiver.waiverFormDownloadedAt).toLocaleString()}. 
                      <br/>Please submit the signed physical copy to the GS Office. An administrator will unlock your account once received.
                    </p>
                    <button 
                      onClick={handleDownload} 
                      className="text-xs text-blue-800 underline font-semibold mt-3 hover:text-blue-600"
                    >
                      Need another copy? Download again.
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/applicant/dashboard"
            className="inline-flex items-center gap-1 text-sm font-semibold text-(--earist-secondary) transition-colors hover:text-(--earist-primary)"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
