"use client";

import { useEffect, useRef, useState } from "react";
import {
  FacultyPortalProvider,
  FacultyRouteGate,
  useFacultyAccess,
} from "@/components/faculty/faculty-access-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { signOut } from "next-auth/react";
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
  Bell,
  GraduationCap,
  Menu,
  X,
  LogOut,
  ChevronLeft,
} from "lucide-react";

/**
 * UIUX-3D: My Defenses is the single assignment entry point. Its navigation
 * item stays active for the canonical Defense Workspace and for the retired
 * compatibility route families that resolve into that same context.
 */
const MY_DEFENSES_CONTEXT_ROUTES = [
  "/panelist/defenses",
  "/panelist/defense-workspace",
  "/panelist/scoring",
  "/panelist/defense-lobby",
  "/panelist/materials",
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/panelist/defenses") {
    return MY_DEFENSES_CONTEXT_ROUTES.some(
      (base) => pathname === base || pathname.startsWith(`${base}/`),
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const navItems = [
  { href: "/panelist/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/panelist/profile", label: "Profile", icon: User },
  {
    href: "/panelist/essay-evaluations",
    label: "Essay Evaluations",
    icon: ClipboardCheck,
    area: "essayEvaluations" as const,
  },
  {
    href: "/panelist/defenses",
    label: "My Defenses",
    icon: FileCheck2,
    area: "myDefenses" as const,
  },
  {
    href: "/panelist/advisees",
    label: "My Advisees",
    icon: Users,
    area: "myAdvisees" as const,
  },
  { href: "/panelist/signatures", label: "E-Signatures", icon: PenTool },
  { href: "/panelist/repository", label: "Repository", icon: Library },
  { href: "/panelist/announcements", label: "Announcements", icon: Megaphone },
  { href: "/panelist/notifications", label: "Notifications", icon: Bell },
];

export default function PanelistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FacultyPortalProvider>
      <FacultyShell>{children}</FacultyShell>
    </FacultyPortalProvider>
  );
}

function FacultyShell({ children }: { children: React.ReactNode }) {
  const access = useFacultyAccess();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const closeSidebar = () => {
    setSidebarOpen(false);
  };
  useEffect(() => {
    if (sidebarOpen && window.matchMedia("(max-width: 1023px)").matches) {
      wasOpen.current = true;
      const frame = requestAnimationFrame(() => {
        sidebar.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
      });
      const escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") setSidebarOpen(false);
      };
      document.addEventListener("keydown", escape);
      return () => {
        cancelAnimationFrame(frame);
        document.removeEventListener("keydown", escape);
      };
    } else if (wasOpen.current) {
      wasOpen.current = false;
      opener.current?.focus();
    }
  }, [sidebarOpen]);

  // CDW-4: the Defense Workspace route is an immersive, sidebar-free focus mode.
  // Only this route opts out of the normal Panelist portal chrome; every other
  // Panelist page keeps the standard sidebar/header/navigation unchanged.
  if (pathname.startsWith("/panelist/defense-workspace")) {
    return (
      <div className="min-h-screen bg-(--earist-surface-gray)">
        <FacultyRouteGate>{children}</FacultyRouteGate>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-(--earist-surface-gray)">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebar}
        aria-label="Faculty navigation panel"
        onKeyDown={(event) => {
          if (!sidebarOpen || !window.matchMedia("(max-width: 1023px)").matches)
            return;
          if (event.key === "Escape") {
            event.preventDefault();
            closeSidebar();
          }
          if (event.key === "Tab") {
            const controls = Array.from(
              sidebar.current?.querySelectorAll<HTMLElement>(
                "a[href],button:not([disabled])",
              ) ?? [],
            ).filter((node) => node.offsetParent !== null);
            const first = controls[0];
            const last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        id="faculty-navigation"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-(--earist-primary) transition-[transform,width] duration-300 ${
          collapsed ? "w-[68px]" : "w-[260px]"
        } ${
          sidebarOpen
            ? "visible translate-x-0"
            : "invisible -translate-x-full lg:visible lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Link
            href="/panelist/dashboard"
            aria-label="EARIST Faculty Portal"
            className="flex items-center gap-2"
          >
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
            aria-label="Close navigation"
            onClick={closeSidebar}
            className="text-white hover:text-(--earist-accent) lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          aria-label="Faculty navigation"
          className="flex-1 overflow-y-auto px-2 py-4"
        >
          <ul className="space-y-1">
            {navItems
              .filter(
                (item) =>
                  !("area" in item) ||
                  (item.area && access.work?.[item.area].relevant === true),
              )
              .map((item) => {
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
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
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
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
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
            aria-label="Sign Out"
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
        inert={sidebarOpen}
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          collapsed ? "lg:ml-[68px]" : "lg:ml-[260px]"
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-(--earist-border-gray) bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={opener}
              aria-label="Open navigation"
              aria-controls="faculty-navigation"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
              className="text-(--earist-body-text) lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span
              className="text-lg font-bold text-(--earist-primary)"
              style={{ fontFamily: '"Calibri", sans-serif' }}
            >
              Faculty Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell role="FACULTY" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--earist-primary) text-sm font-bold text-white">
              <User aria-label="Faculty account" className="h-4 w-4" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <FacultyRouteGate>{children}</FacultyRouteGate>
        </main>
      </div>

      {/* AI Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
}
