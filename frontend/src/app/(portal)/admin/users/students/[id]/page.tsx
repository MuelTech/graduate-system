"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClientRequest } from "@/lib/api.client";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  GraduationCap,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
  Shield,
  Clock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminStudentDetail } from "@/types";
import { toast } from "sonner";

export default function StudentDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const studentId = params.id as string;

  const { data: student, isLoading } = useQuery<AdminStudentDetail>({
    queryKey: ["adminStudentDetail", studentId],
    queryFn: async () => {
      return await apiClientRequest(`/admin/students/${studentId}`);
    },
  });

  const markCompExamMutation = useMutation({
    mutationFn: async (status: "PASSED" | "FAILED") => {
      return await apiClientRequest(`/admin/students/${studentId}/comprehensive-exam`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["adminStudentDetail", studentId] });
      queryClient.invalidateQueries({ queryKey: ["adminStudents"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

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

  const getThesisStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-gray-100 text-gray-500">Pending</Badge>;
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "PASSED":
        return <Badge className="bg-green-100 text-green-700">Passed</Badge>;
      case "FAILED":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      case "REVISION":
        return <Badge className="bg-amber-100 text-amber-700">Revision</Badge>;
      default:
        return <Badge variant="outline">{status || "--"}</Badge>;
    }
  };

  const getAdmissionBadge = (status: string) => {
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

  const getAlignmentBadge = (status: string) => {
    switch (status) {
      case "ALIGNED":
        return <Badge className="bg-green-100 text-green-700">Aligned</Badge>;
      case "PENDING_WAIVER":
        return <Badge className="bg-amber-100 text-amber-700">Pending Waiver</Badge>;
      case "CLEARED":
        return <Badge className="bg-blue-100 text-blue-700">Cleared</Badge>;
      default:
        return <Badge variant="outline">{status || "--"}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500 animate-pulse">Loading student details...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Student not found</p>
        <Link href="/admin/users/students">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users/students">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Student Profile
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            {student.firstName} {student.lastName} — {student.studentNumber}
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{student.firstName} {student.lastName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Student Number</p>
                <p className="font-medium">{student.studentNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{student.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{student.cellphone || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className="font-medium">{formatDate(student.dateOfBirth)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <GraduationCap className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Program</p>
                <p className="font-medium">{student.program.programName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Enrollment Date</p>
                <p className="font-medium">{formatDate(student.enrollmentDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {getAdmissionBadge(student.admissionStatus)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comprehensive Exam */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Comprehensive Examination
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Current Status</p>
                {getCompExamBadge(student.compExamStatus)}
              </div>
              <div>
                <p className="text-sm text-gray-500">Strike Count</p>
                <p className="font-medium">{student.compExamStrikes}</p>
              </div>
            </div>

            {student.compExamRecords.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Exam History</p>
                <div className="space-y-2">
                  {student.compExamRecords.map((record, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{formatDate(record.createdAt)}</span>
                      {getCompExamBadge(record.status)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {student.compExamStatus !== "PASSED" && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (confirm("Mark comprehensive exam as PASSED?")) {
                      markCompExamMutation.mutate("PASSED");
                    }
                  }}
                  disabled={markCompExamMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {markCompExamMutation.isPending ? "Updating..." : "Mark as Passed"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Mark comprehensive exam as FAILED? This will increment the strike count.")) {
                      markCompExamMutation.mutate("FAILED");
                    }
                  }}
                  disabled={markCompExamMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {markCompExamMutation.isPending ? "Updating..." : "Mark as Failed"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thesis Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Thesis Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Current Stage</p>
              {getThesisStageBadge(student.thesisStage)}
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              {getThesisStatusBadge(student.thesisStatus)}
            </div>
            <div>
              <p className="text-sm text-gray-500">Adviser</p>
              {student.adviserAssignment ? (
                <div>
                  <p className="font-medium">
                    {student.adviserAssignment.adviser.firstName} {student.adviserAssignment.adviser.lastName}
                  </p>
                  <p className="text-xs text-gray-500">Assigned: {formatDate(student.adviserAssignment.assignedDate)}</p>
                </div>
              ) : (
                <Badge className="bg-amber-100 text-amber-700">Not Assigned</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Academic Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Residency Start</p>
                <p className="font-medium">{formatDate(student.residencyStartDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Max Residency (Years)</p>
                <p className="font-medium">{student.residencyMaxYears ?? "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BookOpen className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Curriculum Type</p>
                <p className="font-medium">{student.curriculumType || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Alignment Status</p>
                {getAlignmentBadge(student.alignmentStatus)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
