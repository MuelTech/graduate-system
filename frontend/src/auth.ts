import NextAuth, { CredentialsSignin } from "next-auth";
import type { Session, User } from "next-auth";
import type { JWT } from "@auth/core/jwt";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        role: { type: "text" },
        email: { type: "text" },
        password: { type: "password" },
        applicantId: { type: "text" },
        studentId: { type: "text" },
        birthdate: { type: "text" },
      },
      async authorize(credentials) {
        const apiUrl = process.env.BACKEND_API_URL || "http://localhost:5000";
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });
        const data = await res.json();
        if (res.ok && data.token && data.user) {
          return {
            id: data.user.id,
            email: data.user.email,
            role: data.user.role,
            accessToken: data.token,
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
        token.role = user.role?.toLowerCase() ?? "";
        token.accessToken = user.accessToken ?? "";
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 23 * 60 * 60 },
});
