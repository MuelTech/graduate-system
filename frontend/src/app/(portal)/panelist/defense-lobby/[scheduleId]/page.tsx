"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** CP6: Defense Lobby is retired — redirect to Defense Workspace. */
export default function DefenseLobbyRedirect() {
  const params = useParams<{ scheduleId: string }>();
  const router = useRouter();
  useEffect(() => {
    if (params?.scheduleId) {
      router.replace(`/panelist/defense-workspace/${params.scheduleId}`);
    }
  }, [params?.scheduleId, router]);
  return (
    <div className="p-8 text-center text-sm text-(--earist-body-text)">
      Opening Defense Workspace…
    </div>
  );
}
