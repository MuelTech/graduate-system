"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Eye,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  FileText,
  BookOpen,
} from "lucide-react";

export default function AdminStudentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  const students = [
    {
      id: 1,
      name: "Maria Santos",
      studentNumber: "2026-GS-00456",
      email: "maria.santos@gmail.com",
      program: "MSCS",
      enrollmentDate: "June 1, 2026",
      thesisStage: "proposal_defense" as
        | "title_defense"
        | "proposal_defense"
        | "final_defense"
        | "completed",
      compExam: "passed" as "pending" | "passed" | "failed",
      residencyStart: "2026",
      adviser: "Dr. Roberto Reyes",
      status: "active" as "active" | "on_leave" | "graduated",
    },
    {
      id: 2,
      name: "Juan Dela Cruz",
      studentNumber: "2026-GS-00457",
      email: "juan.delacruz@gmail.com",
      program: "MSCS",
      enrollmentDate: "June 1, 2026",
      thesisStage: "title_defense" as
        | "title_defense"
        | "proposal_defense"
        | "final_defense"
        | "completed",
      compExam: "passed" as "pending" | "passed" | "failed",
      residencyStart: "2026",
      adviser: null,
      status: "active" as "active" | "on_leave" | "graduated",
    },
    {
      id: 3,
      name: "Pedro Reyes",
      studentNumber: "2026-GS-00458",
      email: "pedro.reyes@gmail.com",
      program: "MIT",
      enrollmentDate: "June 1, 2026",
      thesisStage: "title_defense" as
        | "title_defense"
        | "proposal_defense"
        | "final_defense"
        | "completed",
      compExam: "pending" as "pending" | "passed" | "failed",
      residencyStart: "2026",
      adviser: null,
      status: "active" as "active" | "on_leave" | "graduated",
    },
    {
      id: 4,
      name: "Ana Garcia",
      studentNumber: "2025-GS-00312",
      email: "ana.garcia@gmail.com",
      program: "MAED",
      enrollmentDate: "January 15, 2025",
      thesisStage: "final_defense" as
        | "title_defense"
        | "proposal_defense"
        | "final_defense"
        | "completed",
      compExam: "passed" as "pending" | "passed" | "failed",
      residencyStart: "2025",
      adviser: "Dr. Pedro Lim",
      status: "active" as "active" | "on_leave" | "graduated",
    },
    {
      id: 5,
      name: "Carlos Luna",
      studentNumber: "2025-GS-00289",
      email: "carlos.luna@gmail.com",
      program: "PhD Education",
      enrollmentDate: "January 15, 2025",
      thesisStage: "completed" as
        | "title_defense"
        | "proposal_defense"
        | "final_defense"
        | "completed",
      compExam: "passed" as "pending" | "passed" | "failed",
      residencyStart: "2024",
      adviser: "Dr. Roberto Reyes",
      status: "graduated" as "active" | "on_leave" | "graduated",
    },
    {
      id: 6,
      name: "Elena Torres",
      studentNumber: "2026-GS-00459",
      email: "elena.torres@gmail.com",
      program: "MSCS",
      enrollmentDate: "June 1, 2026",
      thesisStage: "title_defense" as
        | "title_defense"
        | "proposal_defense"
        | "final_defense"
        | "completed",
      compExam: "passed" as "pending" | "passed" | "failed",
      residencyStart: "2026",
      adviser: "Dr. Ana Garcia",
      status: "active" as "active" | "on_leave" | "graduated",
    },
    {
      id: 7,
      name: "Roberto Lim",
      studentNumber: "2024-GS-00198",
      email: "roberto.lim@gmail.com",
      program: "DIT",
      enrollmentDate: "January 15, 2024",
      thesisStage: "proposal_defense" as
        | "title_defense"
        | "proposal_defense"
        | "final_defense"
        | "completed",
      compExam: "passed" as "pending" | "passed" | "failed",
      residencyStart: "2024",
      adviser: "Dr. Juan Dela Cruz",
      status: "active" as "active" | "on_leave" | "graduated",
    },
  ];

  const programs = [...new Set(students.map((s) => s.program))];

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (programFilter !== "all" && s.program !== programFilter) return false;
    if (stageFilter !== "all" && s.thesisStage !== stageFilter) return false;

    return true;
  });

  const activeCount = students.filter((s) => s.status === "active").length;
  const graduatedCount = students.filter(
    (s) => s.status === "graduated",
  ).length;
  const pendingAdviser = students.filter((s) => s.adviser === null).length;

  const getThesisStageBadge = (stage: string) => {
    switch (stage) {
      case "title_defense":
        return (
          <Badge className="bg-blue-100 text-blue-700">Title Defense</Badge>
        );
      case "proposal_defense":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            Proposal Defense
          </Badge>
        );
      case "final_defense":
        return (
          <Badge className="bg-purple-100 text-purple-700">Final Defense</Badge>
        );
      case "completed":
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      default:
        return null;
    }
  };

  const getCompExamBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-gray-100 text-gray-500">Pending</Badge>;
      case "passed":
        return <Badge className="bg-green-100 text-green-700">Passed</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case "on_leave":
        return <Badge className="bg-amber-100 text-amber-700">On Leave</Badge>;
      case "graduated":
        return <Badge className="bg-blue-100 text-blue-700">Graduated</Badge>;
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
          Student Management
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          View and manage enrolled student accounts and thesis progress
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Total Students
            </p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {students.length}
            </p>
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
            <p className="text-lg font-bold text-amber-600">{pendingAdviser}</p>
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, student number, or email..."
                className="w-full rounded-lg border border-(--earist-border-gray) py-2 pr-3 pl-10 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Programs</option>
                {programs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Stages</option>
                <option value="title_defense">Title Defense</option>
                <option value="proposal_defense">Proposal Defense</option>
                <option value="final_defense">Final Defense</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Program
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Thesis Stage
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Comp Exam
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Adviser
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Residency
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
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-(--earist-border-gray) last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-(--earist-primary)">
                          {student.name}
                        </p>
                        <p className="text-xs text-(--earist-body-text)">
                          {student.studentNumber}
                        </p>
                        <p className="text-xs text-(--earist-body-text)">
                          {student.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                      {student.program}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getThesisStageBadge(student.thesisStage)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getCompExamBadge(student.compExam)}
                    </td>
                    <td className="px-4 py-3">
                      {student.adviser ? (
                        <p className="text-xs text-(--earist-body-text)">
                          {student.adviser}
                        </p>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">
                          Not Assigned
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-xs text-(--earist-body-text)">
                        Since {student.residencyStart}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(student.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                          title="View Thesis Progress"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                          title="View Curriculum"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
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
              Showing {filteredStudents.length} of {students.length} students
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
