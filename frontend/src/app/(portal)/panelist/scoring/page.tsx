"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PanelistAssignmentData as AssignmentData } from "@/types";

export default function PanelistScoringIndex() {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["panelistAssignments"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/panelist/assignments");
      return Array.isArray(res) ? res : [];
    },
  });

  return (
    <div className="pb-24 p-4 max-w-4xl mx-auto mt-6">
      <h3
        className="mb-6 text-2xl font-bold text-(--earist-primary)"
        style={{ fontFamily: '"Calibri", sans-serif' }}
      >
        Select Defense to Score
      </h3>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <p className="text-sm text-gray-500 animate-pulse">Loading your assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-500">You currently have no pending defense evaluations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment: AssignmentData) => {
            const schedule = assignment.schedule;
            const student = schedule?.thesis?.student?.user;
            
            if (!schedule || !student) return null;

            return (
              <Link
                key={assignment.id}
                href={`/panelist/scoring/${schedule.id}?panelId=${assignment.id}`}
                className="flex w-full items-center gap-4 rounded-xl border border-(--earist-border-gray) bg-white p-5 text-left transition-all hover:bg-blue-50/50 hover:shadow-md hover:border-blue-200 group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                  <FileCheck2 className="h-6 w-6 text-blue-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-base font-bold text-(--earist-primary)">
                      {schedule.defenseType.replace("_", " ").toUpperCase()}
                    </p>
                    <Badge variant="outline" className="text-[10px] uppercase text-gray-500">
                      {assignment.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-(--earist-body-text) truncate">
                    <span className="font-semibold text-gray-800">{student.firstName} {student.lastName}</span> &middot; {schedule.thesis.student.programId}
                  </p>
                </div>

                <div className="hidden sm:flex flex-col items-end shrink-0">
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs mb-1">
                    {new Date(schedule.defenseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(schedule.defenseTime || "").toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
