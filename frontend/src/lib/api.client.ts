import { getSession, signOut } from "next-auth/react";

export const apiClientRequest = async (
  url: string,
  options: RequestInit = {},
) => {
  const session = await getSession();
  const token = session?.user?.accessToken;

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const apiUrl =
    process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";
  const response = await fetch(`${apiUrl}/api${url}`, {
    ...options,
    headers,
  });

  // Automatically force logout if the backend rejects the token
  if (response.status === 401 || response.status === 403) {
    if (typeof window !== "undefined") {
      signOut({ callbackUrl: "/login" });
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Something went wrong");
  }

  return response.json();
};
