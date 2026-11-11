"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { signOut, useSession } from "next-auth/react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PortalBreadcrumbs } from "@/components/layout/portal-breadcrumbs";
import {
  LayoutDashboard,
  User,
  BookOpen,
  Milestone,
  FileText,
  Bell,
  GraduationCap,
  Menu,
  X,
  LogOut,
  PanelLeft,
  ChevronDown,
  Megaphone,
  Library,
  CheckCircle2,
  CircleDot,
  Circle,
  Clock,
  Lock,
} from "lucide-react";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import {
  JOURNEY_STEP_ORDER,
  journeyLabelFor,
  journeyRouteFor,
} from "@/lib/student-thesis-journey";
import type {
  JourneyStepKey,
  JourneyStepState,
  JourneyStepView,
} from "@/types/student-thesis-journey";

const topNavItems = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/profile", label: "Profile", icon: User },
  { href: "/student/curriculum", label: "Curriculum", icon: BookOpen },
  { href: "/student/journey", label: "Academic Journey", icon: Milestone },
];

const bottomNavItems = [
  { href: "/student/repository", label: "Repository", icon: Library },
  { href: "/student/announcements", label: "Announcements", icon: Megaphone },
  { href: "/student/notifications", label: "Notifications", icon: Bell },
];

function statusIcon(state: JourneyStepState | "LOADING" | "ERROR") {
  switch (state) {
    case "COMPLETED":
      return (
        <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
      );
    case "CURRENT":
      return (
        <CircleDot className="h-4 w-4 text-(--earist-accent)" aria-hidden />
      );
    case "AVAILABLE":
      return <Circle className="h-4 w-4 text-sky-300" aria-hidden />;
    case "WAITING":
      return <Clock className="h-4 w-4 text-amber-300" aria-hidden />;
    case "LOCKED":
      return <Lock className="h-4 w-4 text-white/40" aria-hidden />;
    default:
      return (
        <Circle
          className="h-4 w-4 animate-pulse text-white/30"
          aria-hidden
        />
      );
  }
}

function statusExplanation(
  step: JourneyStepView | undefined,
  fallbackState: "LOADING" | "ERROR" = "LOADING",
): string {
  if (!step) {
    return fallbackState === "ERROR"
      ? "Journey status unavailable"
      : "Loading journey status";
  }
  switch (step.state) {
    case "COMPLETED":
      return "Completed";
    case "CURRENT":
      return "Current step";
    case "AVAILABLE":
      return "Available";
    case "WAITING":
      return step.detail || step.lockReason || "Waiting";
    case "LOCKED":
      return step.lockReason
        ? `${step.label} is locked. ${step.lockReason}`
        : `${step.label} is locked`;
    default:
      return step.label;
  }
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [thesisOpen, setThesisOpen] = useState(
    pathname.startsWith("/student/thesis"),
  );
  const {
    data: journey,
    isLoading: journeyLoading,
    isError: journeyError,
  } = useStudentThesisJourney();
  void journeyLoading;

  const stepByKey = new Map<JourneyStepKey, JourneyStepView>(
    (journey?.steps ?? []).map((s) => [s.key, s]),
  );

  return (
    <div className="flex min-h-screen bg-[#FFF8F0]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-black/10 bg-[#b71c1c] text-white shadow-xl transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-64"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/15 px-4">
          <Link href="/student/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#f9a825] shadow-inner">
              <GraduationCap className="h-6 w-6 shrink-0" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-base leading-tight font-bold tracking-wide text-white">
                  EARIST
                </span>
                <span className="text-[11px] leading-tight font-medium tracking-wider text-white/75 uppercase">
                  Student Portal
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

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {topNavItems.map((item) => {
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

            {/* Thesis Journey parent: toggle only — never a Link */}
            <li>
              <button
                type="button"
                aria-expanded={thesisOpen}
                onClick={() => setThesisOpen((v) => !v)}
                className={`group flex w-full items-center gap-3 px-3.5 py-2.5 text-sm transition-all ${
                  pathname.startsWith("/student/thesis")
                    ? collapsed
                      ? "rounded-r-lg border-l-4 border-white bg-white/20 font-semibold text-white"
                      : "rounded-lg bg-white/15 font-semibold text-white"
                    : "rounded-lg font-medium text-white/80 hover:bg-white/10 hover:text-white"
                }`}
                title={collapsed ? "Thesis Journey" : undefined}
              >
                <FileText className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Thesis Journey</span>
                    <ChevronDown
                      className={`h-4 w-4 text-white/70 transition-transform ${
                        thesisOpen ? "rotate-180" : ""
                      }`}
                    />
                  </>
                )}
              </button>

              {!collapsed && thesisOpen && (
                <ul className="mt-1 ml-4 space-y-1 border-l border-white/20 pl-3">
                  {JOURNEY_STEP_ORDER.map((key) => {
                    const step = stepByKey.get(key);
                    const href = journeyRouteFor(key);
                    const label = journeyLabelFor(key, step?.label);
                    const isChildActive = pathname === href;
                    const isCurrent = step?.state === "CURRENT";
                    // Unknown state (loading/error/missing) must NOT unlock navigation.
                    const isNavigable =
                      Boolean(step) &&
                      (step!.state === "COMPLETED" ||
                        step!.state === "CURRENT" ||
                        step!.state === "AVAILABLE" ||
                        step!.state === "WAITING");
                    const tip = statusExplanation(
                      step,
                      journeyError ? "ERROR" : "LOADING",
                    );
                    const stateForIcon: JourneyStepState | "LOADING" | "ERROR" =
                      step?.state ?? (journeyError ? "ERROR" : "LOADING");

                    if (!isNavigable) {
                      return (
                        <li key={key}>
                          <div
                            role="link"
                            aria-disabled="true"
                            tabIndex={0}
                            title={tip}
                            className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm text-white/40"
                            onClick={(e) => e.preventDefault()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                              }
                            }}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span>{label}</span>
                              <span
                                title={tip}
                                aria-label={tip}
                                tabIndex={0}
                                role="img"
                                className="rounded p-0.5"
                              >
                                {statusIcon(stateForIcon)}
                              </span>
                            </span>
                            <span className="sr-only">{tip}</span>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={key}>
                        <Link
                          href={href}
                          title={tip}
                          onClick={() => setSidebarOpen(false)}
                          className={`block rounded-lg px-3 py-2 text-sm transition-all ${
                            isChildActive
                              ? "bg-white/20 font-semibold text-white shadow-2xs"
                              : isCurrent
                                ? "bg-white/10 font-medium text-white"
                                : "text-white/75 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span>{label}</span>
                            <span
                              title={tip}
                              aria-label={tip}
                              tabIndex={0}
                              role="img"
                              className="rounded p-0.5"
                            >
                              {statusIcon(stateForIcon)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>

            {bottomNavItems.map((item) => {
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

      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-64"
        }`}
      >
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
            <PortalBreadcrumbs portal="student" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-xs font-semibold text-[#333333]">
                {session?.user?.name || session?.user?.email || "Student"}
              </span>
              <span className="text-[11px] font-medium text-gray-500">
                Student Portal
              </span>
            </div>
            <NotificationBell role="STUDENT" />
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e02b20] text-sm font-bold text-white uppercase shadow-xs"
              title={session?.user?.email || "Student"}
            >
              {session?.user?.email?.charAt(0).toUpperCase() || "S"}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <ChatbotWidget />
    </div>
  );
}
