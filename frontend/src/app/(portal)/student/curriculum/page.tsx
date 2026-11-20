"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest } from "@/lib/api.client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  CurriculumGroupsList,
  CurriculumSummaryStrip,
  GraduationRequirementsCard,
} from "@/components/curriculum/curriculum-checklist-views";
import {
  CourseProgressDialog,
  PublicationMilestoneDialog,
  type CourseProgressFormPayload,
  type PublicationFormPayload,
} from "@/components/curriculum/curriculum-edit-dialogs";
import type {
  CurriculumChecklistCourse,
  CurriculumChecklistGroup,
  StudentCurriculumChecklistDto,
} from "@/types/curriculum";

export default function StudentCurriculumPage() {
  const queryClient = useQueryClient();
  const [editingCourse, setEditingCourse] = useState<{
    group: CurriculumChecklistGroup;
    course: CurriculumChecklistCourse;
  } | null>(null);
  const [publicationOpen, setPublicationOpen] = useState(false);

  const checklistQuery = useQuery<StudentCurriculumChecklistDto>({
    queryKey: ["studentCurriculum"],
    queryFn: async () => apiClientRequest("/student/curriculum"),
  });

  const updateCourseMutation = useMutation({
    mutationFn: async (params: {
      courseId: string;
      payload: CourseProgressFormPayload;
    }) =>
      apiClientRequest(`/student/curriculum/courses/${params.courseId}`, {
        method: "PUT",
        body: JSON.stringify(params.payload),
      }),
    onSuccess: (updated: StudentCurriculumChecklistDto) => {
      queryClient.setQueryData(["studentCurriculum"], updated);
      setEditingCourse(null);
      toast.success("Coursework progress updated.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update subject progress.");
    },
  });

  const updatePublicationMutation = useMutation({
    mutationFn: async (payload: PublicationFormPayload) =>
      apiClientRequest("/student/curriculum/publication", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated: StudentCurriculumChecklistDto) => {
      queryClient.setQueryData(["studentCurriculum"], updated);
      setPublicationOpen(false);
      toast.success("Publication milestone saved.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update publication milestone.");
    },
  });

  const checklist = checklistQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Checklist"
        description={
          checklist
            ? `${checklist.student.programName} — Plan of Coursework`
            : "Track your required subjects, ratings, and graduation requirements."
        }
      />

      {checklistQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : checklistQuery.isError || !checklist ? (
        <Card className="border-gray-200/80 shadow-xs">
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-sm font-semibold text-[#8b1a1a]">
              Unable to load curriculum checklist
            </p>
            <p className="text-xs text-gray-500">
              {checklistQuery.error instanceof Error
                ? checklistQuery.error.message
                : "Please try again or contact the Graduate School Office."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => checklistQuery.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !checklist.curriculumVersion || !checklist.summary ? (
        <Card className="border-gray-200/80 shadow-xs">
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-semibold text-[#262220]">
              No curriculum checklist assigned yet
            </p>
            <p className="text-xs text-gray-600">
              No active curriculum checklist has been linked to{" "}
              {checklist.student.programName}. Please contact the Graduate School
              Office to verify your curriculum assignment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200/80 bg-white px-4 py-3 text-xs text-gray-600 shadow-2xs">
            Self-service Plan of Coursework tracker (EARIST Manual §7.9 &amp;
            §7.16). Use this checklist to track your completed, in-progress, and
            remaining subjects — encoding entries here is optional and does not
            restrict Comprehensive Examination or Thesis/Dissertation workflows.{" "}
            If your assigned curriculum version (
            {checklist.curriculumVersion.curriculumType}
            {checklist.curriculumVersion.effectiveSchoolYear
              ? ` · ${checklist.curriculumVersion.effectiveSchoolYear}`
              : ""}
            ) does not match your Certificate of Registration (COR), please
            contact the Graduate School Office to update it.
          </div>

          <CurriculumSummaryStrip checklist={checklist} />

          {checklist.summary.incCount > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800">
              {checklist.gradingScale.incRemovalNote}
            </div>
          ) : null}

          <CurriculumGroupsList
            groups={checklist.groups}
            mode="STUDENT"
            onEditCourse={(group, course) =>
              setEditingCourse({ group, course })
            }
          />

          <GraduationRequirementsCard
            checklist={checklist}
            mode="STUDENT"
            onEditPublication={() => setPublicationOpen(true)}
          />

          <CourseProgressDialog
            open={editingCourse !== null}
            onOpenChange={(open) => {
              if (!open) setEditingCourse(null);
            }}
            mode="STUDENT"
            course={editingCourse?.course ?? null}
            group={editingCourse?.group ?? null}
            gradingScale={checklist.gradingScale}
            isSaving={updateCourseMutation.isPending}
            onSave={(payload) => {
              if (!editingCourse) return;
              updateCourseMutation.mutate({
                courseId: editingCourse.course.id,
                payload,
              });
            }}
          />

          <PublicationMilestoneDialog
            open={publicationOpen}
            onOpenChange={setPublicationOpen}
            mode="STUDENT"
            publication={checklist.graduationRequirements.publication}
            isSaving={updatePublicationMutation.isPending}
            onSave={(payload) => updatePublicationMutation.mutate(payload)}
          />
        </>
      )}
    </div>
  );
}
