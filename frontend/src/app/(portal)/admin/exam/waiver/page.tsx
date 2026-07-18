"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Waiver } from "@/types";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Filter,
  Eye,
  ArrowRight,
  Search,
} from "lucide-react";

export default function AdminWaiverValidationPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWaiverId, setSelectedWaiverId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // 1. Fetch live queue from backend
  const { data: waivers = [], isLoading } = useQuery<Waiver[]>({
    queryKey: ["admin-waivers"],
    queryFn: async () => await apiClientRequest("/waivers"),
  });

  // 2. Setup Mutations for Actions
  const validateMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) =>
      await apiClientRequest(`/waivers/${id}/validate`, { 
        method: "PUT",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-waivers"] });
      setShowValidateConfirm(false);
      setSelectedWaiverId(null);
      setAdminNotes("");
    },
  });


  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) =>
      await apiClientRequest(`/waivers/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-waivers"] });
      setShowRejectModal(false);
      setSelectedWaiverId(null);
      setAdminNotes("");
    },
  });

  // 3. Filter Logic (Search by Name/ID + Status dropdown)
  const filteredWaivers = waivers.filter((w: Waiver) => {
    const statusMatch =
      statusFilter === "all" ||
      w.status.toLowerCase() === statusFilter.toLowerCase();

    const fullName =
      `${w.student?.user?.firstName || ""} ${w.student?.user?.lastName || ""}`.toLowerCase();
    const pinnacleId = w.student?.pinnacleApplicantId?.toLowerCase() || "";
    const search = searchQuery.toLowerCase();

    const searchMatch =
      fullName.includes(search) || pinnacleId.includes(search);

    return statusMatch && searchMatch;
  });

  const selectedWaiverData = waivers.find(
    (w: Waiver) => w.id === selectedWaiverId,
  );

  const pendingCount = waivers.filter(
    (w: Waiver) => w.status === "PENDING",
  ).length;
  const validatedCount = waivers.filter(
    (w: Waiver) => w.status === "VALIDATED",
  ).length;
  const rejectedCount = waivers.filter(
    (w: Waiver) => w.status === "REJECTED",
  ).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "VALIDATED":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Validated
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        );
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
          Bridging Waiver Validation Queue
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review and validate bridging waivers for misaligned applicants
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Pending</p>
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Validated</p>
            <p className="text-lg font-bold text-green-600">{validatedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Rejected</p>
            <p className="text-lg font-bold text-red-600">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <div className="flex gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "validated", label: "Validated" },
                  { value: "rejected", label: "Rejected" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setStatusFilter(filter.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      statusFilter === filter.value
                        ? "bg-(--earist-primary) text-white"
                        : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name or Applicant ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-(--earist-border-gray) bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-(--earist-primary)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Waiver Queue Table */}
        <div className="lg:col-span-2">
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
                        Undergraduate Course
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                        Intended Program
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                        Submitted
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-(--earist-secondary)">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-gray-500"
                        >
                          Loading waivers...
                        </td>
                      </tr>
                    ) : filteredWaivers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-gray-500"
                        >
                          No waivers found.
                        </td>
                      </tr>
                    ) : (
                      filteredWaivers.map((waiver: Waiver) => (
                        <tr
                          key={waiver.id}
                          className={`border-b border-(--earist-border-gray) last:border-0 ${
                            selectedWaiverId === waiver.id
                              ? "bg-(--earist-surface-light-red)"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-(--earist-primary)">
                                {waiver.student?.user?.firstName}{" "}
                                {waiver.student?.user?.lastName}
                              </p>
                              <p className="text-xs text-(--earist-body-text)">
                                {waiver.student?.pinnacleApplicantId}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                            {waiver.undergraduateProgram?.programName || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                            {waiver.intendedProgram?.programName || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                            {new Date(waiver.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusBadge(waiver.status)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedWaiverId(waiver.id);
                                setAdminNotes("");
                              }}
                              className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                              title="Review"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Review Panel */}
        {selectedWaiverData ? (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Review Panel
                  </CardTitle>
                  <button
                    onClick={() => {
                      setSelectedWaiverId(null);
                      setAdminNotes("");
                    }}
                    className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Applicant Profile */}
                  <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                    <p className="text-sm font-semibold text-(--earist-primary)">
                      {selectedWaiverData.student?.user?.firstName}{" "}
                      {selectedWaiverData.student?.user?.lastName}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {selectedWaiverData.student?.user?.email}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {selectedWaiverData.student?.pinnacleApplicantId}
                    </p>
                  </div>

                  {/* Program Comparison */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-(--earist-secondary)">
                      Program Comparison
                    </p>
                    <div className="space-y-2">
                      <div className="rounded-lg border border-(--earist-border-gray) p-2">
                        <p className="text-[11px] text-(--earist-body-text)">
                          Undergraduate Course
                        </p>
                        <p className="text-sm font-medium text-(--earist-primary)">
                          {selectedWaiverData.undergraduateProgram
                            ?.programName || "N/A"}
                        </p>
                      </div>
                      <div className="flex justify-center">
                        <ArrowRight className="h-4 w-4 text-(--earist-body-text)" />
                      </div>
                      <div className="rounded-lg border border-(--earist-border-gray) p-2">
                        <p className="text-[11px] text-(--earist-body-text)">
                          Intended Graduate Program
                        </p>
                        <p className="text-sm font-medium text-(--earist-primary)">
                          {selectedWaiverData.intendedProgram?.programName ||
                            "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Waiver Download Timestamp */}
                  <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                    <p className="text-[11px] text-(--earist-body-text)">
                      Waiver Form Downloaded At
                    </p>
                    <p className="text-sm font-medium text-(--earist-primary)">
                      {selectedWaiverData.waiverFormDownloadedAt
                        ? new Date(
                            selectedWaiverData.waiverFormDownloadedAt,
                          ).toLocaleString()
                        : "Not downloaded yet"}
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                      Status
                    </p>
                    {getStatusBadge(selectedWaiverData.status)}
                  </div>

                  {/* Admin Notes (if rejected or validated) */}
                  {selectedWaiverData.adminNotes && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                        Admin Notes
                      </p>
                      <p className="text-sm text-(--earist-body-text)">
                        {selectedWaiverData.adminNotes}
                      </p>
                      {selectedWaiverData.validatedBy && (
                        <p className="mt-1 text-xs text-(--earist-body-text)">
                          By: {selectedWaiverData.validatedBy.firstName}{" "}
                          {selectedWaiverData.validatedBy.lastName} &middot;{" "}
                          {new Date(
                            selectedWaiverData.validatedAt as string,
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Admin Notes Input (for pending) */}
                  {selectedWaiverData.status === "PENDING" && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-(--earist-secondary)">
                        Admin Notes
                      </label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Optional notes for validation or required for rejection..."
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Action Buttons (for pending) */}
                  {selectedWaiverData.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setShowValidateConfirm(true)}
                        className="flex-1 bg-green-600 text-white hover:bg-green-700"
                        disabled={
                          validateMutation.isPending || rejectMutation.isPending
                        }
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Validate
                      </Button>
                      <Button
                        onClick={() => setShowRejectModal(true)}
                        variant="outline"
                        className="flex-1 text-red-600 hover:bg-red-50"
                        disabled={
                          validateMutation.isPending || rejectMutation.isPending
                        }
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <ShieldCheck className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select a Waiver
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Click a waiver from the queue to review.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Validate Confirmation Modal */}
      {showValidateConfirm && selectedWaiverData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Validate Waiver
              </h3>
              <button
                onClick={() => setShowValidateConfirm(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">
                    Waiver Validated
                  </p>
                </div>
                <p className="mt-2 text-xs text-green-600">
                  This will change the applicant&apos;s alignment status to
                  &quot;Cleared&quot; and unlock exam scheduling.
                </p>
              </div>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {selectedWaiverData.student?.user?.firstName}{" "}
                  {selectedWaiverData.student?.user?.lastName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedWaiverData.student?.pinnacleApplicantId} &middot;{" "}
                  {selectedWaiverData.intendedProgram?.programName}
                </p>
              </div>
              {adminNotes && (
                <div className="rounded-lg border border-(--earist-border-gray) p-3">
                  <p className="text-[11px] text-(--earist-body-text)">
                    Admin Notes
                  </p>
                  <p className="text-sm text-(--earist-body-text)">
                    {adminNotes}
                  </p>
                </div>
              )}
              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowValidateConfirm(false)}
                className="flex-1"
                disabled={validateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => validateMutation.mutate({
                  id: selectedWaiverData.id,
                  notes: adminNotes.trim() || undefined,
                })}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
                disabled={validateMutation.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {validateMutation.isPending
                  ? "Validating..."
                  : "Confirm Validate"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedWaiverData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Reject Waiver
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-semibold text-red-700">
                    Reject Waiver
                  </p>
                </div>
                <p className="mt-2 text-xs text-red-600">
                  The applicant will be notified. They will remain blocked from
                  exam scheduling.
                </p>
              </div>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-sm font-semibold text-(--earist-primary)">
                  {selectedWaiverData.student?.user?.firstName}{" "}
                  {selectedWaiverData.student?.user?.lastName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {selectedWaiverData.student?.pinnacleApplicantId} &middot;{" "}
                  {selectedWaiverData.intendedProgram?.programName}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                  rows={3}
                />
              </div>
              <p className="text-xs font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectModal(false);
                  setAdminNotes("");
                }}
                className="flex-1"
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                disabled={!adminNotes.trim() || rejectMutation.isPending}
                onClick={() =>
                  rejectMutation.mutate({
                    id: selectedWaiverData.id,
                    notes: adminNotes,
                  })
                }
                className={`flex-1 ${
                  adminNotes.trim()
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
