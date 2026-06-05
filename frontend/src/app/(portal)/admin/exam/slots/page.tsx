"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  CalendarClock,
  Edit,
  Trash2,
  X,
  Users,
} from "lucide-react";

export default function AdminExamSlotsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const slots = [
    {
      id: 1,
      program: "MSCS / MIT",
      examDate: "June 15, 2026",
      examTime: "9:00 AM — 12:00 PM",
      maxSlots: 30,
      slotsTaken: 22,
      status: "active" as "active" | "full" | "inactive",
    },
    {
      id: 2,
      program: "MSCS / MIT",
      examDate: "June 15, 2026",
      examTime: "1:00 PM — 4:00 PM",
      maxSlots: 30,
      slotsTaken: 30,
      status: "full" as "active" | "full" | "inactive",
    },
    {
      id: 3,
      program: "PhD / DIT",
      examDate: "June 18, 2026",
      examTime: "9:00 AM — 12:00 PM",
      maxSlots: 20,
      slotsTaken: 8,
      status: "active" as "active" | "full" | "inactive",
    },
    {
      id: 4,
      program: "All Programs",
      examDate: "June 20, 2026",
      examTime: "9:00 AM — 12:00 PM",
      maxSlots: 50,
      slotsTaken: 45,
      status: "active" as "active" | "full" | "inactive",
    },
    {
      id: 5,
      program: "MAED",
      examDate: "June 22, 2026",
      examTime: "1:00 PM — 4:00 PM",
      maxSlots: 25,
      slotsTaken: 0,
      status: "inactive" as "active" | "full" | "inactive",
    },
    {
      id: 6,
      program: "MSCS / MIT",
      examDate: "May 25, 2026",
      examTime: "9:00 AM — 12:00 PM",
      maxSlots: 30,
      slotsTaken: 28,
      status: "inactive" as "active" | "full" | "inactive",
    },
  ];

  const activeSlots = slots.filter((s) => s.status === "active").length;
  const fullSlots = slots.filter((s) => s.status === "full").length;
  const totalApplicants = slots.reduce((sum, s) => sum + s.slotsTaken, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case "full":
        return <Badge className="bg-red-100 text-red-700">Full</Badge>;
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold text-[var(--earist-primary)]"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            Exam Slot Management
          </h2>
          <p className="text-sm text-[var(--earist-body-text)]">
            Create and manage examination slots
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          Create Exam Slot
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Total Slots</p>
            <p className="text-lg font-bold text-[var(--earist-primary)]">
              {slots.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Active</p>
            <p className="text-lg font-bold text-green-600">{activeSlots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Full</p>
            <p className="text-lg font-bold text-red-600">{fullSlots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--earist-body-text)]">Total Applicants</p>
            <p className="text-lg font-bold text-[var(--earist-primary)]">
              {totalApplicants}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Slots Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--earist-border-gray)] bg-[var(--earist-surface-gray)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                    Program
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                    Exam Date
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--earist-secondary)]">
                    Exam Time
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                    Slots
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--earist-secondary)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[var(--earist-secondary)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const percentage = Math.round(
                    (slot.slotsTaken / slot.maxSlots) * 100
                  );
                  return (
                    <tr
                      key={slot.id}
                      className="border-b border-[var(--earist-border-gray)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-[var(--earist-accent)]" />
                          <span className="font-medium text-[var(--earist-primary)]">
                            {slot.program}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--earist-body-text)]">
                        {slot.examDate}
                      </td>
                      <td className="px-4 py-3 text-[var(--earist-body-text)]">
                        {slot.examTime}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-[var(--earist-body-text)]" />
                            <span className="text-xs font-medium text-[var(--earist-primary)]">
                              {slot.slotsTaken} / {slot.maxSlots}
                            </span>
                          </div>
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-[var(--earist-border-gray)]">
                            <div
                              className={`h-full rounded-full ${
                                percentage >= 100
                                  ? "bg-red-500"
                                  : percentage >= 80
                                    ? "bg-amber-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(slot.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            className="rounded p-1.5 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
                            title="Edit Slot"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {slot.status === "active" && (
                            <button
                              className="rounded p-1.5 text-red-600 hover:bg-red-50"
                              title="Deactivate Slot"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {slot.status === "inactive" && (
                            <button
                              className="rounded p-1.5 text-green-600 hover:bg-green-50"
                              title="Activate Slot"
                            >
                              <CalendarClock className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Slot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">
                Create Exam Slot
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                  Program
                </label>
                <select className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none">
                  <option value="">Select program...</option>
                  <option value="mscs_mit">MSCS / MIT</option>
                  <option value="phd_dit">PhD / DIT</option>
                  <option value="maed">MAED</option>
                  <option value="all">All Programs</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                  Exam Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                  Exam Time
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-[var(--earist-body-text)]">
                      Start
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[var(--earist-body-text)]">
                      End
                    </label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">
                  Max Slots
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g., 30"
                  className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none"
                />
              </div>
              {/* <p className="text-xs text-[var(--earist-body-text)]">
                Note: Exam application fee is collected through Pinnacle. No
                payment fields required.
              </p> */}
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
              >
                Create Slot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
