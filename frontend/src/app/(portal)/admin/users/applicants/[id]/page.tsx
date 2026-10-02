"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Shield,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminApplicantDetail } from "@/types";
import { toast } from "sonner";

export default function ApplicantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const applicantId = params.id as string;

  const [rejectNotes, setRejectNotes] = useState("");

  const { data: applicant, isLoading } = useQuery<AdminApplicantDetail>({
    queryKey: ["adminApplicantDetail", applicantId],
    queryFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}`);
    },
  });

  const validateWaiverMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/waiver/validate`, {
        method: "PUT",
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectWaiverMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/waiver/reject`, {
        method: "PUT",
        body: JSON.stringify({ adminNotes: rejectNotes }),
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setRejectNotes("");
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetStrikesMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/strikes/reset`, {
        method: "PUT",
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

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

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // DL-3: COR verification/promotion is authored exclusively by the canonical
  // COR Validation workflow. This detail view is read-only for COR authority.

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500 animate-pulse">Loading applicant details...</p>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Applicant not found</p>
        <Link href="/admin/users/applicants">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Applicants
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users/applicants">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Applicant Profile
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            {applicant.firstName} {applicant.lastName} — {applicant.pinnacleApplicantId}
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
                <p className="font-medium">{applicant.firstName} {applicant.lastName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{applicant.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Pinnacle Applicant ID</p>
                <p className="font-medium">{applicant.pinnacleApplicantId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{applicant.cellphone || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className="font-medium">{formatDate(applicant.dateOfBirth)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <GraduationCap className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Program</p>
                <p className="font-medium">{applicant.program.programName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Undergraduate Course</p>
                <p className="font-medium">{applicant.undergraduateCourse || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Registered</p>
                <p className="font-medium">{formatDate(applicant.createdAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Program Alignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Program Alignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {getAlignmentBadge(applicant.alignmentStatus)}
              </div>
            </div>

            {applicant.bridgingWaiver && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Bridging Waiver</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <p><span className="text-gray-500">Status:</span> {applicant.bridgingWaiver.status}</p>
                  <p><span className="text-gray-500">Downloaded:</span> {formatDateTime(applicant.bridgingWaiver.waiverFormDownloadedAt || "")}</p>
                  {applicant.bridgingWaiver.validatedBy && (
                    <p><span className="text-gray-500">Validated By:</span> {applicant.bridgingWaiver.validatedBy.firstName} {applicant.bridgingWaiver.validatedBy.lastName}</p>
                  )}
                  {applicant.bridgingWaiver.adminNotes && (
                    <p className="col-span-2"><span className="text-gray-500">Notes:</span> {applicant.bridgingWaiver.adminNotes}</p>
                  )}
                </div>
              </div>
            )}

            {applicant.alignmentStatus === "PENDING_WAIVER" && (
              <div className="flex gap-2">
                <Button
                  onClick={() => validateWaiverMutation.mutate()}
                  disabled={validateWaiverMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {validateWaiverMutation.isPending ? "Validating..." : "Validate Waiver"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (rejectNotes) {
                      rejectWaiverMutation.mutate();
                    }
                  }}
                  disabled={rejectWaiverMutation.isPending || !rejectNotes}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {rejectWaiverMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
              </div>
            )}

            {applicant.alignmentStatus === "PENDING_WAIVER" && (
              <div>
                <label className="text-sm text-gray-500">Rejection Notes (required for reject)</label>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Enter rejection reason..."
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entrance Examination */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Entrance Examination
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {getExamBadge(applicant.examStatus)}
              </div>
              {applicant.examScores && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Scores</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">MCQ</p>
                      <p className="font-medium">{applicant.examScores.mcq}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Essay</p>
                      <p className="font-medium">{applicant.examScores.essay}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-medium">{applicant.examScores.total}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {applicant.examApplications[0]?.examSlot && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Scheduled Exam</p>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Date:</span> {formatDate(applicant.examApplications[0].examSlot.examDate)}</p>
                  <p><span className="text-gray-500">Time:</span> {applicant.examApplications[0].examSlot.examTime}</p>
                  <p><span className="text-gray-500">Venue:</span> {applicant.examApplications[0].examSlot.venueOrLink}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Certificate of Registration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Certificate of Registration (COR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              {getCorBadge(applicant.corStatus)}
            </div>

            {applicant.corUploads.length > 0 && (
              <div className="space-y-3">
                {applicant.corUploads.map((upload) => (
                  <div key={upload.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        {upload.originalFilename || "COR file"}
                        {upload.isCurrent && (
                          <span className="ml-2 text-xs text-blue-600">
                            (current)
                          </span>
                        )}
                      </p>
                      {getCorBadge(upload.status)}
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <p>
                        <span className="text-gray-500">Uploaded:</span>{" "}
                        {formatDateTime(upload.uploadedAt)}
                      </p>
                      {upload.reviewedAt && (
                        <p>
                          <span className="text-gray-500">Reviewed:</span>{" "}
                          {formatDateTime(upload.reviewedAt)}
                        </p>
                      )}
                      {upload.reviewedBy && (
                        <p>
                          <span className="text-gray-500">Reviewed By:</span>{" "}
                          {upload.reviewedBy.firstName} {upload.reviewedBy.lastName}
                        </p>
                      )}
                      {upload.rejectionReason && (
                        <p className="md:col-span-2">
                          <span className="text-gray-500">Reason:</span>{" "}
                          {upload.rejectionReason}
                        </p>
                      )}
                      {upload.corRecord && (
                        <>
                          <p>
                            <span className="text-gray-500">Reg No:</span>{" "}
                            {upload.corRecord.registrationNumber}
                          </p>
                          <p>
                            <span className="text-gray-500">Academic Year:</span>{" "}
                            {upload.corRecord.academicYear}
                          </p>
                          <p>
                            <span className="text-gray-500">Semester:</span>{" "}
                            {upload.corRecord.semester}
                          </p>
                          {upload.corRecord.verifiedBy && (
                            <p>
                              <span className="text-gray-500">Verified By:</span>{" "}
                              {upload.corRecord.verifiedBy.firstName}{" "}
                              {upload.corRecord.verifiedBy.lastName}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  COR verification and promotion are performed in the canonical
                  COR Validation workflow (one-step Verify &amp; Promote).
                </p>
                <Link href="/admin/exam/cor">
                  <Button variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    Open COR Validation
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admission Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Admission Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Current Status</p>
              {getAdmissionBadge(applicant.admissionStatus)}
            </div>

            {applicant.enrollmentDate && (
              <div>
                <p className="text-sm text-gray-500">Enrollment Date</p>
                <p className="font-medium">{formatDate(applicant.enrollmentDate)}</p>
              </div>
            )}

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Eligibility Check</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {applicant.examStatus === "PASSED" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">Entrance Exam Passed</span>
                </div>
                <div className="flex items-center gap-2">
                  {applicant.corStatus === "VERIFIED" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">COR Verified</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Promotion to Student is applied atomically by the canonical COR
              Verify &amp; Promote action, not from this page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
