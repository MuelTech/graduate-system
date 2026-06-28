"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  CalendarClock,
  MapPin,
  Clock,
  ArrowRight,
  ClipboardSignature
} from "lucide-react";
import { useSession } from "next-auth/react";

interface AssignmentData {
  id: string;
  role: string;
  schedule: {
    id: string;
    defenseDate: string;
    defenseTime: string;
    venueOrLink: string;
    defenseType: string;
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

export default function PanelistDashboard() {
  const { data: session } = useSession();
  const user = session?.user;
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["panelistAssignments"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/panelist/assignments");
      return Array.isArray(res) ? res : [];
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h2
          suppressHydrationWarning
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          {getGreeting()}, {(user as { firstName?: string })?.firstName || "Panelist"}
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Welcome to your Panelist Dashboard. Here are your assigned thesis defenses.
        </p>
      </div>

      <div className="grid gap-6">
        <h3 className="text-lg font-bold text-(--earist-secondary)">Pending Evaluations</h3>
        
        {isLoading ? (
          <p className="text-sm text-gray-500 animate-pulse">Loading assignments...</p>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardSignature className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">You currently have no scheduled defense assignments.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment: AssignmentData) => {
              const schedule = assignment.schedule;
              const thesis = schedule?.thesis;
              const student = thesis?.student?.user;
              
              if (!schedule || !thesis) return null;

              return (
                <Card key={assignment.id} className="overflow-hidden transition-all hover:shadow-md">
                  <div className="h-1.5 w-full bg-(--earist-primary)"></div>
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge className="bg-purple-100 text-purple-700">
                        {schedule.defenseType.replace("_", " ").toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {assignment.role}
                      </Badge>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-bold text-gray-900">
                        {student?.firstName} {student?.lastName}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {thesis.student?.programId || "Program N/A"}
                      </p>
                    </div>

                    <div className="mb-6 space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(schedule.defenseDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formatTime(schedule.defenseTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="truncate">{schedule.venueOrLink}</span>
                      </div>
                    </div>

                    <Link href={`/panelist/scoring/${schedule.id}?panelId=${assignment.id}`}>
                      <Button className="w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90">
                        Grade Defense
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
