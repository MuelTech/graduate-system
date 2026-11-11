"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { signOut, useSession } from "next-auth/react";
import { apiClientRequest } from "@/lib/api.client";
import {
  canAdminAccessPath,
  normalizeAdminCapabilities,
} from "@/lib/admin-capabilities";
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
  Menu,
  X,
  LogOut,
  PanelLeft,
  ChevronDown,
  Megaphone,
} from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PortalBreadcrumbs } from "@/components/layout/portal-breadcrumbs";

interface AuthMeResponse {
  id?: string;
  role?: string;
  adminAccessLevel?: "FULL" | "RESTRICTED" | null;
  adminCapabilities?: string[] | null;
  user?: {
    id: string;
    role: string;
    adminAccessLevel?: "FULL" | "RESTRICTED" | null;
    adminCapabilities?: string[] | null;
  };
}

/** Nested admin routes stay visually active on their parent nav entry. */
function isNavActive(pathname: string, href: string): boolean {
  if (
    href === "/admin/users/faculty" &&
    (pathname.startsWith("/admin/users/faculty") ||
      pathname.startsWith("/admin/users/panelists"))
  ) {
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const allNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "User Management",
    icon: Users,
    children: [
      { href: "/admin/users/applicants", label: "Applicants" },
      { href: "/admin/users/students", label: "Students" },
      { href: "/admin/users/faculty", label: "Faculty" },
      { href: "/admin/users/administrators", label: "Administrators" },
    ],
  },
  {
    label: "Exam Management",
    icon: FileCheck2,
    children: [
      { href: "/admin/exam/slots", label: "Schedules" },
      { href: "/admin/exam/applications", label: "Examinee Records" },
      { href: "/admin/exam/questions", label: "Question Bank" },
      { href: "/admin/exam/cor", label: "COR Verification" },
      { href: "/admin/exam/waiver", label: "Waiver Validation" },
    ],
  },
  {
    label: "Thesis Management",
    icon: ClipboardList,
    children: [
      { href: "/admin/thesis/applications", label: "Applications" },
      { href: "/admin/thesis/scheduling", label: "Scheduling & Panels" },
      { href: "/admin/thesis/defense-records", label: "Records" },
      { href: "/admin/thesis/advisers", label: "Adviser Requests" },
    ],
  },
  { href: "/admin/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "System Settings", icon: Settings },
  { href: "/admin/settings/storage", label: "Storage Health", icon: HardDrive },
  { href: "/admin/memos", label: "Announcements & Memos", icon: Megaphone },
  { href: "/admin/repository", label: "Repository", icon: Library },
];

/** Shared focus treatment for sidebar controls (Playbook §25). */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f9a825] focus-visible:ring-offset-2 focus-visible:ring-offset-[#b71c1c]";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "User Management": true,
    "Exam Management": true,
    "Thesis Management": true,
  });

  // Zero-flicker capability check: uses session values immediately while
  // polling /auth/me so admin permission changes reflect without re-login.
  const { data: authMe, isSuccess: authMeLoaded } = useQuery<AuthMeResponse>({
    queryKey: ["authMe"],
    queryFn: async () => (await apiClientRequest("/auth/me")) as AuthMeResponse,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const accessLevel =
    authMe?.adminAccessLevel ??
    authMe?.user?.adminAccessLevel ??
    session?.user?.adminAccessLevel ??
    "FULL";
  const capabilities = normalizeAdminCapabilities(
    authMe?.adminCapabilities ??
      authMe?.user?.adminCapabilities ??
      session?.user?.adminCapabilities ??
      [],
  );

  const isPathAllowed = canAdminAccessPath(pathname, accessLevel, capabilities);

  useEffect(() => {
    if (authMeLoaded && !isPathAllowed) {
      router.replace("/admin/dashboard");
    }
  }, [authMeLoaded, isPathAllowed, router]);

  const navItems = allNavItems
    .map((item) => {
      if ("children" in item && item.children) {
        const visibleChildren = item.children.filter((child) =>
          canAdminAccessPath(child.href, accessLevel, capabilities),
        );
        if (visibleChildren.length === 0) return null;
        return { ...item, children: visibleChildren };
      }
      if (
        item.href &&
        !canAdminAccessPath(item.href, accessLevel, capabilities)
      ) {
        return null;
      }
      return item;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div
      // Browser extensions (e.g. Definer) inject host nodes into the layout
      // tree and break attribute/text hydration on this shell. Children stay strict.
      suppressHydrationWarning
      className="flex min-h-screen bg-[#FFF8F0]"
    >
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
        {/* Branding */}
        <div className="flex h-16 items-center justify-between border-b border-white/15 px-4">
          <Link
            href="/admin/dashboard"
            className={`flex items-center gap-3 rounded-lg ${FOCUS_RING}`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#f9a825] shadow-inner">
              <GraduationCap className="h-6 w-6 shrink-0" aria-hidden="true" />
            </div>
            {!collapsed && (
              <span className="flex flex-col">
                <span className="text-base leading-tight font-bold tracking-wide text-white">
                  EARIST
                </span>
                <span className="text-[11px] leading-tight font-medium tracking-wider text-white/75 uppercase">
                  Admin Portal
                </span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className={`rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden ${FOCUS_RING}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          aria-label="Admin navigation"
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          <ul className="space-y-1">
            {navItems.map((item) => {
              if ("children" in item) {
                const isOpen = openMenus[item.label] ?? false;
                const isActive =
                  item.children?.some((child) =>
                    isNavActive(pathname, child.href),
                  ) ?? false;

                const parentState = isActive
                  ? collapsed
                    ? "border-l-4 border-white bg-white/20 font-semibold text-white rounded-r-lg"
                    : "bg-white/15 font-semibold text-white rounded-lg"
                  : "rounded-lg font-medium text-white/80 hover:bg-white/10 hover:text-white";

                return (
                  <li key={item.label}>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      aria-expanded={isOpen}
                      className={`group flex w-full items-center gap-3 px-3.5 py-2.5 text-sm transition-all ${parentState} ${FOCUS_RING}`}
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
                            className={`h-4 w-4 text-white/70 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </button>
                    {!collapsed && isOpen && (
                      <ul className="mt-1 ml-4 space-y-1 border-l border-white/20 pl-3">
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
                                className={`block rounded-lg px-3 py-2 text-sm transition-all ${FOCUS_RING} ${
                                  isChildActive
                                    ? "bg-white/20 font-semibold text-white shadow-2xs"
                                    : "text-white/75 hover:bg-white/10 hover:text-white"
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
                    className={`group flex items-center gap-3 px-3.5 py-2.5 text-sm transition-all ${FOCUS_RING} ${
                      isActive
                        ? "rounded-r-lg border-l-4 border-white bg-white/20 font-semibold text-white shadow-2xs"
                        : "rounded-lg font-medium text-white/80 hover:bg-white/10 hover:text-white"
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

        {/* Logout */}
        <div className="border-t border-white/15 p-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
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
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="hidden rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#333333] lg:inline-flex"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="hidden h-5 w-px bg-gray-200 sm:block" />
            <PortalBreadcrumbs portal="admin" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-xs font-semibold text-[#333333]">
                {session?.user?.name || session?.user?.email || "Administrator"}
              </span>
              <span className="text-[11px] font-medium text-gray-500">
                Admin Portal
              </span>
            </div>
            <NotificationBell role="ADMIN" />
            <div
              suppressHydrationWarning
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e02b20] text-sm font-bold text-white uppercase shadow-xs"
              title={session?.user?.email || "Admin"}
            >
              {session?.user?.email?.charAt(0).toUpperCase() || "A"}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {!authMeLoaded || isPathAllowed ? children : null}
        </main>
      </div>

      {/* AI Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
}
