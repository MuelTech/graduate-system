"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

export function StudentCurriculumSection({
  studentId,
  checklist,
  isLoading,
  isError,
  onRetry,
}: {
  studentId: string;
  checklist: StudentCurriculumChecklistDto | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const queryClient = useQueryClient();
  const [editingCourse, setEditingCourse] = useState<{
    group: CurriculumChecklistGroup;
    course: CurriculumChecklistCourse;
  } | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [versionReason, setVersionReason] = useState("");
  const [versionError, setVersionError] = useState("");

  const invalidateChecklist = (updated?: StudentCurriculumChecklistDto) => {
    if (updated) {
      queryClient.setQueryData(["adminStudentCurriculum", studentId], updated);
    } else {
      queryClient.invalidateQueries({
        queryKey: ["adminStudentCurriculum", studentId],
      });
    }
    queryClient.invalidateQueries({
      queryKey: ["adminStudentDetail", studentId],
    });
  };

  const updateCourseMutation = useMutation({
    mutationFn: async (params: {
      courseId: string;
      payload: CourseProgressFormPayload;
    }) =>
      apiClientRequest(
        `/admin/students/${studentId}/curriculum/courses/${params.courseId}`,
        {
          method: "PUT",
          body: JSON.stringify(params.payload),
        },
      ),
    onSuccess: (updated: StudentCurriculumChecklistDto) => {
      invalidateChecklist(updated);
      setEditingCourse(null);
      toast.success("Student coursework updated.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update subject progress.");
    },
  });

  const assignVersionMutation = useMutation({
    mutationFn: async (payload: {
      curriculumVersionId: string;
      reason: string;
    }) =>
      apiClientRequest(`/admin/students/${studentId}/curriculum/version`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated: StudentCurriculumChecklistDto) => {
      invalidateChecklist(updated);
      setVersionOpen(false);
      toast.success("Curriculum version updated.");
    },
    onError: (err: Error) => {
      setVersionError(err.message || "Failed to assign curriculum version.");
    },
  });

  const openVersionDialog = () => {
    if (!checklist) return;
    setSelectedVersionId(
      checklist.curriculumVersion?.id ??
        checklist.availableVersions[0]?.id ??
        "",
    );
    setVersionReason("");
    setVersionError("");
    setVersionOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="border-gray-200/80 shadow-xs">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !checklist) {
    return (
      <Card className="border-gray-200/80 shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#262220]">
              Curriculum Checklist
            </h2>
            <p className="text-xs text-gray-500">
              Unable to retrieve the student&apos;s curriculum checklist right
              now.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const selectedVersionLabel =
    checklist.availableVersions.find((v) => v.id === selectedVersionId)?.label ??
    "Select curriculum version";

  return (
    <div className="space-y-5">
      <Card className="border-gray-200/80 shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#262220]">
              Curriculum Checklist
            </h2>
            <p className="text-xs text-gray-500">
              View or update coursework progress and manage the student&apos;s
              assigned curriculum.
            </p>
          </div>
          {checklist.availableVersions.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openVersionDialog}
            >
              Change Curriculum
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {!checklist.curriculumVersion || !checklist.summary ? (
        <Card className="border-gray-200/80 shadow-xs">
          <CardContent className="p-6 text-sm text-gray-600">
            No curriculum checklist is currently assigned for{" "}
            {checklist.student.programName}.
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
        </>
      )}

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

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Assigned Curriculum</DialogTitle>
            <DialogDescription>
              Assign or switch between New Curriculum (S.Y. 2024–2025) and Old
              Curriculum. Existing subject entries remain preserved.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setVersionError("");
              if (!selectedVersionId) {
                setVersionError("Please select a curriculum version.");
                return;
              }
              if (versionReason.trim().length < 3) {
                setVersionError(
                  "Please provide an audit reason of at least 3 characters.",
                );
                return;
              }
              assignVersionMutation.mutate({
                curriculumVersionId: selectedVersionId,
                reason: versionReason.trim(),
              });
            }}
          >
            {versionError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {versionError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label
                htmlFor="stu-curr-version-select"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Curriculum
              </label>
              <Select
                value={selectedVersionId}
                onValueChange={(val) => setSelectedVersionId(val ?? "")}
              >
                <SelectTrigger
                  id="stu-curr-version-select"
                  className="w-full data-[size=default]:h-10"
                >
                  <span className="flex-1 truncate text-left text-[#262220]">
                    {selectedVersionLabel}
                  </span>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="w-(--anchor-width)"
                >
                  {checklist.availableVersions.map((ver) => (
                    <SelectItem key={ver.id} value={ver.id}>
                      {ver.label} ({ver.totalRequiredUnits} units)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="stu-curr-version-reason"
                className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
              >
                Reason for Change *
              </label>
              <Textarea
                id="stu-curr-version-reason"
                rows={2}
                required
                minLength={3}
                maxLength={500}
                placeholder="e.g., Matches student COR curriculum"
                value={versionReason}
                onChange={(e) => setVersionReason(e.target.value)}
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                className="bg-[#e02b20] text-white hover:bg-[#b71c1c]"
                disabled={assignVersionMutation.isPending}
              >
                {assignVersionMutation.isPending
                  ? "Saving..."
                  : "Save Curriculum"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
