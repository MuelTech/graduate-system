"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import {
  Search,
  Filter,
  Eye,
  CalendarClock,
  AlertTriangle,
  X,
  RotateCcw,
  Ban,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import { ExamApplication, ApiExamApplication } from "@/types";

export default function AdminExamApplicationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<ExamApplication | null>(null);
  const [page, setPage] = useState(1);
  const [applications, setApplications] = useState<ExamApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;
  const { data: session } = useSession();

   const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5000/api/exam/applications", {
        headers: {
          Authorization: `Bearer ${session?.user?.accessToken}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch applications");
      const data = await res.json();

      const mappedData = data.map(
        (app: ApiExamApplication): ExamApplication => {
          let scheduledSlot = "N/A";
          if (app.slot) {
            const dateStr = format(new Date(app.slot.examDate), "MMMM d, yyyy");
            const timeStr = format(new Date(app.slot.examTime), "h:mm a");
            scheduledSlot = `${dateStr} — ${timeStr}`;
          }
          return {
            id: app.id,
            name: `${app.student.user.firstName} ${app.student.user.lastName}`,
            email: app.student.user.email,
            pinnacleId: app.student.pinnacleApplicantId || "N/A",
            program: app.program.programName,
            scheduledSlot,
            alignmentStatus:
              app.student.alignmentStatus?.toLowerCase() || "aligned",
            strikeCount: app.strikeCount,
            status: app.status.toLowerCase(),
          };
        },
      );
      setApplications(mappedData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [session]);
  useEffect(() => {
    const init = async () => {
      if (session?.user?.accessToken) {
        await fetchApplications();
      }
    };
    init();
  }, [session, fetchApplications]);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset page on filter change instead of using useEffect
  };
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1); // Reset page on filter change instead of using useEffect
  };
  const handleResetStrikes = async (id: string) => {
    if (!confirm("Are you sure you want to reset strikes for this applicant?"))
      return;
    try {
      const res = await fetch(
        `http://localhost:5000/api/exam/applications/${id}/reset-strikes`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );
      if (res.ok) {
        if (selectedApp?.id === id) {
          setSelectedApp({ ...selectedApp, strikeCount: 0 });
        }
        await fetchApplications();
      }
    } catch (error) {
      console.error(error);
    }
  };
  const handleDisqualify = async (id: string) => {
    if (!confirm("Are you sure you want to disqualify this applicant?")) return;
    try {
      const res = await fetch(
        `http://localhost:5000/api/exam/applications/${id}/disqualify`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );
      if (res.ok) {
        if (selectedApp?.id === id) {
          setSelectedApp({
            ...selectedApp,
            strikeCount: 2,
            status: "disqualified",
          });
        }
        await fetchApplications();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.pinnacleId.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredApplications.length / pageSize);
  const paginatedApplications = filteredApplications.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const pendingCount = applications.filter(
    (a) => a.status === "pending",
  ).length;
  const confirmedCount = applications.filter(
    (a) => a.status === "confirmed" || a.status === "approved",
  ).length;
  const completedCount = applications.filter(
    (a) =>
      a.status === "completed" ||
      a.status === "passed" ||
      a.status === "failed",
  ).length;
  const disqualifiedCount = applications.filter(
    (a) => a.status === "disqualified",
  ).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case "approved":
      case "confirmed":
        return <Badge className="bg-blue-100 text-blue-700">Confirmed</Badge>;
      case "passed":
      case "failed":
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
        return (
          <Badge className="bg-amber-100 text-amber-700">Pending Waiver</Badge>
        );
      case "cleared":
        return <Badge className="bg-blue-100 text-blue-700">Cleared</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading applications...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Exam Application Review
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review and manage entrance exam applications
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Pending</p>
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Confirmed</p>
            <p className="text-lg font-bold text-blue-600">{confirmedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Completed</p>
            <p className="text-lg font-bold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Disqualified</p>
            <p className="text-lg font-bold text-red-600">
              {disqualifiedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by name, email, or Pinnacle ID..."
                className="w-full rounded-lg border border-(--earist-border-gray) py-2 pr-3 pl-10 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={statusFilter}
                onChange={handleFilterChange}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
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
                <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Applicant
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Pinnacle ID
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Program
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Scheduled Slot
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Alignment
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Strikes
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-(--earist-secondary)">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedApplications.map((app) => (
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-(--earist-body-text)">
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
                        <span className="text-xs text-(--earist-body-text)">
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
                          className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                          title="View Details"
                          onClick={() => setSelectedApp(app)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {app.strikeCount > 0 && (
                          <button
                            className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                            title="Reset Strike Count"
                            onClick={() => handleResetStrikes(app.id)}
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
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredApplications.length)} of{" "}
              {filteredApplications.length} applications
            </p>
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage(page - 1);
                      }}
                      className={
                        page <= 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href="#"
                          isActive={p === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) setPage(page + 1);
                      }}
                      className={
                        page >= totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Application Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Application Details
              </h3>
              <button
                onClick={() => setSelectedApp(null)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {selectedApp.name}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedApp.email}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedApp.pinnacleId}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-(--earist-body-text)">Program</p>
                  <p className="text-sm font-medium text-(--earist-primary)">
                    {selectedApp.program}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">Alignment</p>
                  {getAlignmentBadge(selectedApp.alignmentStatus)}
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">
                    Scheduled Slot
                  </p>
                  <p className="text-sm font-medium text-(--earist-primary)">
                    {selectedApp.scheduledSlot}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">
                    Strike Count
                  </p>
                  <p className="text-sm font-medium text-(--earist-primary)">
                    {selectedApp.strikeCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">Status</p>
                  {getStatusBadge(selectedApp.status)}
                </div>
              </div>
              {selectedApp.strikeCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-700">
                    Strike Management
                  </p>
                  <p className="text-xs text-amber-600">
                    {selectedApp.strikeCount >= 2
                      ? "This applicant has been disqualified (2 strikes)."
                      : `${selectedApp.strikeCount} strike(s) recorded. Two strikes result in disqualification.`}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetStrikes(selectedApp.id)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Reset Strikes
                    </Button>
                    {selectedApp.strikeCount < 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() => handleDisqualify(selectedApp.id)}
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
