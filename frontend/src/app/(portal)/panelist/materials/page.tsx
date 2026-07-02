"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, FolderOpen } from "lucide-react";
import { PanelistAssignmentData as AssignmentData, DocumentData } from "@/types";

export default function PanelistMaterialsPage() {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["panelistAssignments"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/panelist/assignments");
      return Array.isArray(res) ? res : [];
    },
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Defense Materials
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Access research documents for your assigned defenses
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 animate-pulse mt-8">Loading materials...</p>
      ) : assignments.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-gray-300" />
            <p className="text-gray-500 font-medium">You have no defense materials at this time.</p>
          </CardContent>
        </Card>
      ) : (
        /* Materials by Defense */
        <div className="space-y-4 mt-6">
          {assignments.map((assignment: AssignmentData) => {
            const schedule = assignment.schedule;
            const student = schedule?.thesis?.student?.user;
            const documents = schedule?.thesis?.thesisDocuments || [];

            if (!schedule || !student) return null;

            const isUpcoming = schedule.status === "SCHEDULED";

            return (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          isUpcoming ? "bg-blue-50" : "bg-green-50"
                        }`}
                      >
                        <FileText
                          className={`h-5 w-5 ${
                            isUpcoming ? "text-blue-600" : "text-green-600"
                          }`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-(--earist-primary)">
                          {schedule.defenseType.replace("_", " ").toUpperCase()}
                        </CardTitle>
                        <p className="text-sm text-(--earist-body-text)">
                          <span className="font-semibold text-gray-800">{student.firstName} {student.lastName}</span> &middot; {schedule.thesis.student.programId}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge
                        className={
                          isUpcoming
                            ? "bg-blue-100 text-blue-700 font-bold uppercase text-[10px]"
                            : "bg-green-100 text-green-700 font-bold uppercase text-[10px]"
                        }
                      >
                        {isUpcoming ? "Upcoming" : "Completed"}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-(--earist-body-text)">
                        <Calendar className="h-4 w-4 text-(--earist-primary)" />
                        {new Date(schedule.defenseDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {documents.length > 0 ? (
                      documents.map((doc: DocumentData) => (
                        <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-(--earist-border-gray) p-3 transition-colors hover:bg-blue-50/30">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-red-50">
                            <FileText className="h-5 w-5 text-red-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-(--earist-primary) capitalize">
                              {doc.docType.replace("_", " ").toLowerCase()}
                            </p>
                            <p className="text-xs font-medium text-gray-500">
                              PDF Document &middot; Uploaded{" "}
                              {new Date(doc.uploadedAt || new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                          <a
                            href={`${process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000"}/${doc.filePath.replace(/\\/g, "/")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-(--earist-primary) px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-(--earist-primary)/90 shadow-sm"
                          >
                            <Download className="h-3.5 w-3.5" />
                            View
                          </a>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-lg border border-dashed border-gray-200 p-6 text-center">
                        <p className="text-sm text-gray-500 italic">No documents have been uploaded for this defense yet.</p>
                      </div>
                    )}
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
