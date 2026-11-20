"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClientRequest } from "@/lib/api.client";
import { CURRICULUM_GROUP_TYPE_OPTIONS } from "@/lib/curriculum";
import { cn } from "@/lib/utils";
import type { Program } from "@/types";
import type {
  AdminCurriculumCourseItem,
  AdminCurriculumGroupItem,
  AdminCurriculumVersionDetail,
  CurriculumGroupType,
} from "@/types/curriculum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type VersionTypeFilter = "ALL" | "NEW" | "OLD";

export function CurriculaSettingsTab() {
  const queryClient = useQueryClient();
  const [selectedProgramId, setSelectedProgramId] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<VersionTypeFilter>("ALL");
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const [versionDialog, setVersionDialog] = useState<{
    mode: "create" | "edit";
    version?: AdminCurriculumVersionDetail;
  } | null>(null);

  const [groupDialog, setGroupDialog] = useState<{
    mode: "create" | "edit";
    versionId: string;
    group?: AdminCurriculumGroupItem;
  } | null>(null);

  const [courseDialog, setCourseDialog] = useState<{
    mode: "create" | "edit";
    groupId: string;
    groupLabel: string;
    course?: AdminCurriculumCourseItem;
  } | null>(null);

  const programsQuery = useQuery<{ programs: Program[] }>({
    queryKey: ["adminPrograms"],
    queryFn: async () => apiClientRequest("/programs/admin"),
  });

  const versionsQuery = useQuery<{ versions: AdminCurriculumVersionDetail[] }>({
    queryKey: ["adminCurricula"],
    queryFn: async () => apiClientRequest("/curricula/admin"),
  });

  const programs = useMemo(
    () => programsQuery.data?.programs ?? [],
    [programsQuery.data],
  );
  const versions = useMemo(
    () => versionsQuery.data?.versions ?? [],
    [versionsQuery.data],
  );

  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      if (selectedProgramId !== "ALL" && v.programId !== selectedProgramId) {
        return false;
      }
      if (typeFilter !== "ALL" && v.curriculumType !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [versions, selectedProgramId, typeFilter]);

  const selectedVersion = useMemo(() => {
    if (filteredVersions.length === 0) return null;
    return (
      filteredVersions.find((v) => v.id === activeVersionId) ??
      filteredVersions[0]
    );
  }, [filteredVersions, activeVersionId]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["adminCurricula"] });
    queryClient.invalidateQueries({ queryKey: ["adminStudentCurriculum"] });
  };

  const saveVersionMutation = useMutation({
    mutationFn: async (params: {
      id?: string;
      body: {
        programId?: string;
        versionCode: string;
        label: string;
        curriculumType: "NEW" | "OLD";
        effectiveSchoolYear: string | null;
        isDefaultForNewStudents: boolean;
        isActive: boolean;
        notes: string | null;
      };
    }) => {
      if (params.id) {
        return apiClientRequest(`/curricula/admin/${params.id}`, {
          method: "PUT",
          body: JSON.stringify(params.body),
        });
      }
      return apiClientRequest("/curricula/admin", {
        method: "POST",
        body: JSON.stringify(params.body),
      });
    },
    onSuccess: (res: { version?: AdminCurriculumVersionDetail }, vars) => {
      invalidateAll();
      if (res?.version?.id) setActiveVersionId(res.version.id);
      setVersionDialog(null);
      toast.success(
        vars.id ? "Curriculum version updated." : "Curriculum version created.",
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save curriculum version.");
    },
  });

  const saveGroupMutation = useMutation({
    mutationFn: async (params: {
      versionId: string;
      groupId?: string;
      body: {
        groupType: CurriculumGroupType;
        label: string;
        requiredUnits: number;
        countsTowardWce: boolean;
        selectionNote: string | null;
        displayOrder: number;
      };
    }) => {
      if (params.groupId) {
        return apiClientRequest(`/curricula/admin/groups/${params.groupId}`, {
          method: "PUT",
          body: JSON.stringify(params.body),
        });
      }
      return apiClientRequest(
        `/curricula/admin/${params.versionId}/groups`,
        {
          method: "POST",
          body: JSON.stringify(params.body),
        },
      );
    },
    onSuccess: (_res, vars) => {
      invalidateAll();
      setGroupDialog(null);
      toast.success(vars.groupId ? "Group updated." : "Course group added.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save course group.");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) =>
      apiClientRequest(`/curricula/admin/groups/${groupId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Course group deleted.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete course group.");
    },
  });

  const saveCourseMutation = useMutation({
    mutationFn: async (params: {
      groupId: string;
      courseId?: string;
      body: {
        courseCode: string;
        courseTitle: string;
        units: number;
        isRequired: boolean;
        prerequisiteNote: string | null;
        displayOrder: number;
      };
    }) => {
      if (params.courseId) {
        return apiClientRequest(`/curricula/admin/courses/${params.courseId}`, {
          method: "PUT",
          body: JSON.stringify(params.body),
        });
      }
      return apiClientRequest(
        `/curricula/admin/groups/${params.groupId}/courses`,
        {
          method: "POST",
          body: JSON.stringify(params.body),
        },
      );
    },
    onSuccess: (_res, vars) => {
      invalidateAll();
      setCourseDialog(null);
      toast.success(vars.courseId ? "Subject updated." : "Subject added.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save subject.");
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) =>
      apiClientRequest(`/curricula/admin/courses/${courseId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Subject deleted.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete subject.");
    },
  });

  const selectedProgramLabel =
    selectedProgramId === "ALL"
      ? "All Graduate Programs"
      : (programs.find((p) => p.id === selectedProgramId)?.programName ??
        "Select program");

  return (
    <div className="space-y-5">
      <Card className="border-gray-200/80 shadow-xs">
        <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-[#262220]">
              Curriculum Checklists &amp; Versions
            </CardTitle>
            <p className="text-xs text-gray-500">
              Manage official Graduate School curriculum versions, course
              groups, and subjects. Existing students keep their assigned
              version unless explicitly shifted.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-[#e02b20] text-white hover:bg-[#b71c1c]"
            onClick={() => setVersionDialog({ mode: "create" })}
          >
            Add Curriculum Version
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-600 uppercase">
                Filter by Graduate Program
              </Label>
              <Select
                value={selectedProgramId}
                onValueChange={(val) => setSelectedProgramId(val ?? "ALL")}
              >
                <SelectTrigger className="w-full data-[size=default]:h-10">
                  <span className="flex-1 truncate text-left text-[#262220]">
                    {selectedProgramLabel}
                  </span>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="w-(--anchor-width)"
                >
                  <SelectItem value="ALL">All Graduate Programs</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-600 uppercase">
                Curriculum Track
              </Label>
              <Select
                value={typeFilter}
                onValueChange={(val) =>
                  setTypeFilter((val as VersionTypeFilter) ?? "ALL")
                }
              >
                <SelectTrigger className="w-full data-[size=default]:h-10">
                  <span className="flex-1 truncate text-left text-[#262220]">
                    {typeFilter === "ALL"
                      ? "All Versions"
                      : typeFilter === "NEW"
                        ? "New (S.Y. 2024–2025)"
                        : "Old (Pre-2024)"}
                  </span>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="w-(--anchor-width)"
                >
                  <SelectItem value="ALL">All Versions</SelectItem>
                  <SelectItem value="NEW">New (S.Y. 2024–2025)</SelectItem>
                  <SelectItem value="OLD">Old (Pre-2024)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {versionsQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Loading curricula...
            </p>
          ) : filteredVersions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No curriculum versions match the selected filter.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200/80">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 bg-gray-50/70 hover:bg-gray-50/70">
                    <TableHead className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Program
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Version
                    </TableHead>
                    <TableHead className="text-center text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Units
                    </TableHead>
                    <TableHead className="text-center text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Students
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Status
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVersions.map((ver) => {
                    const isSelected = selectedVersion?.id === ver.id;
                    return (
                      <TableRow
                        key={ver.id}
                        className={cn(
                          "cursor-pointer border-gray-100",
                          isSelected && "bg-[#8b1a1a]/5",
                        )}
                        onClick={() => setActiveVersionId(ver.id)}
                      >
                        <TableCell className="text-sm font-medium text-[#262220]">
                          {ver.program.programName}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-[#262220]">
                              {ver.label}
                            </p>
                            <p className="font-mono text-[11px] text-gray-500">
                              {ver.versionCode}
                              {ver.effectiveSchoolYear
                                ? ` · ${ver.effectiveSchoolYear}`
                                : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {ver.totalRequiredUnits}
                        </TableCell>
                        <TableCell className="text-center text-sm text-gray-600">
                          {ver._count.students}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={
                                ver.isActive
                                  ? "border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                                  : "border-gray-200 bg-gray-100 text-[11px] text-gray-600"
                              }
                            >
                              {ver.isActive ? "Active" : "Archived"}
                            </Badge>
                            {ver.isDefaultForNewStudents ? (
                              <Badge
                                variant="outline"
                                className="border-sky-200 bg-sky-50 text-[11px] text-sky-700"
                              >
                                Default
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveVersionId(ver.id)}
                            >
                              {isSelected ? "Inspecting" : "Manage"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setVersionDialog({ mode: "edit", version: ver })
                              }
                            >
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedVersion ? (
        <Card className="border-gray-200/80 shadow-xs">
          <CardHeader className="flex flex-wrap flex-row items-start justify-between gap-3 border-b border-gray-100 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-[#262220]">
                {selectedVersion.program.programName} — {selectedVersion.label}
              </CardTitle>
              <p className="text-xs text-gray-500">
                Total required units across groups:{" "}
                <strong className="text-[#262220]">
                  {selectedVersion.totalRequiredUnits} units
                </strong>
                {selectedVersion.notes ? ` · ${selectedVersion.notes}` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setGroupDialog({
                  mode: "create",
                  versionId: selectedVersion.id,
                })
              }
            >
              Add Course Group
            </Button>
          </CardHeader>

          <CardContent className="space-y-5 pt-5">
            {selectedVersion.groups.length === 0 ? (
              <p className="text-sm text-gray-500">
                No course groups defined in this curriculum version yet.
              </p>
            ) : (
              selectedVersion.groups.map((grp) => (
                <div
                  key={grp.id}
                  className="space-y-3 rounded-lg border border-gray-200/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#262220]">
                          {grp.label}
                        </h3>
                        <Badge
                          variant="outline"
                          className="border-gray-200 text-[11px]"
                        >
                          {grp.requiredUnits} required units
                        </Badge>
                        {!grp.countsTowardWce ? (
                          <Badge
                            variant="outline"
                            className="border-gray-200 bg-gray-50 text-[11px] text-gray-600"
                          >
                            Excluded from WCE coursework
                          </Badge>
                        ) : null}
                      </div>
                      {grp.selectionNote ? (
                        <p className="text-xs text-[#8b1a1a]">
                          {grp.selectionNote}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCourseDialog({
                            mode: "create",
                            groupId: grp.id,
                            groupLabel: grp.label,
                          })
                        }
                      >
                        Add Subject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setGroupDialog({
                            mode: "edit",
                            versionId: selectedVersion.id,
                            group: grp,
                          })
                        }
                      >
                        Edit Group
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={deleteGroupMutation.isPending}
                        onClick={() => deleteGroupMutation.mutate(grp.id)}
                      >
                        Remove Group
                      </Button>
                    </div>
                  </div>

                  {grp.courses.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No subjects added to this group yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-100 hover:bg-transparent">
                            <TableHead className="w-[120px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                              Code
                            </TableHead>
                            <TableHead className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                              Subject Title
                            </TableHead>
                            <TableHead className="w-[70px] text-center text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                              Units
                            </TableHead>
                            <TableHead className="w-[110px] text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                              Requirement
                            </TableHead>
                            <TableHead className="w-[150px] text-right text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grp.courses.map((course) => (
                            <TableRow
                              key={course.id}
                              className="border-gray-100"
                            >
                              <TableCell className="font-mono text-xs font-semibold text-[#262220]">
                                {course.courseCode}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-[#262220]">
                                  {course.courseTitle}
                                </p>
                                {course.prerequisiteNote ? (
                                  <p className="text-[11px] text-amber-800">
                                    {course.prerequisiteNote}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {course.units}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">
                                {course.isRequired ? "Required" : "Elective"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setCourseDialog({
                                        mode: "edit",
                                        groupId: grp.id,
                                        groupLabel: grp.label,
                                        course,
                                      })
                                    }
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={deleteCourseMutation.isPending}
                                    onClick={() =>
                                      deleteCourseMutation.mutate(course.id)
                                    }
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <VersionFormDialog
        state={versionDialog}
        programs={programs}
        defaultProgramId={
          selectedProgramId !== "ALL"
            ? selectedProgramId
            : (programs[0]?.id ?? "")
        }
        isSaving={saveVersionMutation.isPending}
        onClose={() => setVersionDialog(null)}
        onSubmit={(id, body) => saveVersionMutation.mutate({ id, body })}
      />

      <GroupFormDialog
        state={groupDialog}
        isSaving={saveGroupMutation.isPending}
        onClose={() => setGroupDialog(null)}
        onSubmit={(versionId, groupId, body) =>
          saveGroupMutation.mutate({ versionId, groupId, body })
        }
      />

      <CourseFormDialog
        state={courseDialog}
        isSaving={saveCourseMutation.isPending}
        onClose={() => setCourseDialog(null)}
        onSubmit={(groupId, courseId, body) =>
          saveCourseMutation.mutate({ groupId, courseId, body })
        }
      />
    </div>
  );
}

function VersionFormDialog({
  state,
  programs,
  defaultProgramId,
  isSaving,
  onClose,
  onSubmit,
}: {
  state: {
    mode: "create" | "edit";
    version?: AdminCurriculumVersionDetail;
  } | null;
  programs: Program[];
  defaultProgramId: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (
    id: string | undefined,
    body: {
      programId?: string;
      versionCode: string;
      label: string;
      curriculumType: "NEW" | "OLD";
      effectiveSchoolYear: string | null;
      isDefaultForNewStudents: boolean;
      isActive: boolean;
      notes: string | null;
    },
  ) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === "edit"
              ? "Edit Curriculum Version"
              : "Add Curriculum Version"}
          </DialogTitle>
          <DialogDescription>
            Define a program curriculum version. Setting a version as default
            applies to newly promoted students without modifying existing
            student assignments.
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <VersionFormBody
            key={state.version?.id ?? `new-${defaultProgramId}`}
            mode={state.mode}
            initial={state.version}
            programs={programs}
            defaultProgramId={defaultProgramId}
            isSaving={isSaving}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function VersionFormBody({
  mode,
  initial,
  programs,
  defaultProgramId,
  isSaving,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: AdminCurriculumVersionDetail;
  programs: Program[];
  defaultProgramId: string;
  isSaving: boolean;
  onSubmit: (
    id: string | undefined,
    body: {
      programId?: string;
      versionCode: string;
      label: string;
      curriculumType: "NEW" | "OLD";
      effectiveSchoolYear: string | null;
      isDefaultForNewStudents: boolean;
      isActive: boolean;
      notes: string | null;
    },
  ) => void;
}) {
  const [programId, setProgramId] = useState(
    initial?.programId ?? defaultProgramId,
  );
  const [versionCode, setVersionCode] = useState(
    initial?.versionCode ?? "NEW-2025",
  );
  const [label, setLabel] = useState(
    initial?.label ?? "New Curriculum (S.Y. 2025-2026)",
  );
  const [curriculumType, setCurriculumType] = useState<"NEW" | "OLD">(
    initial?.curriculumType ?? "NEW",
  );
  const [effectiveSchoolYear, setEffectiveSchoolYear] = useState(
    initial?.effectiveSchoolYear ?? "",
  );
  const [isDefault, setIsDefault] = useState(
    initial?.isDefaultForNewStudents ?? false,
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const programLabel =
    programs.find((p) => p.id === programId)?.programName ?? "Select program";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(initial?.id, {
          ...(mode === "create" ? { programId } : {}),
          versionCode: versionCode.trim(),
          label: label.trim(),
          curriculumType,
          effectiveSchoolYear: effectiveSchoolYear.trim() || null,
          isDefaultForNewStudents: isDefault,
          isActive,
          notes: notes.trim() || null,
        });
      }}
    >
      {mode === "create" ? (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold tracking-wider text-gray-600 uppercase">
            Graduate Program *
          </Label>
          <Select
            value={programId}
            onValueChange={(val) => setProgramId(val ?? "")}
          >
            <SelectTrigger className="w-full data-[size=default]:h-10">
              <span className="flex-1 truncate text-left text-[#262220]">
                {programLabel}
              </span>
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-(--anchor-width)"
            >
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.programName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label
            htmlFor="ver-code"
            className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Version Code *
          </Label>
          <Input
            id="ver-code"
            required
            maxLength={64}
            value={versionCode}
            onChange={(e) => setVersionCode(e.target.value)}
            placeholder="e.g. NEW-2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold tracking-wider text-gray-600 uppercase">
            Track *
          </Label>
          <Select
            value={curriculumType}
            onValueChange={(val) =>
              setCurriculumType(val === "OLD" ? "OLD" : "NEW")
            }
          >
            <SelectTrigger className="w-full data-[size=default]:h-10">
              <span className="flex-1 truncate text-left text-[#262220]">
                {curriculumType === "OLD"
                  ? "Old Curriculum"
                  : "New Curriculum"}
              </span>
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-(--anchor-width)"
            >
              <SelectItem value="NEW">New Curriculum</SelectItem>
              <SelectItem value="OLD">Old Curriculum</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label
            htmlFor="ver-label"
            className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Display Label *
          </Label>
          <Input
            id="ver-label"
            required
            maxLength={191}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="ver-sy"
            className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Effective School Year
          </Label>
          <Input
            id="ver-sy"
            maxLength={64}
            value={effectiveSchoolYear}
            onChange={(e) => setEffectiveSchoolYear(e.target.value)}
            placeholder="e.g. 2024-2025"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="ver-notes"
          className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Notes (optional)
        </Label>
        <Textarea
          id="ver-notes"
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
          <span className="text-xs font-medium text-[#262220]">
            Default for New Students
          </span>
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
          <span className="text-xs font-medium text-[#262220]">Active</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
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
          {isSaving ? "Saving..." : "Save Version"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function GroupFormDialog({
  state,
  isSaving,
  onClose,
  onSubmit,
}: {
  state: {
    mode: "create" | "edit";
    versionId: string;
    group?: AdminCurriculumGroupItem;
  } | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (
    versionId: string,
    groupId: string | undefined,
    body: {
      groupType: CurriculumGroupType;
      label: string;
      requiredUnits: number;
      countsTowardWce: boolean;
      selectionNote: string | null;
      displayOrder: number;
    },
  ) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === "edit" ? "Edit Course Group" : "Add Course Group"}
          </DialogTitle>
          <DialogDescription>
            Configure unit requirements and WCE inclusion for this group.
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <GroupFormBody
            key={state.group?.id ?? `new-grp-${state.versionId}`}
            versionId={state.versionId}
            initial={state.group}
            isSaving={isSaving}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GroupFormBody({
  versionId,
  initial,
  isSaving,
  onSubmit,
}: {
  versionId: string;
  initial?: AdminCurriculumGroupItem;
  isSaving: boolean;
  onSubmit: (
    versionId: string,
    groupId: string | undefined,
    body: {
      groupType: CurriculumGroupType;
      label: string;
      requiredUnits: number;
      countsTowardWce: boolean;
      selectionNote: string | null;
      displayOrder: number;
    },
  ) => void;
}) {
  const [groupType, setGroupType] = useState<CurriculumGroupType>(
    initial?.groupType ?? "MAJOR",
  );
  const [label, setLabel] = useState(initial?.label ?? "");
  const [requiredUnits, setRequiredUnits] = useState(
    String(initial?.requiredUnits ?? 6),
  );
  const [countsTowardWce, setCountsTowardWce] = useState(
    initial?.countsTowardWce ?? true,
  );
  const [selectionNote, setSelectionNote] = useState(
    initial?.selectionNote ?? "",
  );
  const [displayOrder, setDisplayOrder] = useState(
    String(initial?.displayOrder ?? 1),
  );

  const selectedTypeLabel =
    CURRICULUM_GROUP_TYPE_OPTIONS.find((opt) => opt.value === groupType)
      ?.label ?? groupType;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(versionId, initial?.id, {
          groupType,
          label: label.trim(),
          requiredUnits: Number(requiredUnits) || 0,
          countsTowardWce,
          selectionNote: selectionNote.trim() || null,
          displayOrder: Number(displayOrder) || 0,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold tracking-wider text-gray-600 uppercase">
          Group Type *
        </Label>
        <Select
          value={groupType}
          onValueChange={(val) => {
            const next = val as CurriculumGroupType;
            setGroupType(next);
            if (!initial) {
              setCountsTowardWce(
                next !== "THESIS" && next !== "DISSERTATION",
              );
            }
          }}
        >
          <SelectTrigger className="w-full data-[size=default]:h-10">
            <span className="flex-1 truncate text-left text-[#262220]">
              {selectedTypeLabel}
            </span>
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            className="w-(--anchor-width)"
          >
            {CURRICULUM_GROUP_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="grp-label"
          className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Display Label *
        </Label>
        <Input
          id="grp-label"
          required
          maxLength={191}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Major Courses"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label
            htmlFor="grp-units"
            className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Required Units *
          </Label>
          <Input
            id="grp-units"
            type="number"
            min={0}
            max={120}
            required
            value={requiredUnits}
            onChange={(e) => setRequiredUnits(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="grp-order"
            className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Order
          </Label>
          <Input
            id="grp-order"
            type="number"
            min={0}
            max={500}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="grp-note"
          className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Selection / Elective Rule Note (optional)
        </Label>
        <Input
          id="grp-note"
          maxLength={191}
          value={selectionNote}
          onChange={(e) => setSelectionNote(e.target.value)}
          placeholder="e.g. Choose only 1 course (3 units)"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
        <span className="text-xs font-medium text-[#262220]">
          Include in WCE Academic Coursework Summary
        </span>
        <Switch
          checked={countsTowardWce}
          onCheckedChange={setCountsTowardWce}
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
          {isSaving ? "Saving..." : "Save Group"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CourseFormDialog({
  state,
  isSaving,
  onClose,
  onSubmit,
}: {
  state: {
    mode: "create" | "edit";
    groupId: string;
    groupLabel: string;
    course?: AdminCurriculumCourseItem;
  } | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (
    groupId: string,
    courseId: string | undefined,
    body: {
      courseCode: string;
      courseTitle: string;
      units: number;
      isRequired: boolean;
      prerequisiteNote: string | null;
      displayOrder: number;
    },
  ) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state?.mode === "edit" ? "Edit Subject" : "Add Subject"}
          </DialogTitle>
          <DialogDescription>
            {state ? `Group: ${state.groupLabel}` : ""}
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <CourseFormBody
            key={state.course?.id ?? `new-course-${state.groupId}`}
            groupId={state.groupId}
            initial={state.course}
            isSaving={isSaving}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CourseFormBody({
  groupId,
  initial,
  isSaving,
  onSubmit,
}: {
  groupId: string;
  initial?: AdminCurriculumCourseItem;
  isSaving: boolean;
  onSubmit: (
    groupId: string,
    courseId: string | undefined,
    body: {
      courseCode: string;
      courseTitle: string;
      units: number;
      isRequired: boolean;
      prerequisiteNote: string | null;
      displayOrder: number;
    },
  ) => void;
}) {
  const [courseCode, setCourseCode] = useState(initial?.courseCode ?? "");
  const [courseTitle, setCourseTitle] = useState(initial?.courseTitle ?? "");
  const [units, setUnits] = useState(String(initial?.units ?? 3));
  const [isRequired, setIsRequired] = useState(initial?.isRequired ?? true);
  const [prerequisiteNote, setPrerequisiteNote] = useState(
    initial?.prerequisiteNote ?? "",
  );
  const [displayOrder, setDisplayOrder] = useState(
    String(initial?.displayOrder ?? 1),
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(groupId, initial?.id, {
          courseCode: courseCode.trim().toUpperCase(),
          courseTitle: courseTitle.trim(),
          units: Number(units) || 3,
          isRequired,
          prerequisiteNote: prerequisiteNote.trim() || null,
          displayOrder: Number(displayOrder) || 0,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="course-code"
            className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Code *
          </Label>
          <Input
            id="course-code"
            required
            maxLength={32}
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            placeholder="e.g. MF601"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="course-units"
            className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Units *
          </Label>
          <Input
            id="course-units"
            type="number"
            min={1}
            max={30}
            required
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="course-order"
            className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
          >
            Order
          </Label>
          <Input
            id="course-order"
            type="number"
            min={0}
            max={500}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="course-title"
          className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Subject Title *
        </Label>
        <Input
          id="course-title"
          required
          maxLength={191}
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          placeholder="e.g. Methodology of Research"
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="course-prereq"
          className="text-xs font-semibold tracking-wider text-gray-600 uppercase"
        >
          Prerequisite / Note (optional)
        </Label>
        <Input
          id="course-prereq"
          maxLength={191}
          value={prerequisiteNote}
          onChange={(e) => setPrerequisiteNote(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
        <span className="text-xs font-medium text-[#262220]">
          Mandatory Subject (uncheck for Elective Pool option)
        </span>
        <Switch checked={isRequired} onCheckedChange={setIsRequired} />
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
