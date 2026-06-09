import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If the user somehow bypassed the authorized callback without a token
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Role-based Protection Checks
    // If a user tries to access a path that doesn't match their role, 
    // we redirect them to their actual dashboard.
    
    if (path.startsWith("/applicant") && token.role !== "applicant") {
      return NextResponse.redirect(new URL(`/${token.role}/dashboard`, req.url));
    }
    
    if (path.startsWith("/student") && token.role !== "student") {
      return NextResponse.redirect(new URL(`/${token.role}/dashboard`, req.url));
    }
    
    if (path.startsWith("/admin") && token.role !== "admin") {
      return NextResponse.redirect(new URL(`/${token.role}/dashboard`, req.url));
    }
    
    if (path.startsWith("/panelist") && token.role !== "panelist") {
      return NextResponse.redirect(new URL(`/${token.role}/dashboard`, req.url));
    }
  },
  {
    callbacks: {
      // This ensures the middleware function above only runs if the user is authenticated.
      // If they are NOT authenticated, NextAuth will automatically redirect them to the /login page.
      authorized: ({ token }) => !!token,
    },
  }
);

// We define exactly which paths the middleware should protect
export const config = {
  matcher: [
    "/applicant/:path*",
    "/student/:path*",
    "/admin/:path*",
    "/panelist/:path*",
  ],
};
