"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { getClientBackendBaseUrl } from "@/lib/backend-origin.client";
import { startFacultyEssayImageRequest } from "@/lib/faculty-essay-media.client";
import { FACULTY_ACCESS_CHANGED } from "@/lib/faculty-access";
import { Button } from "@/components/ui/button";

function AuthenticatedEssayImage({
  applicationId,
  mediaId,
  token,
  retry,
}: {
  applicationId: string;
  mediaId: string;
  token: string;
  retry: () => void;
}) {
  const [state, setState] = useState<{ url?: string; error?: boolean }>({});
  const release = useRef<() => void>(() => {});
  useEffect(() => {
    const cleanup = startFacultyEssayImageRequest({
      baseUrl: getClientBackendBaseUrl(),
      applicationId,
      mediaId,
      token,
      onLoad: (url) => setState({ url }),
      onError: () => setState({ error: true }),
      onUnauthorized: () => {
        void signOut({ callbackUrl: "/login" });
      },
      onForbidden: () =>
        window.dispatchEvent(new Event(FACULTY_ACCESS_CHANGED)),
    });
    release.current = cleanup;
    return cleanup;
  }, [applicationId, mediaId, token]);
  if (state.error)
    return (
      <div role="alert" className="space-y-2">
        <p>Essay image is unavailable.</p>
        <Button variant="outline" onClick={retry}>
          Retry image
        </Button>
      </div>
    );
  if (!state.url) return <p role="status">Loading essay image…</p>;
  return (
    <Image
      src={state.url}
      alt="Essay question stimulus"
      width={1024}
      height={768}
      unoptimized
      className="h-auto max-h-[32rem] w-auto max-w-full object-contain"
      onError={() => {
        release.current();
        setState({ error: true });
      }}
    />
  );
}

export function FacultyEssayImage({
  applicationId,
  mediaId,
}: {
  applicationId: string;
  mediaId: string;
}) {
  const { data: session } = useSession();
  const [attempt, setAttempt] = useState(0);
  const token = session?.user?.accessToken;
  if (!token) return <p role="status">Loading essay image…</p>;
  return (
    <AuthenticatedEssayImage
      key={`${applicationId}:${mediaId}:${token}:${attempt}`}
      applicationId={applicationId}
      mediaId={mediaId}
      token={token}
      retry={() => setAttempt((value) => value + 1)}
    />
  );
}
