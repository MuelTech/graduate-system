import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck2,
  Calendar,
  Clock,
  ExternalLink,
  FolderOpen,
  PenLine,
  Users,
  CheckCircle2,
  MapPin,
} from "lucide-react";

export default function PanelistDefensesPage() {
  const defenses = [
    {
      id: 1,
      stage: "Final Defense",
      researcher: "Maria Santos",
      program: "Master of Science in Computer Science",
      date: "June 10, 2026",
      time: "9:00 AM — 12:00 PM",
      status: "upcoming" as "upcoming" | "completed" | "in_progress",
      teamsLink: "https://teams.microsoft.com/l/meetup-join/1",
      role: "Chairperson",
      panelMembers: [
        "Dr. Roberto Reyes (Chairperson)",
        "Dr. Ana Garcia (Member)",
        "Dr. Juan Dela Cruz (Member)",
      ],
    },
    {
      id: 2,
      stage: "Proposal Defense",
      researcher: "Juan Dela Cruz",
      program: "Master of Science in Computer Science",
      date: "June 12, 2026",
      time: "1:00 PM — 4:00 PM",
      status: "upcoming" as "upcoming" | "completed" | "in_progress",
      teamsLink: "https://teams.microsoft.com/l/meetup-join/2",
      role: "Member",
      panelMembers: [
        "Dr. Ana Garcia (Chairperson)",
        "Dr. Roberto Reyes (Member)",
        "Dr. Pedro Lim (Member)",
      ],
    },
    {
      id: 3,
      stage: "Title Defense",
      researcher: "Ana Garcia",
      program: "Master of Information Technology",
      date: "June 15, 2026",
      time: "10:00 AM — 12:00 PM",
      status: "upcoming" as "upcoming" | "completed" | "in_progress",
      teamsLink: "https://teams.microsoft.com/l/meetup-join/3",
      role: "Member",
      panelMembers: [
        "Dr. Roberto Reyes (Chairperson)",
        "Dr. Ana Garcia (Member)",
        "Dr. Maria Santos (Member)",
      ],
    },
    {
      id: 4,
      stage: "Final Defense",
      researcher: "Carlos Luna",
      program: "Master of Arts in Education",
      date: "May 28, 2026",
      time: "9:00 AM — 12:00 PM",
      status: "completed" as "upcoming" | "completed" | "in_progress",
      teamsLink: null,
      role: "Member",
      panelMembers: [
        "Dr. Pedro Lim (Chairperson)",
        "Dr. Roberto Reyes (Member)",
        "Dr. Juan Dela Cruz (Member)",
      ],
    },
    {
      id: 5,
      stage: "Proposal Defense",
      researcher: "Elena Torres",
      program: "Doctor of Education",
      date: "May 20, 2026",
      time: "1:00 PM — 4:00 PM",
      status: "completed" as "upcoming" | "completed" | "in_progress",
      teamsLink: null,
      role: "Chairperson",
      panelMembers: [
        "Dr. Roberto Reyes (Chairperson)",
        "Dr. Ana Garcia (Member)",
        "Dr. Pedro Lim (Member)",
      ],
    },
  ];

  const upcomingCount = defenses.filter((d) => d.status === "upcoming").length;
  const completedCount = defenses.filter(
    (d) => d.status === "completed",
  ).length;

  return (
    <div className="space-y-4">
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

      {/* Summary Badges */}
      <div className="flex gap-2">
        <Badge className="bg-blue-100 text-blue-700">
          {upcomingCount} Upcoming
        </Badge>
        <Badge className="bg-green-100 text-green-700">
          {completedCount} Completed
        </Badge>
      </div>

      {/* Defense Cards */}
      <div className="space-y-4">
        {defenses.map((defense) => (
          <Card key={defense.id}>
            <CardContent className="p-0">
              <div className="flex flex-col lg:flex-row">
                {/* Left: Defense Info */}
                <div className="flex-1 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        defense.status === "upcoming"
                          ? "bg-blue-50"
                          : defense.status === "in_progress"
                            ? "bg-amber-50"
                            : "bg-green-50"
                      }`}
                    >
                      <FileCheck2
                        className={`h-5 w-5 ${
                          defense.status === "upcoming"
                            ? "text-blue-600"
                            : defense.status === "in_progress"
                              ? "text-amber-600"
                              : "text-green-600"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-(--earist-primary)">
                          {defense.stage}
                        </p>
                        <Badge
                          className={
                            defense.status === "upcoming"
                              ? "bg-blue-100 text-blue-700"
                              : defense.status === "in_progress"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                          }
                        >
                          {defense.status === "upcoming"
                            ? "Upcoming"
                            : defense.status === "in_progress"
                              ? "In Progress"
                              : "Completed"}
                        </Badge>
                      </div>
                      <p className="text-xs text-(--earist-body-text)">
                        {defense.role}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm font-medium text-(--earist-primary)">
                      {defense.researcher}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {defense.program}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-(--earist-body-text)">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {defense.date}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {defense.time}
                    </div>
                  </div>

                  {/* Panel Members */}
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                      Panel Members
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {defense.panelMembers.map((member, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[11px]"
                        >
                          <Users className="mr-1 h-3 w-3" />
                          {member}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 border-t border-(--earist-border-gray) p-4 lg:flex-col lg:border-t-0 lg:border-l lg:px-4">
                  {defense.status === "upcoming" && defense.teamsLink && (
                    <a
                      href={defense.teamsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg bg-(--earist-primary) px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-(--earist-primary)/90"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Join Meeting
                    </a>
                  )}
                  <Link
                    href="/panelist/materials"
                    className="flex items-center gap-1 rounded-lg border border-(--earist-border-gray) px-3 py-2 text-xs font-semibold text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-gray)"
                  >
                    <FolderOpen className="h-3 w-3" />
                    Materials
                  </Link>
                  {defense.status === "upcoming" && (
                    <Link
                      href="/panelist/scoring"
                      className="flex items-center gap-1 rounded-lg border border-(--earist-border-gray) px-3 py-2 text-xs font-semibold text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-gray)"
                    >
                      <PenLine className="h-3 w-3" />
                      Score
                    </Link>
                  )}
                  {defense.status === "completed" && (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Scored
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
