import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        role: { type: "text" },
        email: { type: "text" },
        password: { type: "password" },
        applicantId: { type: "text" },
        studentId: { type: "text" },
        birthdate: { type: "text" }
      },
      async authorize(credentials) {
        const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: credentials?.role,
            email: credentials?.email,
            password: credentials?.password,
            applicantId: credentials?.applicantId,
            studentId: credentials?.studentId,
            birthdate: credentials?.birthdate
          })
        });

        const data = await res.json();

        if (res.ok && data.token && data.user) {
          return {
            id: data.user.id,
            email: data.user.email,
            role: data.user.role, 
            accessToken: data.token 
          };
        }

        throw new Error(data.error || "Invalid credentials");
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role.toLowerCase();
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.accessToken = token.accessToken;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 23 * 60 * 60, 
  },
  secret: process.env.NEXTAUTH_SECRET,
};
