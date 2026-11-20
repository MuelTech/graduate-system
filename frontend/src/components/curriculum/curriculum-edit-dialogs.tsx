"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  COURSE_STATUS_LABEL,
  COURSE_STATUS_OPTIONS,
  SEMESTER_OPTIONS,
  isGradedCourseStatus,
} from "@/lib/curriculum";
import type {
  CourseProgressStatus,
  CurriculumChecklistCourse,
  CurriculumChecklistGroup,
  GradingScaleInfo,
} from "@/types/curriculum";

export interface CourseProgressFormPayload {
  status: CourseProgressStatus;
  rating: string | null;
  semester: string | null;
  schoolYear: string | null;
  remarks: string | null;
}

function CourseProgressForm({
  course,
  gradingScale,
  isSaving,
  onSave,
}: {
  course: CurriculumChecklistCourse;
  gradingScale: GradingScaleInfo;
  isSaving: boolean;
  onSave: (payload: CourseProgressFormPayload) => void;
}) {
  const [status, setStatus] = useState<CourseProgressStatus>(
    course.progress.status,
  );
  const [rating, setRating] = useState<string>(
    course.progress.rating ?? "NONE",
  );
  const [semester, setSemester] = useState<string>(
    course.progress.semester ?? "NONE",
  );
  const [schoolYear, setSchoolYear] = useState<string>(
    course.progress.schoolYear ?? "",
  );
  const [remarks, setRemarks] = useState<string>(
    course.progress.remarks ?? "",
  );

  const showRating = isGradedCourseStatus(status);
  const showIncNote = status === "INCOMPLETE" || rating === "INC";

  const availableRatingOptions = gradingScale.options.filter((opt) => {
    if (status === "PASSED" || status === "CREDITED") {
      return opt.outcome === "PASSED";
    }
    if (status === "FAILED") return opt.outcome === "FAILED";
    if (status === "INCOMPLETE") return opt.outcome === "INCOMPLETE";
    if (status === "DROPPED") return opt.outcome === "DROPPED";
    return true;
  });

  const handleStatusChange = (next: CourseProgressStatus) => {
    setStatus(next);
    if (next === "NOT_TAKEN" || next === "IN_PROGRESS") {
      setRating("NONE");
      return;
    }
    if (next === "FAILED") {
      setRating("5.00");
      return;
    }
    if (next === "INCOMPLETE") {
      setRating("INC");
      return;
    }
    if (next === "DROPPED") {
      setRating("DRP");
      return;
    }
    if (next === "PASSED" || next === "CREDITED") {
      const currentValid = gradingScale.options.some(
        (opt) => opt.value === rating && opt.outcome === "PASSED",
      );
      if (!currentValid) {
        setRating("NONE");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      status,
      rating: showRating && rating !== "NONE" ? rating : null,
      semester: semester !== "NONE" ? semester : null,
      schoolYear: schoolYear.trim() || null,
      remarks: remarks.trim() || null,
    });
  };

  const selectedRatingLabel =
    rating === "NONE"
      ? "Not specified"
      : (gradingScale.options.find((opt) => opt.value === rating)?.label ??
        rating);

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="curr-course-status"
            className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Status
          </label>
          <Select
            value={status}
            onValueChange={(val) =>
              handleStatusChange(val as CourseProgressStatus)
            }
          >
            <SelectTrigger
              id="curr-course-status"
              className="w-full data-[size=default]:h-10"
            >
              <span className="flex-1 truncate text-left text-[#262220]">
                {COURSE_STATUS_LABEL[status] ?? status}
              </span>
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-(--anchor-width)"
            >
              {COURSE_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="curr-course-rating"
            className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Rating
          </label>
          <Select
            value={showRating ? rating : "NONE"}
            onValueChange={(val) => setRating(val ?? "NONE")}
            disabled={!showRating}
          >
            <SelectTrigger
              id="curr-course-rating"
              className="w-full data-[size=default]:h-10"
            >
              <span className="flex-1 truncate text-left text-[#262220]">
                {showRating ? selectedRatingLabel : "Not applicable"}
              </span>
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-(--anchor-width)"
            >
              {(status === "PASSED" || status === "CREDITED") && (
                <SelectItem value="NONE">Not specified</SelectItem>
              )}
              {availableRatingOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label} ({opt.percentRange})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showIncNote ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
          {gradingScale.incRemovalNote}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="curr-course-sem"
            className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Semester
          </label>
          <Select
            value={semester}
            onValueChange={(val) => setSemester(val ?? "NONE")}
          >
            <SelectTrigger
              id="curr-course-sem"
              className="w-full data-[size=default]:h-10"
            >
              <span className="flex-1 truncate text-left text-[#262220]">
                {semester === "NONE" ? "Not specified" : semester}
              </span>
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-(--anchor-width)"
            >
              <SelectItem value="NONE">Not specified</SelectItem>
              {SEMESTER_OPTIONS.map((sem) => (
                <SelectItem key={sem} value={sem}>
                  {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="curr-course-sy"
            className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            School Year
          </label>
          <Input
            id="curr-course-sy"
            value={schoolYear}
            maxLength={32}
            placeholder="e.g. 2025-2026"
            onChange={(e) => setSchoolYear(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="curr-course-remarks"
          className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Remarks (optional)
        </label>
        <Textarea
          id="curr-course-remarks"
          rows={2}
          maxLength={500}
          value={remarks}
          placeholder="Optional note"
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          className="bg-[#e02b20] text-white hover:bg-[#b71c1c]"
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save Subject"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CourseProgressDialog({
  open,
  onOpenChange,
  course,
  group,
  gradingScale,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CurriculumChecklistCourse | null;
  group: CurriculumChecklistGroup | null;
  gradingScale: GradingScaleInfo;
  isSaving: boolean;
  onSave: (payload: CourseProgressFormPayload) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {course
              ? `${course.courseCode} — ${course.courseTitle}`
              : "Update Subject"}
          </DialogTitle>
          <DialogDescription>
            {group ? `${group.label} · ${course?.units ?? 0} units` : ""}
          </DialogDescription>
        </DialogHeader>

        {open && course ? (
          <CourseProgressForm
            key={`${course.id}-${course.progress.updatedAt ?? "new"}`}
            course={course}
            gradingScale={gradingScale}
            isSaving={isSaving}
            onSave={onSave}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
