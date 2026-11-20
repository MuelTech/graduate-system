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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  COURSE_STATUS_LABEL,
  COURSE_STATUS_OPTIONS,
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_STATUS_OPTIONS,
  SEMESTER_OPTIONS,
  isGradedCourseStatus,
} from "@/lib/curriculum";
import type {
  CourseProgressStatus,
  CurriculumChecklistCourse,
  CurriculumChecklistGroup,
  GradingScaleInfo,
  GraduationRequirementsView,
  PublicationMilestoneStatus,
} from "@/types/curriculum";

export interface CourseProgressFormPayload {
  status: CourseProgressStatus;
  rating: string | null;
  semester: string | null;
  schoolYear: string | null;
  remarks: string | null;
  isVerifiedByAdmin?: boolean;
}

function CourseProgressForm({
  mode,
  course,
  gradingScale,
  isSaving,
  onSave,
}: {
  mode: "STUDENT" | "ADMIN";
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
  const [isVerifiedByAdmin, setIsVerifiedByAdmin] = useState<boolean>(
    course.progress.isVerifiedByAdmin,
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
      ...(mode === "ADMIN" ? { isVerifiedByAdmin } : {}),
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
            Rating (Manual §7.16)
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
          placeholder="e.g. Credited from prior coursework or Registrar grade slip"
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      {mode === "ADMIN" ? (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/70 px-3.5 py-2.5">
          <div className="space-y-0.5 pr-3">
            <p className="text-xs font-semibold text-[#262220]">
              Verified by Graduate School
            </p>
            <p className="text-[11px] text-gray-500">
              Locks this entry from student edits after COR or Registrar
              confirmation.
            </p>
          </div>
          <Switch
            checked={isVerifiedByAdmin}
            onCheckedChange={setIsVerifiedByAdmin}
          />
        </div>
      ) : null}

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
  mode,
  course,
  group,
  gradingScale,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "STUDENT" | "ADMIN";
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
            mode={mode}
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

export interface PublicationFormPayload {
  publicationStatus: PublicationMilestoneStatus;
  publicationTitle: string | null;
  publicationVenue: string | null;
  publicationUrl: string | null;
  publicationYear: string | null;
  publicationNotes: string | null;
  isPublicationVerified?: boolean;
}

function PublicationMilestoneForm({
  mode,
  publication,
  isSaving,
  onSave,
}: {
  mode: "STUDENT" | "ADMIN";
  publication: GraduationRequirementsView["publication"];
  isSaving: boolean;
  onSave: (payload: PublicationFormPayload) => void;
}) {
  const [status, setStatus] = useState<PublicationMilestoneStatus>(
    publication.status,
  );
  const [title, setTitle] = useState(publication.title ?? "");
  const [venue, setVenue] = useState(publication.venue ?? "");
  const [url, setUrl] = useState(publication.url ?? "");
  const [year, setYear] = useState(publication.year ?? "");
  const [notes, setNotes] = useState(publication.notes ?? "");
  const [isVerified, setIsVerified] = useState(publication.isVerified);

  const statusChoices =
    mode === "ADMIN"
      ? PUBLICATION_STATUS_OPTIONS
      : PUBLICATION_STATUS_OPTIONS.filter((opt) => opt.value !== "VERIFIED");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      publicationStatus: mode === "ADMIN" && isVerified ? "VERIFIED" : status,
      publicationTitle: title.trim() || null,
      publicationVenue: venue.trim() || null,
      publicationUrl: url.trim() || null,
      publicationYear: year.trim() || null,
      publicationNotes: notes.trim() || null,
      ...(mode === "ADMIN" ? { isPublicationVerified: isVerified } : {}),
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="pub-status"
            className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Status
          </label>
          <Select
            value={status}
            onValueChange={(val) => {
              const next = val as PublicationMilestoneStatus;
              setStatus(next);
              if (mode === "ADMIN" && next === "VERIFIED") {
                setIsVerified(true);
              } else if (mode === "ADMIN" && next !== "VERIFIED") {
                setIsVerified(false);
              }
            }}
          >
            <SelectTrigger
              id="pub-status"
              className="w-full data-[size=default]:h-10"
            >
              <span className="flex-1 truncate text-left text-[#262220]">
                {PUBLICATION_STATUS_LABEL[status] ?? status}
              </span>
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-(--anchor-width)"
            >
              {statusChoices.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="pub-year"
            className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Publication Year
          </label>
          <Input
            id="pub-year"
            value={year}
            maxLength={16}
            placeholder="e.g. 2026"
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="pub-title"
          className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Article / Output Title
        </label>
        <Input
          id="pub-title"
          value={title}
          maxLength={500}
          placeholder="Title of published journal article or creative work"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="pub-venue"
          className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Journal / Refereed Outlet
        </label>
        <Input
          id="pub-venue"
          value={venue}
          maxLength={255}
          placeholder="e.g. Philippine Journal of Mathematics Education"
          onChange={(e) => setVenue(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="pub-url"
          className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          DOI / Reference URL (optional)
        </label>
        <Input
          id="pub-url"
          type="url"
          value={url}
          maxLength={500}
          placeholder="https://..."
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="pub-notes"
          className="block text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Notes (optional)
        </label>
        <Textarea
          id="pub-notes"
          rows={2}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {mode === "ADMIN" ? (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/70 px-3.5 py-2.5">
          <div className="space-y-0.5 pr-3">
            <p className="text-xs font-semibold text-[#262220]">
              Verified by Graduate School
            </p>
            <p className="text-[11px] text-gray-500">
              Confirms compliance with Manual §7.25.2 graduation publication
              requirement.
            </p>
          </div>
          <Switch
            checked={isVerified}
            onCheckedChange={(checked) => {
              setIsVerified(checked);
              setStatus(checked ? "VERIFIED" : "SUBMITTED");
            }}
          />
        </div>
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          className="bg-[#e02b20] text-white hover:bg-[#b71c1c]"
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save Publication"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PublicationMilestoneDialog({
  open,
  onOpenChange,
  mode,
  publication,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "STUDENT" | "ADMIN";
  publication: GraduationRequirementsView["publication"] | null;
  isSaving: boolean;
  onSave: (payload: PublicationFormPayload) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Research Publication Requirement</DialogTitle>
          <DialogDescription>
            {publication?.requirementDescription ??
              "Track journal or juried creative work publication progress."}
          </DialogDescription>
        </DialogHeader>

        {open && publication ? (
          <PublicationMilestoneForm
            key={`${publication.status}-${publication.isVerified}-${publication.title ?? ""}`}
            mode={mode}
            publication={publication}
            isSaving={isSaving}
            onSave={onSave}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
