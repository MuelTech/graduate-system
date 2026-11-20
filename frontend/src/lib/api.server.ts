import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { getServerBackendBaseUrl } from "./backend-origin.server";

export const apiServerRequest = async (
  url: string,
  options: RequestInit = {},
) => {
  const session = await auth();
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
  });

  // Gracefully redirect the user rather than throwing an error boundary crash
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}));
    const code = typeof errorData?.code === "string" ? errorData.code : "";
    redirect(
      code === "SESSION_INVALIDATED"
        ? "/login?reason=session_invalidated"
        : "/login",
    );
  }

  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    const code = typeof errorData?.code === "string" ? errorData.code : "";
    if (code === "ACCOUNT_DEACTIVATED") {
      redirect("/login?reason=deactivated");
    }
    throw new Error(errorData.error || `Server API error: ${response.status}`);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server API error: ${response.status}`);
  }

  return response.json();
};
