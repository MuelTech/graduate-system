"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * CP6 compatibility: prototype scoring detail redirects to Defense Workspace.
 * The [id] param is the scheduleId used by the legacy scoring route.
 */
export default function ScoringRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    if (params?.id) {
      router.replace(`/panelist/defense-workspace/${params.id}`);
    }
  }, [params?.id, router]);
  return (
    <div className="p-8 text-center text-sm text-(--earist-body-text)">
      Opening Defense Workspace…
    </div>
  );
}
