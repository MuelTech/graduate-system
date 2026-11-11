"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PortalBreadcrumbs } from "@/components/layout/portal-breadcrumbs";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  User,
  ShieldCheck,
  CalendarClock,
  FileCheck2,
  BadgeCheck,
  Upload,
  Bell,
  GraduationCap,
  Menu,
  X,
  LogOut,
  PanelLeft,
} from "lucide-react";

const navItems = [
  { href: "/applicant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applicant/profile", label: "Profile", icon: User },
  {
    href: "/applicant/alignment",
    label: "Program Alignment",
    icon: ShieldCheck,
  },
  { href: "/applicant/schedule", label: "Exam Schedule", icon: CalendarClock },
  { href: "/applicant/exam", label: "Entrance Exam", icon: FileCheck2 },
  { href: "/applicant/results", label: "Exam Results", icon: BadgeCheck },
  { href: "/applicant/cor-upload", label: "COR Upload", icon: Upload },
  { href: "/applicant/notifications", label: "Notifications", icon: Bell },
];

export default function ApplicantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Generate User Avatar Initial from Session
  const userInitial = session?.user?.email
    ? session.user.email.charAt(0).toUpperCase()
    : "U";

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
          <Link href="/applicant/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#f9a825] shadow-inner">
              <GraduationCap className="h-6 w-6 shrink-0" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-base leading-tight font-bold tracking-wide text-white">
                  EARIST
                </span>
                <span className="text-[11px] leading-tight font-medium tracking-wider text-white/75 uppercase">
                  Applicant Portal
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
              const isActive = pathname === item.href;
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
            <PortalBreadcrumbs portal="applicant" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-xs font-semibold text-[#333333]">
                {session?.user?.name || session?.user?.email || "Applicant"}
              </span>
              <span className="text-[11px] font-medium text-gray-500">
                Applicant Portal
              </span>
            </div>
            <NotificationBell role="APPLICANT" />
            {/* Dynamic Avatar using Session */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e02b20] text-sm font-bold text-white uppercase shadow-xs"
              title={session?.user?.email || "User"}
            >
              {userInitial}
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
