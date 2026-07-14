"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Eye,
  ShieldCheck,
  Upload,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

export default function AdminApplicantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const applicants = [
    {
      id: 1,
      name: "Juan Dela Cruz",
      email: "juan.delacruz@gmail.com",
      pinnacleId: "PIN-2026-001",
      program: "MSCS",
      applicationDate: "May 1, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      examStatus: "scheduled" as "none" | "scheduled" | "passed" | "failed",
      corStatus: "pending" as "none" | "pending" | "verified",
      admissionStatus: "applicant" as "applicant" | "enrolled" | "disqualified",
      strikeCount: 0,
    },
    {
      id: 2,
      name: "Maria Santos",
      email: "maria.santos@gmail.com",
      pinnacleId: "PIN-2026-002",
      program: "MSCS",
      applicationDate: "May 3, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      examStatus: "passed" as "none" | "scheduled" | "passed" | "failed",
      corStatus: "verified" as "none" | "pending" | "verified",
      admissionStatus: "enrolled" as "applicant" | "enrolled" | "disqualified",
      strikeCount: 0,
    },
    {
      id: 3,
      name: "Pedro Reyes",
      email: "pedro.reyes@gmail.com",
      pinnacleId: "PIN-2026-003",
      program: "MIT",
      applicationDate: "May 5, 2026",
      alignmentStatus: "pending_waiver" as
        | "aligned"
        | "pending_waiver"
        | "cleared",
      examStatus: "none" as "none" | "scheduled" | "passed" | "failed",
      corStatus: "none" as "none" | "pending" | "verified",
      admissionStatus: "applicant" as "applicant" | "enrolled" | "disqualified",
      strikeCount: 0,
    },
    {
      id: 4,
      name: "Ana Garcia",
      email: "ana.garcia@gmail.com",
      pinnacleId: "PIN-2026-004",
      program: "MAED",
      applicationDate: "May 8, 2026",
      alignmentStatus: "cleared" as "aligned" | "pending_waiver" | "cleared",
      examStatus: "scheduled" as "none" | "scheduled" | "passed" | "failed",
      corStatus: "none" as "none" | "pending" | "verified",
      admissionStatus: "applicant" as "applicant" | "enrolled" | "disqualified",
      strikeCount: 1,
    },
    {
      id: 5,
      name: "Carlos Luna",
      email: "carlos.luna@gmail.com",
      pinnacleId: "PIN-2026-005",
      program: "PhD Education",
      applicationDate: "May 10, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      examStatus: "failed" as "none" | "scheduled" | "passed" | "failed",
      corStatus: "none" as "none" | "pending" | "verified",
      admissionStatus: "applicant" as "applicant" | "enrolled" | "disqualified",
      strikeCount: 0,
    },
    {
      id: 6,
      name: "Elena Torres",
      email: "elena.torres@gmail.com",
      pinnacleId: "PIN-2026-006",
      program: "MSCS",
      applicationDate: "May 12, 2026",
      alignmentStatus: "pending_waiver" as
        | "aligned"
        | "pending_waiver"
        | "cleared",
      examStatus: "none" as "none" | "scheduled" | "passed" | "failed",
      corStatus: "none" as "none" | "pending" | "verified",
      admissionStatus: "applicant" as "applicant" | "enrolled" | "disqualified",
      strikeCount: 0,
    },
    {
      id: 7,
      name: "Roberto Lim",
      email: "roberto.lim@gmail.com",
      pinnacleId: "PIN-2026-007",
      program: "DIT",
      applicationDate: "May 15, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      examStatus: "passed" as "none" | "scheduled" | "passed" | "failed",
      corStatus: "pending" as "none" | "pending" | "verified",
      admissionStatus: "applicant" as "applicant" | "enrolled" | "disqualified",
      strikeCount: 0,
    },
  ];

  const filters = [
    { value: "all", label: "All" },
    { value: "pending_alignment", label: "Pending Alignment" },
    { value: "pending_waiver", label: "Pending Waiver" },
    { value: "waiver_cleared", label: "Waiver Cleared" },
    { value: "exam_scheduled", label: "Exam Scheduled" },
    { value: "exam_passed", label: "Exam Passed" },
    { value: "exam_failed", label: "Exam Failed" },
    { value: "cor_pending", label: "COR Pending" },
    { value: "enrolled", label: "Promoted to Student" },
  ];

  const filteredApplicants = applicants.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.pinnacleId.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    switch (statusFilter) {
      case "pending_waiver":
        return app.alignmentStatus === "pending_waiver";
      case "waiver_cleared":
        return app.alignmentStatus === "cleared";
      case "exam_scheduled":
        return app.examStatus === "scheduled";
      case "exam_passed":
        return app.examStatus === "passed";
      case "exam_failed":
        return app.examStatus === "failed";
      case "cor_pending":
        return app.corStatus === "pending";
      case "enrolled":
        return app.admissionStatus === "enrolled";
      default:
        return true;
    }
  });

  const getAlignmentBadge = (status: string) => {
    switch (status) {
      case "aligned":
        return (
          <Badge className="bg-green-100 text-green-700">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Aligned
          </Badge>
        );
      case "pending_waiver":
        return (
          <Badge className="bg-amber-100 text-amber-700">Pending Waiver</Badge>
        );
      case "cleared":
        return <Badge className="bg-blue-100 text-blue-700">Cleared</Badge>;
      default:
        return null;
    }
  };

  const getExamBadge = (status: string) => {
    switch (status) {
      case "none":
        return (
          <Badge className="bg-gray-100 text-gray-500">Not Scheduled</Badge>
        );
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "passed":
        return <Badge className="bg-green-100 text-green-700">Passed</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return null;
    }
  };

  const getCorBadge = (status: string) => {
    switch (status) {
      case "none":
        return <Badge className="bg-gray-100 text-gray-500">—</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case "verified":
        return <Badge className="bg-green-100 text-green-700">Verified</Badge>;
      default:
        return null;
    }
  };

  const getAdmissionBadge = (status: string) => {
    switch (status) {
      case "applicant":
        return <Badge className="bg-gray-100 text-gray-600">Applicant</Badge>;
      case "enrolled":
        return <Badge className="bg-green-100 text-green-700">Enrolled</Badge>;
      case "disqualified":
        return <Badge className="bg-red-100 text-red-700">Disqualified</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Applicant Management
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Manage applicant accounts
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or Applicant ID..."
                className="w-full rounded-lg border border-(--earist-border-gray) py-2 pr-3 pl-10 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
              />
            </div>
            {/* Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                {filters.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applicants Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Applicant ID
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Program
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Alignment
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Exam
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    COR
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Strikes
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-(--earist-secondary)">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredApplicants.map((app) => (
                  <tr
                    key={app.id}
                    className="border-b border-(--earist-border-gray) last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-(--earist-primary)">
                          {app.name}
                        </p>
                        <p className="text-xs text-(--earist-body-text)">
                          {app.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                      {app.pinnacleId}
                    </td>
                    <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                      {app.program}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getAlignmentBadge(app.alignmentStatus)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getExamBadge(app.examStatus)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getCorBadge(app.corStatus)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getAdmissionBadge(app.admissionStatus)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {app.strikeCount > 0 ? (
                        <Badge className="bg-red-100 text-red-700">
                          {app.strikeCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-(--earist-body-text)">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {app.alignmentStatus === "pending_waiver" && (
                          <button
                            className="rounded p-1.5 text-amber-600 hover:bg-amber-50"
                            title="Validate Waiver"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        )}
                        {app.corStatus === "pending" && (
                          <button
                            className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                            title="View COR"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
                        )}
                        {app.examStatus === "passed" &&
                          app.corStatus === "verified" && (
                            <button
                              className="rounded p-1.5 text-green-600 hover:bg-green-50"
                              title="Promote to Student"
                            >
                              <GraduationCap className="h-4 w-4" />
                            </button>
                          )}
                        {app.strikeCount > 0 && (
                          <button
                            className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                            title="Reset Strike Count"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-(--earist-border-gray) px-4 py-3">
            <p className="text-xs text-(--earist-body-text)">
              Showing {filteredApplicants.length} of {applicants.length}{" "}
              applicants
            </p>
            <div className="flex items-center gap-1">
              <button className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="rounded bg-(--earist-primary) px-2 py-1 text-xs text-white">
                1
              </button>
              <button className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
