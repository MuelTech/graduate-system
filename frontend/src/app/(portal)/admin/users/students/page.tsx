"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientRequest } from "@/lib/api.client";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Eye, Search, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AdminStudentListItem } from "@/types";

export default function AdminStudentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [programFilter, setProgramFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["adminStudents", page, search, programFilter, stageFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "10",
        search,
        program: programFilter,
        thesisStage: stageFilter,
      });
      const res = await apiClientRequest(`/admin/students?${params.toString()}`);
      return res;
    },
  });

  const students: AdminStudentListItem[] = data?.students || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 10);

  // Summary counts from API response
  const activeCount = data?.activeCount ?? students.filter((s) => s.admissionStatus === "ENROLLED").length;
  const graduatedCount = data?.graduatedCount ?? students.filter((s) => s.admissionStatus === "GRADUATED").length;
  const noAdviserCount = data?.noAdviserCount ?? students.filter((s) => !s.adviser).length;

  const getThesisStageBadge = (stage: string) => {
    switch (stage) {
      case "TITLE":
        return <Badge className="bg-blue-100 text-blue-700">Title Defense</Badge>;
      case "PROPOSAL":
        return <Badge className="bg-amber-100 text-amber-700">Proposal Defense</Badge>;
      case "FINAL":
        return <Badge className="bg-purple-100 text-purple-700">Final Defense</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case "NONE":
        return <Badge variant="outline">None</Badge>;
      default:
        return <Badge variant="outline">{stage}</Badge>;
    }
  };

  const getCompExamBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-gray-100 text-gray-500">Pending</Badge>;
      case "PASSED":
        return <Badge className="bg-green-100 text-green-700">Passed</Badge>;
      case "FAILED":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="outline">{status || "--"}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ENROLLED":
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case "GRADUATED":
        return <Badge className="bg-blue-100 text-blue-700">Graduated</Badge>;
      case "ON_LEAVE":
        return <Badge className="bg-amber-100 text-amber-700">On Leave</Badge>;
      case "DISMISSED":
        return <Badge className="bg-red-100 text-red-700">Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Student Management
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            View and manage enrolled student accounts and thesis progress
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Total Students</p>
            <p className="text-lg font-bold text-(--earist-primary)">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Active</p>
            <p className="text-lg font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Graduated</p>
            <p className="text-lg font-bold text-blue-600">{graduatedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">No Adviser</p>
            <p className="text-lg font-bold text-amber-600">{noAdviserCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400 -translate-y-1/2" />
              <Input
                placeholder="Search by name, student number, or email..."
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
                value={programFilter}
                onChange={(e) => {
                  setProgramFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Programs</option>
                <option value="MSCS">Master of Science in Computer Science</option>
                <option value="MIT">Master of Information Technology</option>
                <option value="MAED">Master of Arts in Education</option>
                <option value="PhD Education">Doctor of Philosophy in Education</option>
                <option value="DIT">Doctor of Information Technology</option>
              </select>
              <select
                value={stageFilter}
                onChange={(e) => {
                  setStageFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Thesis Stages</option>
                <option value="TITLE">Title Defense</option>
                <option value="PROPOSAL">Proposal Defense</option>
                <option value="FINAL">Final Defense</option>
                <option value="COMPLETED">Completed</option>
                <option value="NONE">None</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500 animate-pulse">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No students found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Program</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Thesis Stage</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Comp Exam</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Adviser</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{student.studentNumber}</p>
                          <p className="text-xs text-gray-500">{student.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {student.program.programName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getThesisStageBadge(student.thesisStage)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getCompExamBadge(student.compExamStatus)}
                      </td>
                      <td className="px-4 py-3">
                        {student.adviser ? (
                          <p className="text-sm text-gray-700">{student.adviser}</p>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">Not Assigned</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(student.admissionStatus)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/users/students/${student.id}`}>
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
            Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total} students
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
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
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
    </div>
  );
}
