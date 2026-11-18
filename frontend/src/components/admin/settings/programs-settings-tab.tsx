"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Program } from "@/types";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  CheckCircle2,
  Edit3,
  GraduationCap,
  Plus,
  Power,
  Search,
} from "lucide-react";

type ProgramLevelFilter = "ALL" | "DOCTORAL" | "MASTERS";
type ProgramStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

interface ProgramFormState {
  programType: "MASTERS" | "DOCTORAL";
  degreeName: string;
  majorName: string;
  programCode: string;
  maxResidencyYears: string;
  isActive: boolean;
}

function defaultResidencyForType(type: "MASTERS" | "DOCTORAL"): number {
  return type === "DOCTORAL" ? 6 : 4;
}

function buildDisplayPreview(
  degreeName: string,
  majorName: string,
  programCode: string,
): string {
  const degree = degreeName.trim();
  const major = majorName.trim();
  const code = programCode.trim();
  if (!degree) return "Enter a degree title to preview display name";
  const base = major ? `${degree} major in ${major}` : degree;
  return code ? `${base} (${code})` : base;
}

function createInitialFormState(program?: Program | null): ProgramFormState {
  if (!program) {
    return {
      programType: "MASTERS",
      degreeName: "",
      majorName: "",
      programCode: "",
      maxResidencyYears: "4",
      isActive: true,
    };
  }

  const level = program.programType === "DOCTORAL" ? "DOCTORAL" : "MASTERS";
  return {
    programType: level,
    degreeName: program.degreeName ?? program.programName,
    majorName: program.majorName ?? "",
    programCode: program.programCode ?? "",
    maxResidencyYears: String(
      program.maxResidencyYears ?? defaultResidencyForType(level),
    ),
    isActive: program.isActive ?? true,
  };
}

export function ProgramsSettingsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProgramLevelFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<ProgramStatusFilter>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formState, setFormState] = useState<ProgramFormState>(() =>
    createInitialFormState(),
  );

  const { data, isLoading, isError, error } = useQuery<{ programs: Program[] }>({
    queryKey: ["adminPrograms"],
    queryFn: async () => apiClientRequest("/programs/admin"),
  });

  const programs = useMemo(() => data?.programs ?? [], [data]);

  const stats = useMemo(() => {
    const doctoral = programs.filter((p) => p.programType === "DOCTORAL").length;
    const masters = programs.filter((p) => p.programType === "MASTERS").length;
    const active = programs.filter((p) => p.isActive !== false).length;
    return {
      total: programs.length,
      doctoral,
      masters,
      active,
    };
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    const term = search.trim().toLowerCase();
    return programs.filter((program) => {
      if (typeFilter !== "ALL" && program.programType !== typeFilter) {
        return false;
      }
      const active = program.isActive !== false;
      if (statusFilter === "ACTIVE" && !active) return false;
      if (statusFilter === "INACTIVE" && active) return false;
      if (!term) return true;
      return [
        program.programName,
        program.degreeName ?? "",
        program.majorName ?? "",
        program.programCode ?? "",
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [programs, search, typeFilter, statusFilter]);

  const invalidateProgramCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["adminPrograms"] });
    queryClient.invalidateQueries({ queryKey: ["programs"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      body: {
        programType: "MASTERS" | "DOCTORAL";
        degreeName: string;
        majorName: string | null;
        programCode: string | null;
        maxResidencyYears: number;
        isActive: boolean;
      };
    }) => {
      if (payload.id) {
        return apiClientRequest(`/programs/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify(payload.body),
        });
      }
      return apiClientRequest("/programs", {
        method: "POST",
        body: JSON.stringify(payload.body),
      });
    },
    onSuccess: (_result, variables) => {
      invalidateProgramCaches();
      setDialogOpen(false);
      setEditingProgram(null);
      toast.success(
        variables.id
          ? "Graduate program updated."
          : "Graduate program added.",
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save graduate program.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { id: string; isActive: boolean }) =>
      apiClientRequest(`/programs/${payload.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: payload.isActive }),
      }),
    onSuccess: (_result, variables) => {
      invalidateProgramCaches();
      toast.success(
        variables.isActive
          ? "Program activated."
          : "Program deactivated.",
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update program status.");
    },
  });

  const openCreateDialog = () => {
    setEditingProgram(null);
    setFormState(createInitialFormState());
    setDialogOpen(true);
  };

  const openEditDialog = (program: Program) => {
    setEditingProgram(program);
    setFormState(createInitialFormState(program));
    setDialogOpen(true);
  };

  const handleProgramTypeChange = (nextType: "MASTERS" | "DOCTORAL") => {
    setFormState((prev) => {
      const currentDefault = String(defaultResidencyForType(prev.programType));
      const nextDefault = String(defaultResidencyForType(nextType));
      const shouldUpdateDefault =
        !prev.maxResidencyYears.trim() || prev.maxResidencyYears === currentDefault;
      return {
        ...prev,
        programType: nextType,
        maxResidencyYears: shouldUpdateDefault
          ? nextDefault
          : prev.maxResidencyYears,
      };
    });
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const degreeName = formState.degreeName.trim();
    if (!degreeName) {
      toast.error("Degree title is required.");
      return;
    }
    const maxYears = Number(formState.maxResidencyYears);
    if (!Number.isInteger(maxYears) || maxYears < 1 || maxYears > 15) {
      toast.error("Maximum residency must be a whole number between 1 and 15 years.");
      return;
    }

    saveMutation.mutate({
      id: editingProgram?.id,
      body: {
        programType: formState.programType,
        degreeName,
        majorName: formState.majorName.trim() || null,
        programCode: formState.programCode.trim() || null,
        maxResidencyYears: maxYears,
        isActive: formState.isActive,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">Total Offerings</p>
            <p className="mt-1 text-2xl font-bold text-[#333333]">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">Doctoral (PQF 8)</p>
            <p className="mt-1 text-2xl font-bold text-[#333333]">{stats.doctoral}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">Master&apos;s (PQF 7)</p>
            <p className="mt-1 text-2xl font-bold text-[#333333]">{stats.masters}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">Active Offerings</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.active}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-[#333333]">
              <BookOpen className="h-5 w-5 text-[#e02b20]" />
              Graduate School Programs
            </CardTitle>
            <p className="mt-0.5 text-sm text-gray-500">
              Authoritative Graduate School degrees, majors, and Maximum Residence Rule defaults (4 yrs Master&apos;s / 6 yrs Doctoral per Manual §7.11).
            </p>
          </div>
          <Button
            type="button"
            onClick={openCreateDialog}
            className="bg-[#e02b20] text-white hover:bg-[#c62828]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Program
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search degree, major, or code..."
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filter by program level"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ProgramLevelFilter)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#333333]"
            >
              <option value="ALL">All Levels</option>
              <option value="DOCTORAL">Doctoral</option>
              <option value="MASTERS">Master&apos;s</option>
            </select>
            <select
              aria-label="Filter by active status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProgramStatusFilter)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#333333]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Loading Graduate School programs...
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error instanceof Error
                ? error.message
                : "Failed to load Graduate School programs."}
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              No programs match your current filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/70">
                    <TableHead>Degree &amp; Major</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Max Residency</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrograms.map((program) => {
                    const active = program.isActive !== false;
                    const linkedCount =
                      (program._count?.students ?? 0) +
                      (program._count?.examSlots ?? 0) +
                      (program._count?.examApplications ?? 0);
                    const isDoctoral = program.programType === "DOCTORAL";
                    const fallbackYears = isDoctoral ? 6 : 4;

                    return (
                      <TableRow key={program.id}>
                        <TableCell>
                          <div className="font-semibold text-[#333333]">
                            {program.degreeName ?? program.programName}
                          </div>
                          {program.majorName && (
                            <div className="text-xs text-gray-500">
                              Major in {program.majorName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {program.programCode ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {program.programCode}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isDoctoral
                                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                : "border-sky-200 bg-sky-50 text-sky-800"
                            }
                          >
                            {isDoctoral ? "Doctoral · PQF 8" : "Master's · PQF 7"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-[#333333]">
                          {program.maxResidencyYears ?? fallbackYears} years
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {linkedCount > 0 ? (
                            <span>
                              {program._count?.students ?? 0} students ·{" "}
                              {program._count?.examSlots ?? 0} slots
                            </span>
                          ) : (
                            <span className="text-gray-400">No linked records</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-gray-200 bg-gray-100 text-gray-600"
                            }
                          >
                            {active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(program)}
                            >
                              <Edit3 className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={statusMutation.isPending}
                              onClick={() =>
                                statusMutation.mutate({
                                  id: program.id,
                                  isActive: !active,
                                })
                              }
                              className={
                                active
                                  ? "text-amber-700 hover:bg-amber-50"
                                  : "text-emerald-700 hover:bg-emerald-50"
                              }
                            >
                              {active ? (
                                <>
                                  <Power className="mr-1 h-3.5 w-3.5" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  Activate
                                </>
                              )}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-[#e02b20]" />
              {editingProgram ? "Edit Graduate Program" : "Add Graduate Program"}
            </DialogTitle>
            <DialogDescription>
              Manage official Graduate School program metadata used in admissions, residency tracking, and official PDF forms.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="program-type-select">Program Level</Label>
                <select
                  id="program-type-select"
                  value={formState.programType}
                  onChange={(e) =>
                    handleProgramTypeChange(
                      e.target.value === "DOCTORAL" ? "DOCTORAL" : "MASTERS",
                    )
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#333333]"
                >
                  <option value="MASTERS">Master&apos;s Program (Academic)</option>
                  <option value="DOCTORAL">Doctoral Program (Professional)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="program-max-residency">
                  Max Residency (Years)
                </Label>
                <Input
                  id="program-max-residency"
                  type="number"
                  min={1}
                  max={15}
                  value={formState.maxResidencyYears}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      maxResidencyYears: e.target.value,
                    }))
                  }
                  required
                />
                <p className="text-[11px] text-gray-500">
                  Handbook §7.11 default: 4 yrs Master&apos;s, 6 yrs Doctoral.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="program-degree-name">
                Degree Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="program-degree-name"
                type="text"
                maxLength={191}
                value={formState.degreeName}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    degreeName: e.target.value,
                  }))
                }
                placeholder="e.g., Master of Arts in Teaching"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="program-major-name">
                  Major / Specialization (Optional)
                </Label>
                <Input
                  id="program-major-name"
                  type="text"
                  maxLength={191}
                  value={formState.majorName}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      majorName: e.target.value,
                    }))
                  }
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="program-code">
                  Code / Acronym (Optional)
                </Label>
                <Input
                  id="program-code"
                  type="text"
                  maxLength={64}
                  value={formState.programCode}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      programCode: e.target.value,
                    }))
                  }
                  placeholder="e.g., MAT"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-[#333333]">
                  Active Offering
                </p>
                <p className="text-xs text-gray-500">
                  Inactive programs remain preserved for existing students but are hidden from public registration.
                </p>
              </div>
              <Switch
                checked={formState.isActive}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, isActive: Boolean(checked) }))
                }
              />
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-3">
              <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                Display Preview
              </p>
              <p className="mt-1 text-sm font-medium text-[#333333]">
                {buildDisplayPreview(
                  formState.degreeName,
                  formState.majorName,
                  formState.programCode,
                )}
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-[#e02b20] text-white hover:bg-[#c62828]"
              >
                {saveMutation.isPending
                  ? "Saving..."
                  : editingProgram
                    ? "Save Changes"
                    : "Create Program"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
