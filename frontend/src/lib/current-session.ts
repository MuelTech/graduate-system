export type CurrentSessionError = "ACCOUNT_FORBIDDEN" | "ACCOUNT_UNAVAILABLE";

export interface SessionIdentity {
  id: string;
  role: string;
  accessToken: string;
  mustChangePassword: boolean;
  email?: string | null;
  currentAccountError?: CurrentSessionError;
}

/** Run on every session read/update. Client update payloads never supply authority. */
export async function synchronizeCurrentSession<T extends SessionIdentity>(
  token: T, backendUrl: string,
): Promise<T | null> {
  const unavailable = (error: CurrentSessionError): T => ({
    ...token, role: "", mustChangePassword: true, currentAccountError: error,
  });
  try {
    const response = await fetch(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) return null;
    if (response.status === 403) return unavailable("ACCOUNT_FORBIDDEN");
    if (!response.ok) return unavailable("ACCOUNT_UNAVAILABLE");
    const { user } = await response.json();
    if (!user || user.id !== token.id || typeof user.email !== "string" ||
      !["APPLICANT", "STUDENT", "PANELIST", "FACULTY", "ADMIN", "CUSTOM"].includes(user.role) ||
      typeof user.mustChangePassword !== "boolean") return unavailable("ACCOUNT_UNAVAILABLE");
    return {
      ...token, role: user.role.toLowerCase(), email: user.email,
      mustChangePassword: user.mustChangePassword, currentAccountError: undefined,
    };
  } catch {
    return unavailable("ACCOUNT_UNAVAILABLE");
  }
}
