import NextAuth, { CredentialsSignin } from "next-auth";
import type { Session, User } from "next-auth";
import type { JWT } from "@auth/core/jwt";
import Credentials from "next-auth/providers/credentials";

import { getServerBackendBaseUrl } from "@/lib/backend-origin.server";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        role: { type: "text" },
        email: { type: "text" },
        password: { type: "password" },
        applicantId: { type: "text" },
        studentNumber: { type: "text" },
      },
      async authorize(credentials) {
        const role = String(credentials?.role ?? "");
        const password = String(credentials?.password ?? "");

        // COR-6 FIX1: construct a bounded, role-specific backend payload so an
        // unrelated credential field is never forwarded.
        const payload =
          role === "applicant"
            ? { role, applicantId: credentials?.applicantId, password }
            : role === "student"
              ? { role, studentNumber: credentials?.studentNumber, password }
              : { role, email: credentials?.email, password };

        const apiUrl = getServerBackendBaseUrl();
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.token && data.user) {
          return {
            id: data.user.id,
            email: data.user.email,
            role: data.user.role,
            accessToken: data.token,
            mustChangePassword: data.user.mustChangePassword,
            adminAccessLevel: data.user.adminAccessLevel ?? null,
            adminCapabilities: Array.isArray(data.user.adminCapabilities)
              ? data.user.adminCapabilities
              : null,
            facultyProfile: data.user.facultyProfile ?? null,
          };
        }
        class CustomError extends CredentialsSignin {
          code: string;
          constructor(message: string) {
            super(message);
            this.code = message;
          }
        }
        throw new CustomError(data.error || "Invalid credentials");
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id!;
        const rawRole = user.role?.toLowerCase() ?? "";
        token.role = rawRole === "panelist" ? "faculty" : rawRole;
        token.accessToken = user.accessToken ?? "";
        token.mustChangePassword = user.mustChangePassword ?? false;
        token.adminAccessLevel = user.adminAccessLevel ?? null;
        token.adminCapabilities = user.adminCapabilities ?? null;
        token.facultyProfile = user.facultyProfile ?? null;
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.accessToken = token.accessToken;
        session.user.mustChangePassword = token.mustChangePassword;
        session.user.adminAccessLevel = token.adminAccessLevel ?? null;
        session.user.adminCapabilities = token.adminCapabilities ?? null;
        session.user.facultyProfile = token.facultyProfile ?? null;
      }
      return session;
    },
    redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      const effectiveBaseUrl =
        baseUrl === "https://localhost:3000"
          ? "https://graduate.earist.app"
          : baseUrl;
      if (url.startsWith("/")) return `${effectiveBaseUrl}${url}`;
      try {
        const parsed = new URL(url);
        if (parsed.origin === "https://localhost:3000") {
          return `https://graduate.earist.app${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        if (parsed.origin === effectiveBaseUrl || parsed.origin === baseUrl) {
          return url;
        }
      } catch {
        // Ignore invalid URL and fall back to effectiveBaseUrl
      }
      return effectiveBaseUrl;
    },
  },
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
});
