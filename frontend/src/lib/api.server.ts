import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ApiError } from "./api-error";

import { getServerBackendBaseUrl } from "./backend-origin.server";

export const apiServerRequest = async (
  url: string,
  options: RequestInit = {},
) => {
  const session = await auth();
  if (session?.user?.currentAccountError) {
    throw new ApiError("Current account access is unavailable.",
      session.user.currentAccountError === "ACCOUNT_FORBIDDEN" ? 403 : 503);
  }
  const token = session?.user?.accessToken;

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const apiUrl = getServerBackendBaseUrl();
  const response = await fetch(`${apiUrl}/api${url}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  // Gracefully redirect the user rather than throwing an error boundary crash
  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.error || `Server API error: ${response.status}`, response.status, errorData.missing);
  }

  return response.json();
};
