"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import {
  LayoutDashboard,
  User,
  FileCheck2,
  FolderOpen,
  PenLine,
  PenTool,
  Library,
  Megaphone,
  Bell,
  GraduationCap,
  Menu,
  X,
  LogOut,
  ChevronLeft,
} from "lucide-react";

const navItems = [
  { href: "/panelist/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/panelist/profile", label: "Profile", icon: User },
  { href: "/panelist/defenses", label: "My Defenses", icon: FileCheck2 },
  { href: "/panelist/materials", label: "Materials", icon: FolderOpen },
  { href: "/panelist/scoring", label: "Scoring", icon: PenLine },
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
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--earist-surface-gray)]">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--earist-primary)] transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-[260px]"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Link
            href="/panelist/dashboard"
            className="flex items-center gap-2"
          >
            <GraduationCap className="h-7 w-7 text-[var(--earist-accent)]" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white leading-tight">
                  EARIST
                </span>
                <span className="text-[10px] text-white/80 leading-tight">
                  Panelist Portal
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-white hover:text-[var(--earist-accent)] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--earist-accent)] text-[var(--earist-primary)]"
                        : "text-white hover:bg-white/10 hover:text-[var(--earist-accent)]"
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
            className="flex w-full items-center justify-center rounded-lg p-2 text-white transition-colors hover:bg-white/10 hover:text-[var(--earist-accent)]"
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
          <Link
            href="/login"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:text-[var(--earist-accent)]"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${
          collapsed ? "lg:ml-[68px]" : "lg:ml-[260px]"
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--earist-border-gray)] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-[var(--earist-body-text)] lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1
              className="text-lg font-bold text-[var(--earist-primary)]"
              style={{ fontFamily: '"Calibri", sans-serif' }}
            >
              Panelist Portal
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/panelist/notifications"
              className="relative rounded-full p-2 text-[var(--earist-body-text)] transition-colors hover:bg-[var(--earist-surface-light-red)] hover:text-[var(--earist-primary)]"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--earist-accent)] text-[10px] font-bold text-[var(--earist-primary)]">
                2
              </span>
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--earist-primary)] text-sm font-bold text-white">
              R
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
