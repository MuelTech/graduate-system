import { auth } from "@/auth";
import { redirect } from "next/navigation";

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

  const apiUrl = process.env.BACKEND_API_URL || "http://localhost:5000";
  const response = await fetch(`${apiUrl}/api${url}`, {
    ...options,
    headers,
  });

  // Gracefully redirect the user rather than throwing an error boundary crash
  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server API error: ${response.status}`);
  }

  return response.json();
};
