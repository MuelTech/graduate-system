"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck2,
  Calendar,
  Clock,
  ExternalLink,
  Users,
  CheckCircle2,
  MapPin,
} from "lucide-react";

interface AssignmentData {
  id: string;
  role: string;
  schedule: {
    id: string;
    defenseDate: string;
    defenseTime: string;
    venueOrLink: string;
    defenseType: string;
    status: string; // "SCHEDULED" or "COMPLETED"
    thesis: {
      student: {
        programId: string;
        user: {
          firstName: string;
          lastName: string;
        };
      };
    };
  };
}

export default function PanelistDefensesPage() {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["panelistAssignments"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/panelist/assignments");
      return Array.isArray(res) ? res : [];
    },
  });

  const upcomingCount = assignments.filter((a: AssignmentData) => a.schedule.status === "SCHEDULED").length;
  const completedCount = assignments.filter((a: AssignmentData) => a.schedule.status !== "SCHEDULED").length;

  return (
    <div className="space-y-4 pb-24">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          My Defenses
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          View your assigned defense schedules and details
        </p>
      </div>

      {/* Summary Badges (From your Mock) */}
      <div className="flex gap-2">
        <Badge className="bg-blue-100 text-blue-700">
          {upcomingCount} Upcoming
        </Badge>
        <Badge className="bg-green-100 text-green-700">
          {completedCount} Completed
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 animate-pulse mt-8">Loading schedules...</p>
      ) : assignments.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-500 font-medium">You have no scheduled defenses at this time.</p>
          </CardContent>
        </Card>
      ) : (
        /* Defense Cards (Exact structure of your Mock) */
        <div className="space-y-4">
          {assignments.map((assignment: AssignmentData) => {
            const schedule = assignment.schedule;
            const student = schedule?.thesis?.student?.user;
            
            if (!schedule || !student) return null;

            const isUpcoming = schedule.status === "SCHEDULED";
            const isOnline = schedule.venueOrLink.includes("http");

            return (
              <Card key={assignment.id}>
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Left: Defense Info */}
                    <div className="flex-1 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            isUpcoming ? "bg-blue-50" : "bg-green-50"
                          }`}
                        >
                          {isUpcoming ? (
                            <FileCheck2 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-(--earist-primary)">
                            {schedule.defenseType.replace("_", " ").toUpperCase()}
                          </h3>
                          <p className="text-xs text-(--earist-body-text)">
                            <span className="font-semibold text-gray-800">{student.firstName} {student.lastName}</span> &middot;{" "}
                            {schedule.thesis.student.programId}
                          </p>
                        </div>
                      </div>

                      <div className="ml-12">
                        <Badge variant="outline" className="mb-2 text-[10px] uppercase font-bold text-gray-500">
                          Role: {assignment.role}
                        </Badge>
                        <div className="flex items-start gap-2 text-sm text-(--earist-body-text)">
                          <Users className="mt-0.5 h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-semibold">Panel Members:</p>
                            <ul className="ml-2 mt-1 list-disc space-y-1 text-xs">
                              <li>{assignment.role} (You)</li>
                              <li className="text-gray-400 italic">Other panelists hidden for privacy</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Schedule & Actions */}
                    <div className="flex w-full flex-col justify-between border-t border-(--earist-border-gray) bg-(--earist-surface-gray) p-4 lg:w-72 lg:border-t-0 lg:border-l">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-(--earist-body-text)">
                          <Calendar className="h-4 w-4 text-(--earist-primary)" />
                          <span>{new Date(schedule.defenseDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-(--earist-body-text)">
                          <Clock className="h-4 w-4 text-(--earist-primary)" />
                          <span>{new Date(schedule.defenseTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-(--earist-body-text)">
                          {isOnline ? (
                            <ExternalLink className="h-4 w-4 text-blue-500" />
                          ) : (
                            <MapPin className="h-4 w-4 text-red-500" />
                          )}
                          {isOnline ? (
                            <a
                              href={schedule.venueOrLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Join via Teams/Meet
                            </a>
                          ) : (
                            <span>{schedule.venueOrLink}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2">
                        {isUpcoming && (
                          <Link
                            href={`/panelist/scoring/${schedule.id}?panelId=${assignment.id}`}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-(--earist-primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--earist-primary)/90"
                          >
                            Grade Defense
                          </Link>
                        )}
                        <Link
                          href="/panelist/materials"
                          className="inline-flex w-full items-center justify-center rounded-lg border border-(--earist-border-gray) bg-white px-4 py-2 text-sm font-semibold text-(--earist-body-text) transition-colors hover:bg-gray-50"
                        >
                          View Materials
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
