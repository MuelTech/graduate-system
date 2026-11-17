"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { TermsModal } from "@/components/common/terms-modal";
import { getClientBackendBaseUrl } from "@/lib/backend-origin.client";
import { toast } from "sonner";

export function TermsGate({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession();
  const [hasDismissedLocally, setHasDismissedLocally] = useState(false);

  // User is authenticated, hasAcceptedTerms is explicitly false, and hasn't just accepted in local state
  const isEnforcementNeeded = Boolean(
    session?.user && session.user.hasAcceptedTerms === false && !hasDismissedLocally
  );

  const handleAcceptTerms = async () => {
    try {
      const apiUrl = getClientBackendBaseUrl();
      const res = await fetch(`${apiUrl}/api/auth/accept-terms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.user?.accessToken}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to accept terms. Please try again.");
        return;
      }

      setHasDismissedLocally(true);
      toast.success("Thank you for accepting the Terms and Conditions.");

      // Refresh NextAuth session so hasAcceptedTerms updates in the JWT/session
      await update({ hasAcceptedTerms: true });
    } catch (err) {
      console.error("Error accepting terms:", err);
      toast.error("A network error occurred. Please try again.");
    }
  };

  return (
    <>
      {children}
      <TermsModal
        open={isEnforcementNeeded}
        isEnforcedGate={true}
        onAccept={handleAcceptTerms}
      />
    </>
  );
}
