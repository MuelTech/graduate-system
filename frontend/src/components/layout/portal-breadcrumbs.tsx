"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface TrailItem {
  label: string;
  href?: string;
}

const ROUTE_LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  users: "User Management",
  applicants: "Applicants",
  students: "Students",
  faculty: "Faculty",
  panelists: "Faculty",
  administrators: "Administrators",
  exam: "Exam Management",
  slots: "Exam Schedules",
  applications: "Applications & Records",
  questions: "Exam Questions",
  cor: "COR Verification",
  waiver: "Waiver Validation",
  thesis: "Thesis Management",
  scheduling: "Scheduling & Panels",
  "defense-records": "Defense Records",
  advisers: "Adviser Request Review",
  analytics: "Analytics & Reports",
  settings: "System Settings",
  storage: "Storage Health",
  memos: "Announcements & Memos",
  repository: "Research Repository",
  notifications: "Notifications",
  profile: "Profile",
  curriculum: "Curriculum",
  journey: "Academic Journey",
  "title-defense": "Title Defense",
  "adviser-request": "Adviser Request",
  "proposal-defense": "Proposal Defense",
  strike: "STRIKE / Plagiarism",
  "final-defense": "Final Defense",
  announcements: "Announcements",
  "essay-evaluations": "Essay Evaluations",
  defenses: "My Defenses",
  "defense-workspace": "Defense Workspace",
  "defense-lobby": "Defense Lobby",
  scoring: "Evaluation & Scoring",
  materials: "Defense Materials",
  advisees: "My Advisees",
  signatures: "E-Signatures",
  alignment: "Program Alignment",
  schedule: "Exam Schedule",
  results: "Exam Results",
  "cor-upload": "COR Upload",
};

const NON_LINKABLE_GROUPS = new Set(["users", "exam", "thesis"]);

function formatSegmentLabel(segment: string, portal: string, prev?: string): string {
  if (portal === "student" && segment === "thesis") {
    return "Thesis Journey";
  }
  if (portal === "applicant" && segment === "exam") {
    return "Entrance Exam";
  }
  if (portal === "admin" && prev === "exam" && segment === "applications") {
    return "Exam Records";
  }
  if (portal === "admin" && prev === "thesis" && segment === "applications") {
    return "Defense Applications";
  }
  if (ROUTE_LABEL_MAP[segment]) {
    return ROUTE_LABEL_MAP[segment];
  }
  if (/^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment)) {
    return "Details";
  }
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function PortalBreadcrumbs({
  portal,
}: {
  portal: "admin" | "faculty" | "student" | "applicant";
}) {
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/^\/panelist/, "/faculty");
  const segments = normalizedPathname.split("/").filter(Boolean);

  const dashboardHref =
    portal === "admin"
      ? "/admin/dashboard"
      : portal === "faculty"
        ? "/faculty/dashboard"
        : portal === "student"
          ? "/student/dashboard"
          : "/applicant/dashboard";

  const trail: TrailItem[] = [{ label: "Dashboard", href: dashboardHref }];

  // Skip the first segment ("admin" | "faculty" | "student" | "applicant")
  const subSegments = segments.slice(1);

  if (subSegments.length === 0 || (subSegments.length === 1 && subSegments[0] === "dashboard")) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  subSegments.forEach((seg, index) => {
    const prev = index > 0 ? subSegments[index - 1] : undefined;
    const label = formatSegmentLabel(seg, portal, prev);
    const isLast = index === subSegments.length - 1;
    const accumulatedPath = `/${segments[0]}/${subSegments.slice(0, index + 1).join("/")}`;
    const isGroupOnly =
      NON_LINKABLE_GROUPS.has(seg) &&
      !(portal === "applicant" && seg === "exam");

    trail.push({
      label,
      href: isLast || isGroupOnly ? undefined : accumulatedPath,
    });
  });

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList>
        {trail.map((item, idx) => {
          const isLast = idx === trail.length - 1;
          return (
            <React.Fragment key={`${item.label}-${idx}`}>
              <BreadcrumbItem>
                {!isLast && item.href ? (
                  <Link
                    href={item.href}
                    className="text-gray-500 transition-colors hover:text-[#333333]"
                  >
                    {item.label}
                  </Link>
                ) : !isLast ? (
                  <span className="text-gray-500">{item.label}</span>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
