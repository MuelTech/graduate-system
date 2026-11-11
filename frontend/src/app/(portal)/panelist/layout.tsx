"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import { apiClientRequest } from "@/lib/api.client";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { NotificationBell } from "@/components/layout/notification-bell";
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
  ChevronLeft,
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
      <div className="min-h-screen bg-(--earist-surface-gray)">{children}</div>
    );
  }

  const avatarInitial =
    session?.user?.email?.charAt(0).toUpperCase() || "F";

  return (
    <div className="flex min-h-screen bg-(--earist-surface-gray)">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-(--earist-primary) transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-[260px]"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Link href="/faculty/dashboard" className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-(--earist-accent)" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm leading-tight font-bold text-white">
                  EARIST
                </span>
                <span className="text-[10px] leading-tight text-white/80">
                  Faculty Portal
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-white hover:text-(--earist-accent) lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-(--earist-accent) text-(--earist-primary)"
                        : "text-white hover:bg-white/10 hover:text-(--earist-accent)"
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

        {/* Collapse Toggle (Desktop) */}
        <div className="hidden border-t border-white/10 p-2 lg:block">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-white transition-colors hover:bg-white/10 hover:text-(--earist-accent)"
          >
            <ChevronLeft
              className={`h-5 w-5 transition-transform ${
                collapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Logout */}
        <div className="border-t border-white/10 p-2">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:text-(--earist-accent)"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${
          collapsed ? "lg:ml-[68px]" : "lg:ml-[260px]"
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-(--earist-border-gray) bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-(--earist-body-text) lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1
              className="text-lg font-bold text-(--earist-primary)"
              style={{ fontFamily: '"Calibri", sans-serif' }}
            >
              Faculty Portal
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell role="FACULTY" />
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-(--earist-primary) text-sm font-bold text-white"
              title={session?.user?.email || "Faculty"}
            >
              {avatarInitial}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* AI Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
}
