"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import { apiClientRequest } from "@/lib/api.client";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PortalBreadcrumbs } from "@/components/layout/portal-breadcrumbs";
import {
  LayoutDashboard,
  User,
  FileCheck2,
  ClipboardCheck,
  PenTool,
  Users,
  Library,
  Megaphone,
  GraduationCap,
  Menu,
  X,
  LogOut,
  PanelLeft,
} from "lucide-react";

interface FacultyProfileAccess {
  id: string;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
  canEvaluateEssays: boolean;
}

/**
 * UIUX-3D: My Defenses is the single assignment entry point. Its navigation
 * item stays active for the canonical Defense Workspace and for the retired
 * compatibility route families that resolve into that same context.
 */
const MY_DEFENSES_CONTEXT_ROUTES = [
  "/faculty/defenses",
  "/faculty/defense-workspace",
  "/faculty/scoring",
  "/faculty/defense-lobby",
  "/faculty/materials",
  "/panelist/defenses",
  "/panelist/defense-workspace",
  "/panelist/scoring",
  "/panelist/defense-lobby",
  "/panelist/materials",
];

function isNavItemActive(pathname: string, href: string): boolean {
  const normalizedPathname = pathname.replace(/^\/panelist/, "/faculty");
  if (href === "/faculty/defenses") {
    return MY_DEFENSES_CONTEXT_ROUTES.some(
      (base) =>
        normalizedPathname === base || normalizedPathname.startsWith(`${base}/`),
    );
  }
  return (
    normalizedPathname === href || normalizedPathname.startsWith(`${href}/`)
  );
}

export default function PanelistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Zero-flicker faculty profile lookup: uses session values immediately as
  // initial fallback while keeping a 60s cached query to reflect live Admin updates.
  const { data: profileData } = useQuery<FacultyProfileAccess>({
    queryKey: ["panelistProfile"],
    queryFn: async () =>
      (await apiClientRequest("/panelists/me")) as FacultyProfileAccess,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const sessionProfile = session?.user?.facultyProfile;
  const isExternal =
    profileData?.isExternal ?? sessionProfile?.isExternal ?? false;
  const canEvaluateEssays =
    profileData?.canEvaluateEssays ??
    sessionProfile?.canEvaluateEssays ??
    false;

  const navItems = [
    { href: "/faculty/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/faculty/profile", label: "Profile", icon: User },
    ...(canEvaluateEssays
      ? [
          {
            href: "/faculty/essay-evaluations",
            label: "Essay Evaluations",
            icon: ClipboardCheck,
          },
        ]
      : []),
    { href: "/faculty/defenses", label: "My Defenses", icon: FileCheck2 },
    ...(!isExternal
      ? [{ href: "/faculty/advisees", label: "My Advisees", icon: Users }]
      : []),
    { href: "/faculty/signatures", label: "E-Signatures", icon: PenTool },
    { href: "/faculty/repository", label: "Repository", icon: Library },
    {
      href: "/faculty/announcements",
      label: "Announcements",
      icon: Megaphone,
    },
  ];

  // CDW-4: the Defense Workspace route is an immersive, sidebar-free focus mode.
  // Only this route opts out of the normal Faculty portal chrome; every other
  // Faculty page keeps the standard sidebar/header/navigation unchanged.
  if (
    pathname.startsWith("/panelist/defense-workspace") ||
    pathname.startsWith("/faculty/defense-workspace")
  ) {
    return (
      <div className="min-h-screen bg-[#FFF8F0]">{children}</div>
    );
  }

  const avatarInitial =
    session?.user?.email?.charAt(0).toUpperCase() || "F";

  return (
    <div className="flex min-h-screen bg-[#FFF8F0]">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-black/10 bg-[#b71c1c] text-white shadow-xl transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-64"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-white/15 px-4">
          <Link href="/faculty/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#f9a825] shadow-inner">
              <GraduationCap className="h-6 w-6 shrink-0" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-base leading-tight font-bold tracking-wide text-white">
                  EARIST
                </span>
                <span className="text-[11px] leading-tight font-medium tracking-wider text-white/75 uppercase">
                  Faculty Portal
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center gap-3 px-3.5 py-2.5 text-sm transition-all ${
                      isActive
                        ? "rounded-r-lg border-l-4 border-white bg-white/20 font-semibold text-white shadow-2xs"
                        : "rounded-lg font-medium text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="border-t border-white/15 p-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-64"
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-4 shadow-2xs sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#333333] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#333333] lg:inline-flex"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <div className="hidden h-5 w-px bg-gray-200 sm:block" />
            <PortalBreadcrumbs portal="faculty" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-xs font-semibold text-[#333333]">
                {session?.user?.name || session?.user?.email || "Faculty Member"}
              </span>
              <span className="text-[11px] font-medium text-gray-500">
                Faculty Portal
              </span>
            </div>
            <NotificationBell role="FACULTY" />
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e02b20] text-sm font-bold text-white uppercase shadow-xs"
              title={session?.user?.email || "Faculty"}
            >
              {avatarInitial}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* AI Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
}
