"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Calendar,
  Save,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Shield,
  FileText,
  Mail,
  Clock,
  BarChart3,
  Lock,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState("academic_year");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [semester, setSemester] = useState("second");
  const [enrollmentStart, setEnrollmentStart] = useState("2026-01-10");
  const [enrollmentEnd, setEnrollmentEnd] = useState("2026-01-25");
  const [titleDefenseStart, setTitleDefenseStart] = useState("2026-03-01");
  const [titleDefenseEnd, setTitleDefenseEnd] = useState("2026-03-31");
  const [proposalDefenseStart, setProposalDefenseStart] =
    useState("2026-04-01");
  const [proposalDefenseEnd, setProposalDefenseEnd] = useState("2026-04-30");
  const [finalDefenseStart, setFinalDefenseStart] = useState("2026-05-01");
  const [finalDefenseEnd, setFinalDefenseEnd] = useState("2026-05-31");

  const tabs = [
    { id: "programs", label: "Programs", icon: BookOpen },
    { id: "chatbot", label: "AI Chatbot FAQ", icon: GraduationCap },
    { id: "email", label: "Email Templates", icon: Mail },
    { id: "strike", label: "STRIKE Settings", icon: Shield },
    { id: "academic_year", label: "Academic Year", icon: Calendar },
    { id: "session", label: "Session & Security", icon: Lock },
    { id: "audit", label: "Audit Logs", icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          System Settings
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Configure system-wide parameters and settings
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Tab Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-2">
              <div className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-(--earist-primary) text-white"
                        : "text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                    }`}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-3">
          {/* Academic Year Parameters */}
          {activeTab === "academic_year" && (
            <div className="space-y-4">
              {/* Current Academic Year & Semester */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Current Academic Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                        Academic Year
                      </label>
                      <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      >
                        <option value="2024-2025">2024-2025</option>
                        <option value="2025-2026">2025-2026</option>
                        <option value="2026-2027">2026-2027</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                        Current Semester
                      </label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      >
                        <option value="first">First Semester</option>
                        <option value="second">Second Semester</option>
                        <option value="summer">Summer</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Active Period:</span>{" "}
                      Academic Year {academicYear} —{" "}
                      {semester === "first"
                        ? "First Semester"
                        : semester === "second"
                          ? "Second Semester"
                          : "Summer"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Enrollment Period */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Enrollment Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={enrollmentStart}
                        onChange={(e) => setEnrollmentStart(e.target.value)}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={enrollmentEnd}
                        onChange={(e) => setEnrollmentEnd(e.target.value)}
                        className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-(--earist-body-text)">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Enrollment window:{" "}
                      {new Date(enrollmentStart).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      —{" "}
                      {new Date(enrollmentEnd).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Defense Period Windows */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Defense Period Windows
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Title Defense */}
                    <div className="rounded-lg border border-(--earist-border-gray) p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-(--earist-primary)">
                            Title Defense
                          </p>
                          <p className="text-xs text-(--earist-body-text)">
                            Period for filing Title Defense applications
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={titleDefenseStart}
                            onChange={(e) =>
                              setTitleDefenseStart(e.target.value)
                            }
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={titleDefenseEnd}
                            onChange={(e) => setTitleDefenseEnd(e.target.value)}
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Proposal Defense */}
                    <div className="rounded-lg border border-(--earist-border-gray) p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-50">
                          <FileText className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-(--earist-primary)">
                            Proposal Defense
                          </p>
                          <p className="text-xs text-(--earist-body-text)">
                            Period for filing Proposal Defense applications
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={proposalDefenseStart}
                            onChange={(e) =>
                              setProposalDefenseStart(e.target.value)
                            }
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={proposalDefenseEnd}
                            onChange={(e) =>
                              setProposalDefenseEnd(e.target.value)
                            }
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Final Defense */}
                    <div className="rounded-lg border border-(--earist-border-gray) p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-green-50">
                          <FileText className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-(--earist-primary)">
                            Final Defense
                          </p>
                          <p className="text-xs text-(--earist-body-text)">
                            Period for filing Final Defense applications
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={finalDefenseStart}
                            onChange={(e) =>
                              setFinalDefenseStart(e.target.value)
                            }
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-(--earist-body-text)">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={finalDefenseEnd}
                            onChange={(e) => setFinalDefenseEnd(e.target.value)}
                            className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <Button
                onClick={() => setShowSaveConfirm(true)}
                className="w-full bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Academic Year Settings
              </Button>
            </div>
          )}

          {/* Other Tabs Placeholder */}
          {activeTab !== "academic_year" && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <Settings className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    {tabs.find((t) => t.id === activeTab)?.label}
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    This settings tab will be implemented in a future update.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Save Settings
              </h3>
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mb-4 space-y-3">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">
                    Confirm Save
                  </p>
                </div>
                <p className="mt-2 text-xs text-green-600">
                  This will update the academic year parameters for all system
                  users.
                </p>
              </div>
              <div className="space-y-1 rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="text-xs text-(--earist-body-text)">
                  <span className="font-medium">Academic Year:</span>{" "}
                  {academicYear}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  <span className="font-medium">Semester:</span>{" "}
                  {semester === "first"
                    ? "First Semester"
                    : semester === "second"
                      ? "Second Semester"
                      : "Summer"}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  <span className="font-medium">Enrollment:</span>{" "}
                  {enrollmentStart} to {enrollmentEnd}
                </p>
              </div>
              <p className="text-xs font-medium text-red-600">
                Changes will take effect immediately.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
