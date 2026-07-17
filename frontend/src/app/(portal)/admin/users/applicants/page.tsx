"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientRequest } from "@/lib/api.client";
import { Eye, Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AdminApplicantListItem } from "@/types";

export default function AdminApplicantsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [alignmentFilter, setAlignmentFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [corFilter, setCorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["adminApplicants", page, search, alignmentFilter, examFilter, corFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "10",
        search,
        alignment: alignmentFilter,
        exam: examFilter,
        cor: corFilter,
        status: statusFilter,
      });
      const res = await apiClientRequest(`/admin/applicants?${params.toString()}`);
      return res;
    },
  });

  const applicants: AdminApplicantListItem[] = data?.applicants || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 10);

  const getAlignmentBadge = (status: string) => {
    switch (status) {
      case "ALIGNED":
        return <Badge className="bg-green-100 text-green-700">Aligned</Badge>;
      case "PENDING_WAIVER":
        return <Badge className="bg-amber-100 text-amber-700">Pending Waiver</Badge>;
      case "CLEARED":
        return <Badge className="bg-blue-100 text-blue-700">Cleared</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExamBadge = (status: string) => {
    switch (status) {
      case "NOT_SCHEDULED":
        return <Badge variant="outline">Not Scheduled</Badge>;
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "PASSED":
        return <Badge className="bg-green-100 text-green-700">Passed</Badge>;
      case "FAILED":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCorBadge = (status: string) => {
    switch (status) {
      case "NONE":
        return <Badge variant="outline">--</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-700">Verified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAdmissionBadge = (status: string) => {
    switch (status) {
      case "APPLICANT":
        return <Badge variant="outline">Applicant</Badge>;
      case "ENROLLED":
        return <Badge className="bg-green-100 text-green-700">Enrolled</Badge>;
      case "DISQUALIFIED":
        return <Badge className="bg-red-100 text-red-700">Disqualified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Applicant Management
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Manage all applicants and their application status
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400 -translate-y-1/2" />
              <Input
                placeholder="Search by name, email, Pinnacle ID, or program..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={alignmentFilter}
                onChange={(e) => {
                  setAlignmentFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Alignment</option>
                <option value="ALIGNED">Aligned</option>
                <option value="PENDING_WAIVER">Pending Waiver</option>
                <option value="CLEARED">Cleared</option>
              </select>
              <select
                value={examFilter}
                onChange={(e) => {
                  setExamFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Exam Status</option>
                <option value="NOT_SCHEDULED">Not Scheduled</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
              </select>
              <select
                value={corFilter}
                onChange={(e) => {
                  setCorFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All COR Status</option>
                <option value="NONE">None</option>
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Admission Status</option>
                <option value="APPLICANT">Applicant</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="DISQUALIFIED">Disqualified</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applicants Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500 animate-pulse">Loading applicants...</p>
            </div>
          ) : applicants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No applicants found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pinnacle ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Program</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Alignment</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Exam</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">COR</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((applicant) => (
                    <tr key={applicant.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {applicant.firstName} {applicant.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{applicant.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {applicant.pinnacleApplicantId}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {applicant.program.programName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getAlignmentBadge(applicant.alignmentStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getExamBadge(applicant.examStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getCorBadge(applicant.corStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getAdmissionBadge(applicant.admissionStatus)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/users/applicants/${applicant.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total} applicants
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
