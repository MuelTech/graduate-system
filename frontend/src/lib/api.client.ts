import { getSession, signOut } from "next-auth/react";
import { ApiError } from "./api-error";
export { ApiError } from "./api-error";

import { getClientBackendBaseUrl } from "./backend-origin.client";

export const apiClientRequest = async (
  url: string,
  options: RequestInit = {},
) => {
  const session = await getSession();
  if (session?.user?.currentAccountError) {
    throw new ApiError("Current account access is unavailable.",
      session.user.currentAccountError === "ACCOUNT_FORBIDDEN" ? 403 : 503);
  }
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

  // Automatically force logout if the backend rejects the token
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      signOut({ callbackUrl: "/login" });
    }
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  // Refresh the server-derived session on denial without destroying a valid login.
  if (response.status === 403) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("faculty-access-changed"));
    try { await getSession(); } catch { /* Preserve the original forbidden response. */ }
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
