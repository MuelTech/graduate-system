import { getSession, signOut } from "next-auth/react";
import type { MissingRequirement } from "@/types";

import { getClientBackendBaseUrl } from "./backend-origin.client";

export class ApiError extends Error {
  missing?: MissingRequirement[];
  statusCode?: number;

  constructor(message: string, statusCode?: number, missing?: MissingRequirement[]) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.missing = missing;
  }
}

export const apiClientRequest = async (
  url: string,
  options: RequestInit = {},
) => {
  const session = await getSession();
  const token = session?.user?.accessToken;

  const headers = new Headers(options.headers);
  // FormData must let the browser set multipart boundary — do not force JSON.
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const apiUrl = getClientBackendBaseUrl();
  const response = await fetch(`${apiUrl}/api${url}`, {
    ...options,
    headers,
  });

  // Automatically force logout if the backend rejects the token or invalidates the session
  if (response.status === 401 || response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    const code = typeof errorData?.code === "string" ? errorData.code : "";
    const callbackUrl =
      code === "ACCOUNT_DEACTIVATED"
        ? "/login?reason=deactivated"
        : code === "SESSION_INVALIDATED"
          ? "/login?reason=session_invalidated"
          : "/login";

    if (typeof window !== "undefined") {
      signOut({ callbackUrl });
    }
    throw new Error(
      typeof errorData?.error === "string" && errorData.error.trim().length > 0
        ? errorData.error
        : "Session expired. Please log in again.",
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || "Something went wrong",
      response.status,
      errorData.missing,
    );
  }

  return response.json();
};
