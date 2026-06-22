"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CalendarClock, Edit, Trash2, X, Users } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

interface Slot {
  id: string;
  programId: string;
  examDate: string;
  examTime: string;
  maxSlots: number;
  slotsTaken: number;
  isActive: boolean;
  program?: { programName: string };
}

interface Program {
  id: string;
  programName: string;
}

export default function AdminExamSlotsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: slots = [], isLoading: isSlotsLoading } = useQuery<Slot[]>({
    queryKey: ["examSlots"],
    queryFn: async () => {
      return apiClientRequest("/exam/slots", { method: "GET" });
    },
  });

  const { data: programsData, isLoading: isProgramsLoading } = useQuery<{
    graduatePrograms: Program[];
  }>({
    queryKey: ["programs"],
    queryFn: async () => {
      return apiClientRequest("/programs", { method: "GET" });
    },
  });

  const programs = programsData?.graduatePrograms || [];
  const isLoading = isSlotsLoading || isProgramsLoading;

  // Form State
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [programId, setProgramId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [maxSlots, setMaxSlots] = useState("");

  const handleCreateSlot = async () => {
    try {
      const localDateTime = new Date(`${examDate}T${examTime}`);
      const dateTimeString = localDateTime.toISOString();

      if (editingSlotId) {
        await apiClientRequest(`/exam/slots/${editingSlotId}`, {
          method: "PUT",
          body: JSON.stringify({
            programId,
            examDate,
            examTime: dateTimeString,
            maxSlots: parseInt(maxSlots),
          }),
        });
      } else {
        await apiClientRequest("/exam/slots", {
          method: "POST",
          body: JSON.stringify({
            programId,
            examDate,
            examTime: dateTimeString,
            maxSlots: parseInt(maxSlots),
          }),
        });
      }

      setShowCreateModal(false);
      setEditingSlotId(null);
      queryClient.invalidateQueries({ queryKey: ["examSlots"] });
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message || "Failed to save slot.");
      } else {
        alert("Failed to save slot.");
      }
    }
  };

  const handleEditClick = (slot: Slot) => {
    setEditingSlotId(slot.id);
    setProgramId(slot.programId || "");

    // Format date for <input type="date">
    const dateObj = new Date(slot.examDate);
    const dateString = dateObj.toISOString().split("T")[0];
    setExamDate(dateString);

    // Format time for <input type="time"> (HH:mm)
    const timeObj = new Date(slot.examTime);
    const timeString = timeObj.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    setExamTime(timeString);

    setMaxSlots(slot.maxSlots.toString());
    setShowCreateModal(true);
  };

  const handleToggleStatus = async (slotId: string, currentStatus: boolean) => {
    try {
      await apiClientRequest(`/exam/slots/${slotId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      queryClient.invalidateQueries({ queryKey: ["examSlots"] });
    } catch (err: unknown) {
      alert("Failed to update slot status.");
      console.log("Error:", err);
    }
  };

  const activeSlots = slots.filter(
    (s) => s.isActive && s.slotsTaken < s.maxSlots,
  ).length;
  const fullSlots = slots.filter(
    (s) => s.isActive && s.slotsTaken >= s.maxSlots,
  ).length;
  const totalApplicants = slots.reduce((sum, s) => sum + s.slotsTaken, 0);

  const getStatusBadge = (
    isActive: boolean,
    slotsTaken: number,
    maxSlots: number,
  ) => {
    if (!isActive)
      return <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>;
    if (slotsTaken >= maxSlots)
      return <Badge className="bg-red-100 text-red-700">Full</Badge>;
    return <Badge className="bg-green-100 text-green-700">Active</Badge>;
  };

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

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            Exam Slot Management
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Create and manage examination slots
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingSlotId(null);
            setProgramId("");
            setExamDate("");
            setExamTime("");
            setMaxSlots("");
            setShowCreateModal(true);
          }}
          className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          Create Exam Slot
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Total Slots
            </p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {isLoading ? "..." : slots.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Active</p>
            <p className="text-lg font-bold text-green-600">
              {isLoading ? "..." : activeSlots}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Full</p>
            <p className="text-lg font-bold text-red-600">
              {isLoading ? "..." : fullSlots}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Total Applicants
            </p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {isLoading ? "..." : totalApplicants}
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
                <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Program
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Exam Date
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Exam Time
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Slots
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
                {slots.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-500">
                      No exam slots found.
                    </td>
                  </tr>
                )}
                {slots.map((slot) => {
                  const percentage = Math.round(
                    (slot.slotsTaken / slot.maxSlots) * 100,
                  );
                  return (
                    <tr
                      key={slot.id}
                      className="border-b border-(--earist-border-gray) last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-(--earist-accent)" />
                          <span className="font-medium text-(--earist-primary)">
                            {slot.program?.programName || "All Programs"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-(--earist-body-text)">
                        {formatDate(slot.examDate)}
                      </td>
                      <td className="px-4 py-3 text-(--earist-body-text)">
                        {formatTime(slot.examTime)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-(--earist-body-text)" />
                            <span className="text-xs font-medium text-(--earist-primary)">
                              {slot.slotsTaken} / {slot.maxSlots}
                            </span>
                          </div>
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-(--earist-border-gray)">
                            <div
                              className={`h-full rounded-full ${
                                percentage >= 100
                                  ? "bg-red-500"
                                  : percentage >= 80
                                    ? "bg-amber-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(
                          slot.isActive,
                          slot.slotsTaken,
                          slot.maxSlots,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditClick(slot)}
                            className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                            title="Edit Slot"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {slot.isActive && (
                            <button
                              onClick={() =>
                                handleToggleStatus(slot.id, slot.isActive)
                              }
                              className="rounded p-1.5 text-red-600 hover:bg-red-50"
                              title="Deactivate Slot"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {!slot.isActive && (
                            <button
                              onClick={() =>
                                handleToggleStatus(slot.id, slot.isActive)
                              }
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
              <h3 className="text-lg font-bold text-(--earist-primary)">
                {editingSlotId ? "Edit Exam Slot" : "Create Exam Slot"}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Program
                </label>
                <select
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                >
                  <option value="">Select program...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.programName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Exam Date
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Exam Time (Start)
                </label>
                <input
                  type="time"
                  value={examTime}
                  onChange={(e) => setExamTime(e.target.value)}
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Max Slots
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxSlots}
                  onChange={(e) => setMaxSlots(e.target.value)}
                  placeholder="e.g., 30"
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                />
              </div>
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
                onClick={handleCreateSlot}
                disabled={!programId || !examDate || !examTime || !maxSlots}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90 disabled:bg-gray-400"
              >
                {editingSlotId ? "Update Slot" : "Create Slot"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
