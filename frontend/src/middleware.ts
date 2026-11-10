import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { canAdminAccessPath } from "@/lib/admin-capabilities";

function isFacultyRole(role?: string | null): boolean {
  return role === "faculty" || role === "panelist";
}

function getDefaultDashboardForRole(role?: string | null): string {
  if (isFacultyRole(role)) {
    return "/faculty/dashboard";
  }
  return `/${role || "applicant"}/dashboard`;
}

export default auth((req: NextRequest & { auth: Session | null }) => {
  const token = req.auth;
  const path = req.nextUrl.pathname;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = token.user?.role;
  const mustChangePassword = token.user?.mustChangePassword;

  // Force faculty and administrators to change default password on first login
  if (
    (isFacultyRole(role) || role === "admin") &&
    mustChangePassword &&
    path !== "/change-password"
  ) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  // Allow change-password page access for faculty and administrators
  if (
    path === "/change-password" &&
    (isFacultyRole(role) || role === "admin")
  ) {
    return NextResponse.next();
  }

  if (path.startsWith("/applicant") && role !== "applicant") {
    return NextResponse.redirect(
      new URL(getDefaultDashboardForRole(role), req.url),
    );
  }

  if (path.startsWith("/student") && role !== "student") {
    return NextResponse.redirect(
      new URL(getDefaultDashboardForRole(role), req.url),
    );
  }

  if (path.startsWith("/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(
        new URL(getDefaultDashboardForRole(role), req.url),
      );
    }

    // Redirect legacy /admin/users/panelists -> /admin/users/faculty in browser bar
    if (path.startsWith("/admin/users/panelists")) {
      const canonicalUrl = req.nextUrl.clone();
      canonicalUrl.pathname = path.replace(
        "/admin/users/panelists",
        "/admin/users/faculty",
      );
      return NextResponse.redirect(canonicalUrl);
    }

    // Rewrite /admin/users/faculty -> /admin/users/panelists seamlessly
    if (path.startsWith("/admin/users/faculty")) {
      const targetPath = path.replace(
        "/admin/users/faculty",
        "/admin/users/panelists",
      );
      if (
        !canAdminAccessPath(
          targetPath,
          token.user?.adminAccessLevel,
          token.user?.adminCapabilities,
        )
      ) {
        return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      }
      return NextResponse.rewrite(new URL(targetPath, req.url));
    }

    if (
      !canAdminAccessPath(
        path,
        token.user?.adminAccessLevel,
        token.user?.adminCapabilities,
      )
    ) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
  }

  // Redirect legacy /panelist/* -> /faculty/* in browser bar
  if (path.startsWith("/panelist")) {
    if (!isFacultyRole(role)) {
      return NextResponse.redirect(
        new URL(getDefaultDashboardForRole(role), req.url),
      );
    }
    const canonicalUrl = req.nextUrl.clone();
    canonicalUrl.pathname = path.replace(/^\/panelist/, "/faculty");
    return NextResponse.redirect(canonicalUrl);
  }

  // Rewrite canonical /faculty/* -> /panelist/* route folder seamlessly
  if (path.startsWith("/faculty")) {
    if (!isFacultyRole(role)) {
      return NextResponse.redirect(
        new URL(getDefaultDashboardForRole(role), req.url),
      );
    }
    const rewrittenUrl = req.nextUrl.clone();
    rewrittenUrl.pathname = path.replace(/^\/faculty/, "/panelist");
    return NextResponse.rewrite(rewrittenUrl);
  }
});

export const config = {
  matcher: [
    "/applicant/:path*",
    "/student/:path*",
    "/admin/:path*",
    "/panelist/:path*",
    "/faculty/:path*",
    "/change-password",
  ],
};
