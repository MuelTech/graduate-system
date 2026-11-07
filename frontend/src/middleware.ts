import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";

export default auth((req: NextRequest & { auth: Session | null }) => {
  const token = req.auth;
  const path = req.nextUrl.pathname;

  console.log(
    `[Middleware] Path: ${path} | Has Token: ${!!token} | Role: ${token?.user?.role}`,
  );

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = token.user?.role;
  const mustChangePassword = token.user?.mustChangePassword;

  if (token.user?.currentAccountError === "ACCOUNT_UNAVAILABLE") {
    return new NextResponse("Account access is temporarily unavailable. Please try again.", { status: 503 });
  }
  if (token.user?.currentAccountError || !role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Credential state applies to every account role.
  if (mustChangePassword && path !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  if (path === "/change-password") {
    return NextResponse.next();
  }

  if (path.startsWith("/applicant") && role !== "applicant") {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, req.url));
  }

  if (path.startsWith("/student") && role !== "student") {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, req.url));
  }

  if (path.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, req.url));
  }

  if (path.startsWith("/panelist") && role !== "panelist") {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, req.url));
  }
});

export const config = {
  matcher: [
    "/applicant/:path*",
    "/student/:path*",
    "/admin/:path*",
    "/panelist/:path*",
    "/change-password",
  ],
};
