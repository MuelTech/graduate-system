"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Mail,
  Info,
  X,
  LayoutGrid,
  List,
} from "lucide-react";

export default function ApplicantSchedulePage() {
  const applicant = {
    alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
    strikeCount: 0,
    confirmedSlot: null as null | {
      date: string;
      time: string;
      program: string;
    },
  };

  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [confirmSlot, setConfirmSlot] = useState<null | {
    date: string;
    time: string;
    program: string;
  }>(null);

  const availableSlots = [
    {
      date: "June 15, 2026",
      time: "9:00 AM — 12:00 PM",
      program: "MSCS / MIT",
      slotsAvailable: 8,
      status: "active",
    },
    {
      date: "June 15, 2026",
      time: "1:00 PM — 4:00 PM",
      program: "MSCS / MIT",
      slotsAvailable: 3,
      status: "active",
    },
    {
      date: "June 18, 2026",
      time: "9:00 AM — 12:00 PM",
      program: "PhD / DIT",
      slotsAvailable: 12,
      status: "active",
    },
    {
      date: "June 20, 2026",
      time: "9:00 AM — 12:00 PM",
      program: "All Programs",
      slotsAvailable: 0,
      status: "full",
    },
    {
      date: "June 22, 2026",
      time: "1:00 PM — 4:00 PM",
      program: "MSCS / MIT",
      slotsAvailable: 15,
      status: "active",
    },
  ];

  const isLocked = applicant.alignmentStatus === "pending_waiver";
  const isScheduled = applicant.confirmedSlot !== null;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Exam Slot Selection
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
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
              <h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">
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
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
              >
                View Alignment Details <ArrowLeft className="h-3 w-3 rotate-180" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-Strike Warning */}
      {!isLocked && applicant.strikeCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            Warning: You have {applicant.strikeCount} missed attempt(s). Two
            missed attempts result in disqualification.
          </AlertDescription>
        </Alert>
      )}

      {/* Confirmed Schedule Display */}
      {!isLocked && isScheduled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
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
                  <p className="text-xs text-[var(--earist-body-text)]">Date</p>
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    {applicant.confirmedSlot.date}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Time</p>
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    {applicant.confirmedSlot.time}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">
                    Program
                  </p>
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    {applicant.confirmedSlot.program}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--earist-body-text)]">
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
                    ? "bg-[var(--earist-primary)] text-white"
                    : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)] hover:bg-[var(--earist-border-gray)]"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`rounded-lg p-2 transition-colors ${
                  viewMode === "calendar"
                    ? "bg-[var(--earist-primary)] text-white"
                    : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)] hover:bg-[var(--earist-border-gray)]"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--earist-body-text)]">
              {availableSlots.filter((s) => s.status === "active").length} slots
              available
            </p>
          </div>

          {/* Table View */}
          {viewMode === "table" && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--earist-border-gray)] bg-[var(--earist-surface-gray)]">
                        <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                          Exam Date
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                          Exam Time
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                          Program
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                          Slots
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-[var(--earist-secondary)]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableSlots.map((slot, i) => {
                        const isFull = slot.status === "full";
                        return (
                          <tr
                            key={i}
                            className={`border-b border-[var(--earist-border-gray)] last:border-0 ${
                              isFull ? "opacity-50" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-[var(--earist-primary)]">
                              {slot.date}
                            </td>
                            <td className="px-4 py-3 text-[var(--earist-body-text)]">
                              {slot.time}
                            </td>
                            <td className="px-4 py-3 text-[var(--earist-body-text)]">
                              {slot.program}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge
                                className={
                                  isFull
                                    ? "bg-red-100 text-red-700"
                                    : slot.slotsAvailable <= 5
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-green-100 text-green-700"
                                }
                              >
                                {isFull ? "Full" : `${slot.slotsAvailable} left`}
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
                                    : "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
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
              {availableSlots.map((slot, i) => {
                const isFull = slot.status === "full";
                return (
                  <Card
                    key={i}
                    className={isFull ? "opacity-50" : ""}
                  >
                    <CardContent className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--earist-surface-light-red)]">
                          <CalendarClock className="h-5 w-5 text-[var(--earist-primary)]" />
                        </div>
                        <Badge
                          className={
                            isFull
                              ? "bg-red-100 text-red-700"
                              : slot.slotsAvailable <= 5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                          }
                        >
                          {isFull ? "Full" : `${slot.slotsAvailable} slots`}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-[var(--earist-primary)]">
                        {slot.date}
                      </p>
                      <p className="text-xs text-[var(--earist-body-text)]">
                        {slot.time}
                      </p>
                      <p className="mb-3 text-xs text-[var(--earist-body-text)]">
                        {slot.program}
                      </p>
                      <Button
                        size="sm"
                        disabled={isFull}
                        onClick={() => setConfirmSlot(slot)}
                        className={`w-full ${
                          isFull
                            ? "cursor-not-allowed bg-gray-200 text-gray-400"
                            : "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
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
            {/* <div className="flex items-start gap-2 rounded-lg bg-[var(--earist-surface-gray)] p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--earist-body-text)]" />
              <p className="text-xs text-[var(--earist-body-text)]">
                Exam application fee is collected through Registrar. No payment
                is required in this portal.
              </p>
            </div> */}
            <div className="flex items-start gap-2 rounded-lg bg-[var(--earist-surface-gray)] p-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--earist-body-text)]" />
              <p className="text-xs text-[var(--earist-body-text)]">
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
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Confirm Exam Schedule
              </h3>
              <button
                onClick={() => setConfirmSlot(null)}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-[var(--earist-surface-gray)] p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Date</p>
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    {confirmSlot.date}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--earist-body-text)]">Time</p>
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    {confirmSlot.time}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xs text-[var(--earist-body-text)]">
                  Program
                </p>
                <p className="text-sm font-semibold text-[var(--earist-primary)]">
                  {confirmSlot.program}
                </p>
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
                onClick={() => {
                  setConfirmSlot(null);
                }}
                className="flex-1 bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
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
