"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientRequest } from "@/lib/api.client";
import { toast } from "sonner";
import {
  Search,
  Eye,
  CalendarClock,
  X,
  Clipboard,
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

interface Application {
  id: string;
  name: string;
  email: string;
  pinnacleId: string;
  program: string;
  scheduledSlot: string;
  status: string;
}

interface ApiApplication {
  id: string;
  slot?: {
    examDate: string;
    examTime: string;
  };
  student: {
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
    pinnacleApplicantId?: string;
  };
  program: {
    programName: string;
  };
  status: string;
}

export default function AdminExamApplicationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [page, setPage] = useState(1);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const data = await apiClientRequest("/exam/applications");

      const mappedData = data.map((app: ApiApplication): Application => {
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
          status: app.status.toLowerCase(),
        };
      });
      setApplications(mappedData);
    } catch (error) {
      toast.error("Failed to load applications");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

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

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const scheduledCount = applications.filter(
    (a) => a.status === "scheduled" || a.status === "approved",
  ).length;
  const completedCount = applications.filter(
    (a) => a.status === "completed" || a.status === "passed" || a.status === "failed",
  ).length;
  const passedCount = applications.filter((a) => a.status === "passed").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case "scheduled":
      case "approved":
        return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "completed":
        return <Badge className="bg-gray-100 text-gray-700">Completed</Badge>;
      case "passed":
        return <Badge className="bg-green-100 text-green-700">Passed</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500 animate-pulse">Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          Entrance Exam Applications
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
            <p className="text-xs text-(--earist-body-text)">Scheduled</p>
            <p className="text-lg font-bold text-blue-600">{scheduledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Completed</p>
            <p className="text-lg font-bold text-gray-600">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Passed</p>
            <p className="text-lg font-bold text-green-600">{passedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, or Pinnacle ID..."
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Applicant</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pinnacle ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Program</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Scheduled Slot</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedApplications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No applications found
                    </td>
                  </tr>
                ) : (
                  paginatedApplications.map((app) => (
                    <tr key={app.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{app.name}</p>
                          <p className="text-sm text-gray-500">{app.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{app.pinnacleId}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{app.program}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <CalendarClock className="h-4 w-4 text-gray-400" />
                          {app.scheduledSlot}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(app.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedApp(app)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredApplications.length)} of {filteredApplications.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage(page - 1)}
                      className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage(page + 1)}
                      className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">Application Details</h3>
              <button
                onClick={() => setSelectedApp(null)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">{selectedApp.name}</p>
                <p className="text-xs text-gray-500">{selectedApp.email}</p>
                <p className="text-xs text-gray-500">{selectedApp.pinnacleId}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Program</p>
                  <p className="text-sm font-medium text-gray-900">{selectedApp.program}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Scheduled Slot</p>
                  <p className="text-sm font-medium text-gray-900">{selectedApp.scheduledSlot}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  {getStatusBadge(selectedApp.status)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {(selectedApp.status === "passed" || selectedApp.status === "failed") && (
                <Link href="/admin/exam/scores" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <Clipboard className="mr-2 h-4 w-4" />
                    View Scores
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                onClick={() => setSelectedApp(null)}
                className="flex-1"
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
