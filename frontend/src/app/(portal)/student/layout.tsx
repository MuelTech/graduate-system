"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  User,
  BookOpen,
  Milestone,
  FileText,
  ShieldCheck,
  Upload,
  Bell,
  GraduationCap,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Calendar,
  Megaphone,
  Library,
} from "lucide-react";

const navItems = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/profile", label: "Profile", icon: User },
  { href: "/student/curriculum", label: "Curriculum", icon: BookOpen },
  { href: "/student/journey", label: "Academic Journey", icon: Milestone },
  {
    label: "Thesis Journey",
    href: "/student/thesis",
    icon: FileText,
    children: [
      { href: "/student/thesis/title-defense", label: "Title Defense" },
      { href: "/student/thesis/proposal-defense", label: "Proposal Defense" },
      { href: "/student/thesis/final-defense", label: "Final Defense" },
    ],
  },
  { href: "/student/plagiarism", label: "STRIKE Check", icon: ShieldCheck },
  { href: "/student/repository", label: "Repository", icon: Library },
  { href: "/student/announcements", label: "Announcements", icon: Megaphone },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [thesisOpen, setThesisOpen] = useState(
    pathname.startsWith("/student/thesis"),
  );

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
          <Link href="/student/dashboard" className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-(--earist-accent)" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm leading-tight font-bold text-white">
                  EARIST
                </span>
                <span className="text-[10px] leading-tight text-white/80">
                  Student Portal
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
              if ("children" in item) {
                const isOpen = thesisOpen;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href || "#"}
                      onClick={() => setThesisOpen(!isOpen)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        pathname.startsWith("/student/thesis")
                          ? "bg-(--earist-accent) text-(--earist-primary)"
                          : "text-white hover:bg-white/10 hover:text-(--earist-accent)"
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </>
                      )}
                    </Link>
                    {!collapsed && isOpen && (
                      <ul className="mt-1 ml-6 space-y-1 border-l border-white/10 pl-3">
                        {item.children?.map((child) => {
                          const isChildActive = pathname === child.href;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                                  isChildActive
                                    ? "bg-(--earist-accent) font-medium text-(--earist-primary)"
                                    : "text-white/80 hover:bg-white/10 hover:text-(--earist-accent)"
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
              className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`}
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
              Student Portal
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/student/notifications"
              className="relative rounded-full p-2 text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-light-red) hover:text-(--earist-primary)"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--earist-accent) text-[10px] font-bold text-(--earist-primary)">
                3
              </span>
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--earist-primary) text-sm font-bold text-white">
              M
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
