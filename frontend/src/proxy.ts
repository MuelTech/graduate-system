import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Print to your VSCode terminal to prove the middleware is running
    console.log(
      `[Middleware] Path: ${path} | Has Token: ${!!token} | Role: ${token?.role}`,
    );

    // If the user somehow bypassed the authorized callback without a token
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Role-based Protection Checks
    if (path.startsWith("/applicant") && token.role !== "applicant") {
      return NextResponse.redirect(
        new URL(`/${token.role}/dashboard`, req.url),
      );
    }

    if (path.startsWith("/student") && token.role !== "student") {
      return NextResponse.redirect(
        new URL(`/${token.role}/dashboard`, req.url),
      );
    }

    if (path.startsWith("/admin") && token.role !== "admin") {
      return NextResponse.redirect(
        new URL(`/${token.role}/dashboard`, req.url),
      );
    }

    if (path.startsWith("/panelist") && token.role !== "panelist") {
      return NextResponse.redirect(
        new URL(`/${token.role}/dashboard`, req.url),
      );
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    // Tell NextAuth where our custom login page is!
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: [
    "/applicant/:path*",
    "/student/:path*",
    "/admin/:path*",
    "/panelist/:path*",
  ],
};
