"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { getClientBackendBaseUrl } from "@/lib/backend-origin.client";
import { startExamImageRequest } from "@/lib/exam-media.client";
import { Button } from "@/components/ui/button";

function AuthenticatedImage({
  mediaId,
  token,
  alt,
  onRetry,
}: {
  mediaId: string;
  token: string;
  alt: string;
  onRetry: () => void;
}) {
  const [image, setImage] = useState<{
    url: string | null;
    error: string | null;
  }>({ url: null, error: null });
  const release = useRef<() => void>(() => {});
  useEffect(() => {
    const cleanup = startExamImageRequest({
      baseUrl: getClientBackendBaseUrl,
      mediaId,
      token,
      onLoad: (url) => setImage({ url, error: null }),
      onError: (error) => setImage({ url: null, error }),
      onSessionExpired: () => {
        void signOut({ callbackUrl: "/login" });
      },
    });
    release.current = cleanup;
    return cleanup;
  }, [mediaId, token]);

  if (image.error)
    return (
      <div
        role="alert"
        className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
      >
        {image.error}{" "}
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry image
        </Button>
      </div>
    );
  if (!image.url)
    return (
      <p role="status" className="rounded bg-gray-50 p-3 text-sm text-gray-600">
        Loading image…
      </p>
    );
  return (
    <Image
      src={image.url}
      alt={alt}
      width={1024}
      height={768}
      unoptimized
      onError={() => {
        release.current();
        setImage({
          url: null,
          error:
            "This image could not be displayed. Try replacing it with a valid PNG or JPEG.",
        });
      }}
      className="h-auto max-h-80 w-auto max-w-full object-contain"
    />
  );
}

/** Receives opaque identity only; each token/identity/retry owns its blob lifetime. */
export function ExamMediaImage({
  mediaId,
  alt,
}: {
  mediaId: string;
  alt: string;
}) {
  const { data: session, status } = useSession();
  const [attempt, setAttempt] = useState(0);
  const token = session?.user?.accessToken;
  if (!token)
    return (
      <p role="status" className="text-sm text-gray-600">
        {status === "loading"
          ? "Loading image…"
          : "Sign in to view this image."}
      </p>
    );
  return (
    <AuthenticatedImage
      key={`${mediaId}:${token}:${attempt}`}
      mediaId={mediaId}
      token={token}
      alt={alt}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
