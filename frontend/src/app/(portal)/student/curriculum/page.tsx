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
  CurriculumGraduationSummaryCard,
  CurriculumGroupsList,
  CurriculumSummaryStrip,
} from "@/components/curriculum/curriculum-checklist-views";
import {
  CourseProgressDialog,
  type CourseProgressFormPayload,
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

  const checklist = checklistQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Checklist"
        description={
          checklist
            ? checklist.student.programName
            : "Track your required subjects and earned units."
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
              {checklist.student.programName}. Please contact the Graduate
              School Office to verify your curriculum assignment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <CurriculumSummaryStrip checklist={checklist} />

          {checklist.summary.incCount > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800">
              {checklist.gradingScale.incRemovalNote}
            </div>
          ) : null}

          <CurriculumGroupsList
            groups={checklist.groups}
            onEditCourse={(group, course) =>
              setEditingCourse({ group, course })
            }
          />

          <CurriculumGraduationSummaryCard checklist={checklist} />

          <p className="text-xs text-gray-500">
            If your assigned curriculum does not match your Certificate of
            Registration (COR), please contact the Graduate School Office.
          </p>

          <CourseProgressDialog
            open={editingCourse !== null}
            onOpenChange={(open) => {
              if (!open) setEditingCourse(null);
            }}
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
        </>
      )}
    </div>
  );
}
