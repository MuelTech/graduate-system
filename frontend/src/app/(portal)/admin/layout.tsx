"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileCheck2,
  ClipboardList,
  BarChart3,
  Settings,
  HardDrive,
  Library,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Megaphone,
} from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";

/** Nested admin routes stay visually active on their parent nav entry. */
function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "User Management",
    icon: Users,
    children: [
      { href: "/admin/users/applicants", label: "Applicants" },
      { href: "/admin/users/students", label: "Students" },
      { href: "/admin/users/panelists", label: "Panelists" },
      { href: "/admin/users/roles", label: "Custom Roles" },
    ],
  },
  {
    label: "Exam Management",
    icon: FileCheck2,
    children: [
      { href: "/admin/exam/slots", label: "Exam Schedules" },
      { href: "/admin/exam/applications", label: "Exam Records" },
      { href: "/admin/exam/questions", label: "Exam Questions" },
      { href: "/admin/exam/cor", label: "COR Validation" },
      { href: "/admin/exam/waiver", label: "Waiver Validation" },
    ],
  },
  {
    label: "Thesis Management",
    icon: ClipboardList,
    children: [
      { href: "/admin/thesis/applications", label: "Defense Applications" },
      { href: "/admin/thesis/scheduling", label: "Scheduling & Panels" },
      { href: "/admin/thesis/defense-records", label: "Defense Records" },
      { href: "/admin/thesis/rap-reports", label: "RAP Reports" },
      { href: "/admin/thesis/advisers", label: "Adviser Request Review" },
    ],
  },
  { href: "/admin/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "System Settings", icon: Settings },
  { href: "/admin/settings/storage", label: "Storage Health", icon: HardDrive },
  { href: "/admin/memos", label: "Announcements & Memos", icon: Megaphone },
  { href: "/admin/repository", label: "Repository", icon: Library },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
];

/** Shared focus treatment for sidebar controls (Playbook §25). */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--earist-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--earist-primary)";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "User Management":
      pathname.startsWith("/admin/users") ||
      pathname.startsWith("/admin/users"),
    "Exam Management": pathname.startsWith("/admin/exam"),
    "Thesis Management": pathname.startsWith("/admin/thesis"),
  });

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div
      // Browser extensions (e.g. Definer) inject host nodes into the layout
      // tree and break attribute/text hydration on this shell. Children stay strict.
      suppressHydrationWarning
      className="flex min-h-screen bg-(--earist-surface-gray)"
    >
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
          collapsed ? "w-17" : "w-65"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Branding */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Link
            href="/admin/dashboard"
            className={`flex items-center gap-2 rounded-md ${FOCUS_RING}`}
          >
            <GraduationCap
              className="h-7 w-7 shrink-0 text-(--earist-accent)"
              aria-hidden="true"
            />
            {!collapsed && (
              <span className="flex flex-col">
                <span className="text-sm leading-tight font-bold text-white">
                  EARIST
                </span>
                <span className="text-[10px] leading-tight text-white/70">
                  Admin Portal
                </span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className={`rounded-md text-white/80 transition-colors hover:text-(--earist-accent) lg:hidden ${FOCUS_RING}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          aria-label="Admin navigation"
          className="flex-1 overflow-y-auto px-2 py-3"
        >
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              if ("children" in item) {
                const isOpen = openMenus[item.label] ?? false;
                const isActive =
                  item.children?.some((child) =>
                    isNavActive(pathname, child.href),
                  ) ?? false;

                // When collapsed the parent is the only location cue, so it
                // keeps the strong accent; expanded, the active child carries it.
                const parentState = isActive
                  ? collapsed
                    ? "bg-(--earist-accent) text-(--earist-primary)"
                    : "bg-white/10 font-semibold text-white"
                  : "text-white hover:bg-white/10 hover:text-(--earist-accent)";

                return (
                  <li key={item.label}>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      aria-expanded={isOpen}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${parentState} ${FOCUS_RING}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </button>
                    {!collapsed && isOpen && (
                      <ul className="mt-1 ml-5 space-y-0.5 border-l border-white/10 pl-3">
                        {item.children?.map((child) => {
                          const isChildActive = isNavActive(
                            pathname,
                            child.href,
                          );
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={() => setSidebarOpen(false)}
                                aria-current={
                                  isChildActive ? "page" : undefined
                                }
                                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${FOCUS_RING} ${
                                  isChildActive
                                    ? "bg-(--earist-accent) font-medium text-(--earist-primary)"
                                    : "text-white/75 hover:bg-white/10 hover:text-(--earist-accent)"
                                }`}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              }

              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href!}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${FOCUS_RING} ${
                      isActive
                        ? "bg-(--earist-accent) text-(--earist-primary)"
                        : "text-white hover:bg-white/10 hover:text-(--earist-accent)"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
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
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={`flex w-full items-center justify-center rounded-lg p-2 text-white transition-colors hover:bg-white/10 hover:text-(--earist-accent) ${FOCUS_RING}`}
          >
            <ChevronLeft
              className={`h-5 w-5 transition-transform ${
                collapsed ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Logout */}
        <div className="border-t border-white/10 p-2">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:text-(--earist-accent) ${FOCUS_RING}`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          collapsed ? "lg:ml-17" : "lg:ml-65"
        }`}
      >
        {/* Top Header: mobile navigation + utilities. Page identity lives in
            the page header, not here (Playbook §8/§10.1). */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-(--earist-border-gray) bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className={`rounded-md p-1 text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-gray) lg:hidden ${FOCUS_RING}`}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell role="ADMIN" />
            <div
              suppressHydrationWarning
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-(--earist-primary) text-sm font-bold text-white uppercase"
              title={session?.user?.email || "Admin"}
            >
              {session?.user?.email?.charAt(0).toUpperCase() || "A"}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 xl:p-8">{children}</main>
      </div>

      {/* AI Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
}
