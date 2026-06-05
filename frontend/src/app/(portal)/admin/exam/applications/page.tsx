"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Eye,
  ShieldCheck,
  CalendarClock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  Ban,
} from "lucide-react";

export default function AdminExamApplicationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<number | null>(null);

  const applications = [
    {
      id: 1,
      name: "Juan Dela Cruz",
      email: "juan.delacruz@gmail.com",
      pinnacleId: "PIN-2026-001",
      program: "MSCS",
      scheduledSlot: "June 15, 2026 — 9:00 AM",
      applicationDate: "May 5, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      strikeCount: 0,
      status: "confirmed" as "pending" | "confirmed" | "completed" | "disqualified",
    },
    {
      id: 2,
      name: "Maria Santos",
      email: "maria.santos@gmail.com",
      pinnacleId: "PIN-2026-002",
      program: "MSCS",
      scheduledSlot: "June 15, 2026 — 9:00 AM",
      applicationDate: "May 6, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      strikeCount: 0,
      status: "completed" as "pending" | "confirmed" | "completed" | "disqualified",
    },
    {
      id: 3,
      name: "Pedro Reyes",
      email: "pedro.reyes@gmail.com",
      pinnacleId: "PIN-2026-003",
      program: "MIT",
      scheduledSlot: "June 15, 2026 — 1:00 PM",
      applicationDate: "May 8, 2026",
      alignmentStatus: "pending_waiver" as "aligned" | "pending_waiver" | "cleared",
      strikeCount: 0,
      status: "pending" as "pending" | "confirmed" | "completed" | "disqualified",
    },
    {
      id: 4,
      name: "Ana Garcia",
      email: "ana.garcia@gmail.com",
      pinnacleId: "PIN-2026-004",
      program: "MAED",
      scheduledSlot: "June 18, 2026 — 9:00 AM",
      applicationDate: "May 10, 2026",
      alignmentStatus: "cleared" as "aligned" | "pending_waiver" | "cleared",
      strikeCount: 1,
      status: "confirmed" as "pending" | "confirmed" | "completed" | "disqualified",
    },
    {
      id: 5,
      name: "Carlos Luna",
      email: "carlos.luna@gmail.com",
      pinnacleId: "PIN-2026-005",
      program: "PhD Education",
      scheduledSlot: "June 15, 2026 — 9:00 AM",
      applicationDate: "May 12, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      strikeCount: 2,
      status: "disqualified" as "pending" | "confirmed" | "completed" | "disqualified",
    },
    {
      id: 6,
      name: "Elena Torres",
      email: "elena.torres@gmail.com",
      pinnacleId: "PIN-2026-006",
      program: "MSCS",
      scheduledSlot: "June 20, 2026 — 9:00 AM",
      applicationDate: "May 15, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      strikeCount: 0,
      status: "pending" as "pending" | "confirmed" | "completed" | "disqualified",
    },
    {
      id: 7,
      name: "Roberto Lim",
      email: "roberto.lim@gmail.com",
      pinnacleId: "PIN-2026-007",
      program: "DIT",
      scheduledSlot: "June 18, 2026 — 9:00 AM",
      applicationDate: "May 18, 2026",
      alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
      strikeCount: 0,
      status: "confirmed" as "pending" | "confirmed" | "completed" | "disqualified",
    },
  ];

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.pinnacleId.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter !== "all" && app.status !== statusFilter) return false;

    return true;
  });

  const selectedApplication = applications.find((a) => a.id === selectedApp);

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const confirmedCount = applications.filter((a) => a.status === "confirmed").length;
  const completedCount = applications.filter((a) => a.status === "completed").length;
  const disqualifiedCount = applications.filter((a) => a.status === "disqualified").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case "confirmed":
        return <Badge className="bg-blue-100 text-blue-700">Confirmed</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case "disqualified":
        return <Badge className="bg-red-100 text-red-700">Disqualified</Badge>;
      default:
        return null;
    }
  };

  const getAlignmentBadge = (status: string) => {
    switch (status) {
      case "aligned":
        return <Badge className="bg-green-100 text-green-700">Aligned</Badge>;
      case "pending_waiver":
        return <Badge className="bg-amber-100 text-amber-700">Pending Waiver</Badge>;
      case "cleared":
        return <Badge className="bg-blue-100 text-blue-700">Cleared</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Exam Application Review
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Review and manage entrance exam applications
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Pending</p>
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Confirmed</p>
            <p className="text-lg font-bold text-blue-600">{confirmedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Completed</p>
            <p className="text-lg font-bold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Disqualified</p>
            <p className="text-lg font-bold text-red-600">{disqualifiedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--earist-body-text)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or Pinnacle ID..."
                className="w-full rounded-lg border border-[var(--earist-border-gray)] py-2 pl-10 pr-3 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--earist-body-text)]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="disqualified">Disqualified</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--earist-border-gray)] bg-[var(--earist-surface-gray)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                    Applicant
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                    Pinnacle ID
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                    Program
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                    Scheduled Slot
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                    Alignment
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                    Strikes
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[var(--earist-secondary)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((app) => (
                  <tr
                    key={app.id}
                    className="border-b border-[var(--earist-border-gray)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-[var(--earist-primary)]">
                          {app.name}
                        </p>
                        <p className="text-xs text-[var(--earist-body-text)]">
                          {app.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--earist-body-text)]">
                      {app.pinnacleId}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--earist-body-text)]">
                      {app.program}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-[var(--earist-body-text)]">
                        <CalendarClock className="h-3 w-3" />
                        {app.scheduledSlot}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getAlignmentBadge(app.alignmentStatus)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {app.strikeCount >= 2 ? (
                        <Badge className="bg-red-100 text-red-700">
                          <Ban className="mr-1 h-3 w-3" />
                          {app.strikeCount}
                        </Badge>
                      ) : app.strikeCount > 0 ? (
                        <Badge className="bg-amber-100 text-amber-700">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {app.strikeCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-[var(--earist-body-text)]">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(app.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded p-1.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                          title="View Details"
                          onClick={() => setSelectedApp(app.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {app.strikeCount > 0 && (
                          <button
                            className="rounded p-1.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
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
          <div className="flex items-center justify-between border-t border-[var(--earist-border-gray)] px-4 py-3">
            <p className="text-xs text-[var(--earist-body-text)]">
              Showing {filteredApplications.length} of {applications.length}{" "}
              applications
            </p>
            <div className="flex items-center gap-1">
              <button className="rounded p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="rounded bg-[var(--earist-primary)] px-2 py-1 text-xs text-white">
                1
              </button>
              <button className="rounded p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Application Detail Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Application Details
              </h3>
              <button
                onClick={() => setSelectedApp(null)}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-[var(--earist-surface-gray)] p-3">
                <p className="text-sm font-semibold text-[var(--earist-primary)]">
                  {selectedApplication.name}
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  {selectedApplication.email}
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  {selectedApplication.pinnacleId}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Program</p>
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    {selectedApplication.program}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Alignment</p>
                  {getAlignmentBadge(selectedApplication.alignmentStatus)}
                </div>
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Scheduled Slot</p>
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    {selectedApplication.scheduledSlot}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Application Date</p>
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    {selectedApplication.applicationDate}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Strike Count</p>
                  <p className="text-sm font-medium text-[var(--earist-primary)]">
                    {selectedApplication.strikeCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Status</p>
                  {getStatusBadge(selectedApplication.status)}
                </div>
              </div>
              {selectedApplication.strikeCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-700">
                    Strike Management
                  </p>
                  <p className="text-xs text-amber-600">
                    {selectedApplication.strikeCount >= 2
                      ? "This applicant has been disqualified (2 strikes)."
                      : `${selectedApplication.strikeCount} strike(s) recorded. Two strikes result in disqualification.`}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm">
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Reset Strikes
                    </Button>
                    {selectedApplication.strikeCount < 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                      >
                        <Ban className="mr-1 h-3 w-3" />
                        Disqualify
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => setSelectedApp(null)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
