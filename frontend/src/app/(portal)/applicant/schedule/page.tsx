"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Mail,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { ApplicantStatus, ExamSlot } from "@/types";

export default function ApplicantSchedulePage() {
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [confirmSlot, setConfirmSlot] = useState<ExamSlot | null>(null);
  const queryClient = useQueryClient();

  const {
    data: applicant,
    isLoading: isApplicantLoading,
    error: applicantError,
  } = useQuery<ApplicantStatus>({
    queryKey: ["examStatus"],
    queryFn: async () => {
      return apiClientRequest("/exam/status", { method: "GET" });
    },
  });

  const {
    data: availableSlots = [],
    isLoading: isSlotsLoading,
    error: slotsError,
  } = useQuery<ExamSlot[]>({
    queryKey: ["examSlots", applicant?.programId],
    queryFn: async () => {
      return apiClientRequest(
        `/exam/slots/available?programId=${applicant?.programId}`,
        { method: "GET" },
      );
    },
    enabled:
      !!applicant &&
      applicant.alignmentStatus === "ALIGNED" &&
      !applicant.confirmedSlot,
  });

  const scheduleMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return apiClientRequest("/exam/schedule", {
        method: "POST",
        body: JSON.stringify({ slotId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examStatus"] });
      queryClient.invalidateQueries({ queryKey: ["examSlots"] });
      setConfirmSlot(null);
    },
    onError: (err: unknown) => {
      if (err instanceof Error) {
        alert(err.message || "Failed to schedule exam.");
      } else {
        alert("Failed to schedule exam.");
      }
    },
  });

  const handleSchedule = () => {
    if (!confirmSlot) return;
    scheduleMutation.mutate(confirmSlot.id);
  };

  const isLoading =
    isApplicantLoading || isSlotsLoading || scheduleMutation.isPending;
  const error = applicantError?.message || slotsError?.message;

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading)
    return <div className="p-4 text-center">Loading your schedule...</div>;
  if (error)
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;

  const isLocked = applicant?.alignmentStatus === "PENDING_WAIVER";
  const isScheduled = !!applicant?.confirmedSlot;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Exam Slot Selection
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Select your entrance examination schedule
        </p>
      </div>

      {/* Alignment Gate — Locked State */}
      {isLocked && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Lock className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                Exam Scheduling Locked
              </h3>
              <Alert className="mb-4 max-w-md border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Complete your Bridging Waiver validation with the GS Office to
                  unlock scheduling.
                </AlertDescription>
              </Alert>
              <Link
                href="/applicant/alignment"
                className="inline-flex items-center gap-1 text-sm font-semibold text-(--earist-secondary) transition-colors hover:text-(--earist-primary)"
              >
                View Alignment Details{" "}
                <ArrowLeft className="h-3 w-3 rotate-180" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-Strike Warning */}
      {!isLocked && (applicant?.strikeCount ?? 0) > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            Warning: You have {applicant?.strikeCount} missed attempt(s). Two
            missed attempts result in disqualification.
          </AlertDescription>
        </Alert>
      )}

      {/* Confirmed Schedule Display */}
      {!isLocked && isScheduled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Confirmed Schedule
              </CardTitle>
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Scheduled
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-(--earist-body-text)">Date</p>
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {formatDate(applicant?.confirmedSlot?.examDate || "")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">Time</p>
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {formatTime(applicant?.confirmedSlot?.examTime || "")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">
                    Program
                  </p>
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {applicant?.confirmedSlot?.programName}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-(--earist-body-text)">
                This schedule is locked and cannot be changed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Slots — Active State */}
      {!isLocked && !isScheduled && (
        <>
          {/* View Toggle & Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("table")}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === "table"
                    ? "bg-(--earist-primary) text-white"
                    : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === "calendar"
                    ? "bg-(--earist-primary) text-white"
                    : "bg-(--earist-surface-gray) text-(--earist-body-text) hover:bg-(--earist-border-gray)"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-(--earist-body-text)">
              {availableSlots.length} slots available
            </p>
          </div>

          {/* Table View */}
          {viewMode === "table" && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                        <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                          Exam Date
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                          Exam Time
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                          Slots Left
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-(--earist-secondary)">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableSlots.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-4 text-center text-gray-500"
                          >
                            No available slots found.
                          </td>
                        </tr>
                      )}
                      {availableSlots.map((slot) => {
                        const slotsLeft = slot.maxSlots - slot.slotsTaken;
                        const isFull = slotsLeft <= 0;
                        return (
                          <tr
                            key={slot.id}
                            className={`border-b border-(--earist-border-gray) last:border-0 ${
                              isFull ? "opacity-50" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-(--earist-primary)">
                              {formatDate(slot.examDate)}
                            </td>
                            <td className="px-4 py-3 text-(--earist-body-text)">
                              {formatTime(slot.examTime)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge
                                className={
                                  isFull
                                    ? "bg-red-100 text-red-700"
                                    : slotsLeft <= 5
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-green-100 text-green-700"
                                }
                              >
                                {isFull ? "Full" : `${slotsLeft} left`}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                disabled={isFull}
                                onClick={() => setConfirmSlot(slot)}
                                className={
                                  isFull
                                    ? "cursor-not-allowed bg-gray-200 text-gray-400"
                                    : "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                                }
                              >
                                Select This Slot
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calendar View */}
          {viewMode === "calendar" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {availableSlots.map((slot) => {
                const slotsLeft = slot.maxSlots - slot.slotsTaken;
                const isFull = slotsLeft <= 0;
                return (
                  <Card key={slot.id} className={isFull ? "opacity-50" : ""}>
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--earist-surface-light-red)">
                          <CalendarClock className="h-5 w-5 text-(--earist-primary)" />
                        </div>
                        <Badge
                          className={
                            isFull
                              ? "bg-red-100 text-red-700"
                              : slotsLeft <= 5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                          }
                        >
                          {isFull ? "Full" : `${slotsLeft} slots`}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        {formatDate(slot.examDate)}
                      </p>
                      <p className="mb-3 text-xs text-(--earist-body-text)">
                        {formatTime(slot.examTime)}
                      </p>
                      <Button
                        size="sm"
                        disabled={isFull}
                        onClick={() => setConfirmSlot(slot)}
                        className={`w-full ${
                          isFull
                            ? "cursor-not-allowed bg-gray-200 text-gray-400"
                            : "bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                        }`}
                      >
                        Select This Slot
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Info Notes */}
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg bg-(--earist-surface-gray) p-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-(--earist-body-text)" />
              <p className="text-xs text-(--earist-body-text)">
                An email reminder will be sent 24 hours before your scheduled
                examination.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {confirmSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Confirm Exam Schedule
              </h3>
              <button
                onClick={() => setConfirmSlot(null)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-(--earist-surface-gray) p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-(--earist-body-text)">Date</p>
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {formatDate(confirmSlot.examDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">Time</p>
                  <p className="text-sm font-semibold text-(--earist-primary)">
                    {formatTime(confirmSlot.examTime)}
                  </p>
                </div>
              </div>
            </div>
            <Alert className="mb-4 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                Once confirmed, your schedule cannot be changed.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmSlot(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSchedule}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                Confirm Schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
