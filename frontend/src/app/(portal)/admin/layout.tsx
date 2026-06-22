"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileCheck2,
  ClipboardList,
  BarChart3,
  Settings,
  Library,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";

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
      { href: "/admin/exam/slots", label: "Exam Slots" },
      { href: "/admin/exam/applications", label: "Applications" },
      { href: "/admin/exam/scores", label: "Score Management" },
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
      { href: "/admin/thesis/rap-reports", label: "RAP Reports" },
      { href: "/admin/thesis/advisers", label: "Manage Advisees" },
    ],
  },
  { href: "/admin/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "System Settings", icon: Settings },
  { href: "/admin/repository", label: "Repository", icon: Library },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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
          collapsed ? "w-17" : "w-65"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-(--earist-accent)" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm leading-tight font-bold text-white">
                  EARIST
                </span>
                <span className="text-[10px] leading-tight text-white/80">
                  Admin Portal
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
                const isOpen = openMenus[item.label] ?? false;
                const isActive =
                  item.children?.some((child) => pathname === child.href) ??
                  false;

                return (
                  <li key={item.label}>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
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
                    </button>
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
          collapsed ? "lg:ml-17" : "lg:ml-65"
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
              Administrator Portal
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/notifications"
              className="relative rounded-full p-2 text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-light-red) hover:text-(--earist-primary)"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--earist-accent) text-[10px] font-bold text-(--earist-primary)">
                5
              </span>
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--earist-primary) text-sm font-bold text-white">
              A
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
