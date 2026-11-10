"use client";

import { useState } from "react";
import { PanelistResponse } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  TableCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Power,
  X,
  Loader2,
  UserX,
  Info,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";

const TITLE_OPTIONS = ["Dr.", "Prof.", "Mr.", "Ms.", "Mrs.", "Engr.", "Atty.", ""];
const SUFFIX_OPTIONS = ["Jr.", "Sr.", "II", "III", "IV", ""];
const QUALIFICATION_OPTIONS = [
  "Doctorate Degree",
  "Master's Degree",
  "Bachelor's Degree",
];
const AFFILIATION_OPTIONS = [
  "College of Education",
  "College of Business Administration",
  "College of Arts and Sciences",
  "College of Engineering",
  "College of Computer and Information Sciences",
  "College of Public Administration",
  "External/Other",
];
const SPECIALIZATION_OPTIONS = [
  "Education Management",
  "Business Administration",
  "Information Technology",
  "Computer Science",
  "Engineering",
  "Arts and Sciences",
  "Guidance and Counseling",
  "Public Administration",
  "Other",
];

const selectClass =
  "w-full rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none";

interface FacultyFormData {
  title: string;
  firstName: string;
  lastName: string;
  suffix: string;
  email: string;
  qualification: string;
  affiliation: string;
  specialization: string;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
  canEvaluateEssays: boolean;
}

interface FacultyEditData extends FacultyFormData {
  isActive: boolean;
  newPassword: string;
}

const emptyCreateForm: FacultyFormData = {
  title: "",
  firstName: "",
  lastName: "",
  suffix: "",
  email: "",
  qualification: "",
  affiliation: "",
  specialization: "",
  isExternal: false,
  isAvailableAsAdviser: true,
  canEvaluateEssays: false,
};

type FacultyRow = {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  suffix: string;
  email: string;
  qualification: string;
  affiliation: string;
  specialization: string;
  isExternal: boolean;
  isActive: boolean;
  isAvailableAsAdviser: boolean;
  canEvaluateEssays: boolean;
  adviserAssignmentsCount: number;
  panelAssignmentsCount: number;
  createdAt: string;
  userCreatedAt: string;
  userUpdatedAt: string;
  createdByName?: string;
  updatedByName?: string;
};

function formatDisplayName(p: FacultyRow) {
  const parts = [p.title, p.firstName, p.lastName, p.suffix].filter(Boolean);
  return parts.join(" ") || p.firstName + " " + p.lastName;
}

function mapFaculty(p: PanelistResponse): FacultyRow {
  return {
    id: p.id,
    title: p.user.title || "",
    firstName: p.user.firstName,
    lastName: p.user.lastName,
    suffix: p.user.suffix || "",
    email: p.user.email,
    qualification: p.highestEducationalAttainment || "N/A",
    affiliation: p.officeAffiliation || "N/A",
    specialization: p.specialization || "N/A",
    isExternal: p.isExternal,
    isActive: p.user.isActive,
    isAvailableAsAdviser: p.isAvailableAsAdviser,
    canEvaluateEssays: p.canEvaluateEssays ?? false,
    adviserAssignmentsCount: p.user?._count?.adviserAssignments ?? 0,
    panelAssignmentsCount: p.user?._count?.panelAssignments ?? 0,
    createdAt: p.createdAt,
    userCreatedAt: p.user.createdAt,
    userUpdatedAt: p.user.updatedAt || p.user.createdAt,
    createdByName: p.user?.createdBy
      ? `${p.user.createdBy.firstName} ${p.user.createdBy.lastName}`
      : undefined,
    updatedByName: p.user?.updatedBy
      ? `${p.user.updatedBy.firstName} ${p.user.updatedBy.lastName}`
      : undefined,
  };
}

export default function AdminFacultyPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyRow | null>(
    null,
  );

  const [createForm, setCreateForm] = useState<FacultyFormData>({
    ...emptyCreateForm,
  });
  const [editForm, setEditForm] = useState<FacultyEditData>({
    ...emptyCreateForm,
    isAvailableAsAdviser: false,
    canEvaluateEssays: false,
    isActive: true,
    newPassword: "",
  });

  const queryClient = useQueryClient();

  const { data: facultyList = [], isLoading } = useQuery({
    queryKey: ["adminPanelists"],
    queryFn: async () => {
      const res = await apiClientRequest("/admin/panelists");
      return (Array.isArray(res) ? res : []).map(mapFaculty);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FacultyFormData) => {
      return apiClientRequest("/admin/panelists", {
        method: "POST",
        body: JSON.stringify({
          title: data.title || undefined,
          firstName: data.firstName,
          lastName: data.lastName,
          suffix: data.suffix || undefined,
          email: data.email,
          officeAffiliation: data.affiliation,
          highestEducationalAttainment: data.qualification,
          specialization: data.specialization,
          isExternal: data.isExternal,
          isAvailableAsAdviser: data.isExternal
            ? false
            : data.isAvailableAsAdviser,
          canEvaluateEssays: data.canEvaluateEssays,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPanelists"] });
      setShowCreateModal(false);
      setCreateForm({ ...emptyCreateForm });
      toast.success("Faculty account created successfully!", {
        description:
          "Default password is the faculty member's LAST NAME in all caps.",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create faculty account.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClientRequest(`/admin/panelists/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPanelists"] });
      toast.success("Account status updated.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update status.");
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FacultyEditData }) => {
      const payload: Record<string, unknown> = {
        title: data.title || null,
        firstName: data.firstName,
        lastName: data.lastName,
        suffix: data.suffix || null,
        email: data.email,
        officeAffiliation: data.affiliation,
        highestEducationalAttainment: data.qualification,
        specialization: data.specialization,
        isExternal: data.isExternal,
        isAvailableAsAdviser: data.isExternal
          ? false
          : data.isAvailableAsAdviser,
        canEvaluateEssays: data.canEvaluateEssays,
        isActive: data.isActive,
      };
      if (data.newPassword.trim()) {
        payload.password = data.newPassword.trim();
      }
      return apiClientRequest(`/admin/panelists/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPanelists"] });
      queryClient.invalidateQueries({ queryKey: ["panelistProfile"] });
      setShowEditModal(false);
      setSelectedFaculty(null);
      toast.success("Faculty account updated successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update faculty account.");
    },
  });

  const filteredFaculty = facultyList.filter((p) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      formatDisplayName(p).toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower) ||
      p.specialization.toLowerCase().includes(searchLower) ||
      p.affiliation.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (typeFilter === "internal") return !p.isExternal;
    if (typeFilter === "external") return p.isExternal;
    if (typeFilter === "evaluator") return p.canEvaluateEssays;
    if (typeFilter === "adviser")
      return !p.isExternal && p.isAvailableAsAdviser;
    if (typeFilter === "active") return p.isActive;
    if (typeFilter === "inactive") return !p.isActive;
    return true;
  });

  const totalPages = Math.ceil(filteredFaculty.length / pageSize);
  const paginatedFaculty = filteredFaculty.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const activeCount = facultyList.filter((p) => p.isActive).length;
  const internalCount = facultyList.filter((p) => !p.isExternal).length;
  const externalCount = facultyList.filter((p) => p.isExternal).length;
  const evaluatorCount = facultyList.filter((p) => p.canEvaluateEssays).length;
  const adviserCount = facultyList.filter(
    (p) => !p.isExternal && p.isAvailableAsAdviser,
  ).length;

  function openViewModal(faculty: FacultyRow) {
    setSelectedFaculty(faculty);
    setShowViewModal(true);
  }

  function openEditModal(faculty: FacultyRow) {
    setSelectedFaculty(faculty);
    setEditForm({
      title: faculty.title,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
      suffix: faculty.suffix,
      email: faculty.email,
      qualification: faculty.qualification,
      affiliation: faculty.affiliation,
      specialization: faculty.specialization,
      isExternal: faculty.isExternal,
      isAvailableAsAdviser: faculty.isAvailableAsAdviser,
      canEvaluateEssays: faculty.canEvaluateEssays,
      isActive: faculty.isActive,
      newPassword: "",
    });
    setShowEditModal(true);
  }

  const labelClass = "mb-1 block text-xs font-medium text-(--earist-secondary)";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Management"
        description="Manage internal and external faculty accounts, essay evaluation access, and adviser eligibility."
        actions={
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Faculty
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Active</p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {activeCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Internal</p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {internalCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">External</p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {externalCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Essay Evaluators
            </p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {evaluatorCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Available as Adviser
            </p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {adviserCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, specialization, or affiliation..."
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Faculty</option>
                <option value="internal">Internal Faculty</option>
                <option value="external">External Faculty</option>
                <option value="evaluator">Essay Evaluators</option>
                <option value="adviser">Available as Adviser</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Faculty Table */}
      <TableCard>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-(--earist-primary)" />
            <span className="ml-2 text-sm text-(--earist-body-text)">
              Loading faculty accounts...
            </span>
          </div>
        ) : paginatedFaculty.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserX className="mb-4 h-12 w-12 text-gray-300" />
            <p className="text-sm text-(--earist-body-text)">
              No faculty accounts found
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name & Email</TableHead>
                <TableHead>Qualification & Affiliation</TableHead>
                <TableHead className="text-center">Classification</TableHead>
                <TableHead className="text-center">Essay Evaluation</TableHead>
                <TableHead className="text-center">Adviser</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedFaculty.map((faculty) => (
                <TableRow key={faculty.id}>
                  <TableCell>
                    <p className="font-medium text-(--earist-primary)">
                      {formatDisplayName(faculty)}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {faculty.email}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs text-(--earist-body-text)">
                    <p className="font-medium text-foreground">
                      {faculty.qualification}
                    </p>
                    <p>{faculty.affiliation}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        faculty.isExternal
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }
                    >
                      {faculty.isExternal ? "External" : "Internal"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        faculty.canEvaluateEssays
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }
                    >
                      {faculty.canEvaluateEssays ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {faculty.isExternal ? (
                      <Badge className="bg-gray-100 text-gray-400">N/A</Badge>
                    ) : (
                      <Badge
                        className={
                          faculty.isAvailableAsAdviser
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }
                      >
                        {faculty.isAvailableAsAdviser ? "Yes" : "No"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        faculty.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }
                    >
                      {faculty.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openViewModal(faculty)}
                        className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(faculty)}
                        className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                        title="Edit Faculty"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: faculty.id,
                            isActive: !faculty.isActive,
                          })
                        }
                        disabled={updateMutation.isPending}
                        className={`rounded p-1.5 transition-colors ${
                          faculty.isActive
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-600 hover:bg-green-50"
                        } ${updateMutation.isPending ? "cursor-not-allowed opacity-50" : ""}`}
                        title={faculty.isActive ? "Deactivate" : "Activate"}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-(--earist-border-gray) px-4 py-3">
            <p className="text-xs text-(--earist-body-text)">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredFaculty.length)} of{" "}
              {filteredFaculty.length} faculty members
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={
                      page === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setPage(pageNum)}
                        isActive={pageNum === page}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    className={
                      page === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </TableCard>

      {/* ======================== */}
      {/* CREATE FACULTY MODAL     */}
      {/* ======================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Add New Faculty
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Default Password Info Banner */}
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Default Password</p>
                <p>
                  The faculty member&apos;s default password is their{" "}
                  <strong>LAST NAME in ALL CAPS</strong> (e.g.,
                  &quot;Marcial&quot; →{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                    MARCIAL
                  </code>
                  ). They will be required to change this password upon first
                  login.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Title + First Name + Suffix */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className={labelClass}>Title</Label>
                  <select
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, title: e.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="">None</option>
                    {TITLE_OPTIONS.filter(Boolean).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>First Name *</Label>
                  <Input
                    type="text"
                    value={createForm.firstName}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        firstName: e.target.value,
                      })
                    }
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <Label className={labelClass}>Suffix</Label>
                  <select
                    value={createForm.suffix}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, suffix: e.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="">None</option>
                    {SUFFIX_OPTIONS.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Last Name */}
              <div>
                <Label className={labelClass}>Last Name *</Label>
                <Input
                  type="text"
                  value={createForm.lastName}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, lastName: e.target.value })
                  }
                  placeholder="Last Name"
                />
              </div>

              {/* Email */}
              <div>
                <Label className={labelClass}>Email *</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="faculty@earist.edu.ph"
                />
              </div>

              {/* Qualification */}
              <div>
                <Label className={labelClass}>Qualification</Label>
                <select
                  value={createForm.qualification}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      qualification: e.target.value,
                    })
                  }
                  className={selectClass}
                >
                  <option value="">Select qualification</option>
                  {QUALIFICATION_OPTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              {/* Affiliation */}
              <div>
                <Label className={labelClass}>Affiliation</Label>
                <select
                  value={createForm.affiliation}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      affiliation: e.target.value,
                    })
                  }
                  className={selectClass}
                >
                  <option value="">Select affiliation</option>
                  {AFFILIATION_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specialization */}
              <div>
                <Label className={labelClass}>Specialization</Label>
                <select
                  value={createForm.specialization}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      specialization: e.target.value,
                    })
                  }
                  className={selectClass}
                >
                  <option value="">Select specialization</option>
                  {SPECIALIZATION_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Is External */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="create-isExternal"
                  checked={createForm.isExternal}
                  onChange={(e) => {
                    const isExternal = e.target.checked;
                    setCreateForm({
                      ...createForm,
                      isExternal,
                      isAvailableAsAdviser: isExternal
                        ? false
                        : createForm.isAvailableAsAdviser,
                    });
                  }}
                  className="h-4 w-4 rounded border-(--earist-border-gray) text-(--earist-primary) focus:ring-(--earist-primary)"
                />
                <Label
                  htmlFor="create-isExternal"
                  className="text-sm text-(--earist-body-text)"
                >
                  External Faculty (non-EARIST panel member)
                </Label>
              </div>

              <div className="space-y-3 border-t border-(--earist-border-gray) pt-3">
                {/* Essay Evaluation Access */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-(--earist-body-text)">
                        Essay Evaluation Access (Program Chair / Evaluator)
                      </Label>
                      <p className="text-xs text-gray-500">
                        Allows this faculty member to grade applicant entrance
                        exam essays.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={createForm.canEvaluateEssays}
                        onCheckedChange={(checked) =>
                          setCreateForm({
                            ...createForm,
                            canEvaluateEssays: checked,
                          })
                        }
                      />
                      <span className="text-xs text-(--earist-body-text)">
                        {createForm.canEvaluateEssays ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Available as Adviser */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm text-(--earist-body-text)">
                        Available as Adviser
                      </Label>
                      <p className="text-xs text-gray-500">
                        Only Internal Faculty can serve as thesis/dissertation
                        advisers.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={createForm.isAvailableAsAdviser}
                        disabled={createForm.isExternal}
                        onCheckedChange={(checked) =>
                          setCreateForm({
                            ...createForm,
                            isAvailableAsAdviser: checked,
                          })
                        }
                      />
                      <span className="text-xs text-(--earist-body-text)">
                        {createForm.isAvailableAsAdviser ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                  {createForm.isExternal && (
                    <p className="mt-1 text-xs text-amber-700">
                      External faculty cannot serve as thesis/dissertation
                      advisers.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  createMutation.isPending ||
                  !createForm.firstName.trim() ||
                  !createForm.lastName.trim() ||
                  !createForm.email.trim()
                }
                onClick={() => createMutation.mutate(createForm)}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Faculty
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== */}
      {/* EDIT FACULTY MODAL       */}
      {/* ======================== */}
      {showEditModal && selectedFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Edit Faculty
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedFaculty(null);
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Title + First Name + Suffix */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className={labelClass}>Title</Label>
                  <select
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="">None</option>
                    {TITLE_OPTIONS.filter(Boolean).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>First Name *</Label>
                  <Input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, firstName: e.target.value })
                    }
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <Label className={labelClass}>Suffix</Label>
                  <select
                    value={editForm.suffix}
                    onChange={(e) =>
                      setEditForm({ ...editForm, suffix: e.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="">None</option>
                    {SUFFIX_OPTIONS.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Last Name */}
              <div>
                <Label className={labelClass}>Last Name *</Label>
                <Input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lastName: e.target.value })
                  }
                  placeholder="Last Name"
                />
              </div>

              {/* Email */}
              <div>
                <Label className={labelClass}>Email *</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  placeholder="faculty@earist.edu.ph"
                />
              </div>

              {/* Qualification */}
              <div>
                <Label className={labelClass}>Qualification</Label>
                <select
                  value={editForm.qualification}
                  onChange={(e) =>
                    setEditForm({ ...editForm, qualification: e.target.value })
                  }
                  className={selectClass}
                >
                  <option value="">Select qualification</option>
                  {QUALIFICATION_OPTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              {/* Affiliation */}
              <div>
                <Label className={labelClass}>Affiliation</Label>
                <select
                  value={editForm.affiliation}
                  onChange={(e) =>
                    setEditForm({ ...editForm, affiliation: e.target.value })
                  }
                  className={selectClass}
                >
                  <option value="">Select affiliation</option>
                  {AFFILIATION_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specialization */}
              <div>
                <Label className={labelClass}>Specialization</Label>
                <select
                  value={editForm.specialization}
                  onChange={(e) =>
                    setEditForm({ ...editForm, specialization: e.target.value })
                  }
                  className={selectClass}
                >
                  <option value="">Select specialization</option>
                  {SPECIALIZATION_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Is External */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-isExternal"
                  checked={editForm.isExternal}
                  onChange={(e) => {
                    const isExternal = e.target.checked;
                    setEditForm({
                      ...editForm,
                      isExternal,
                      isAvailableAsAdviser: isExternal
                        ? false
                        : editForm.isAvailableAsAdviser,
                    });
                  }}
                  className="h-4 w-4 rounded border-(--earist-border-gray) text-(--earist-primary) focus:ring-(--earist-primary)"
                />
                <Label
                  htmlFor="edit-isExternal"
                  className="text-sm text-(--earist-body-text)"
                >
                  External Faculty (non-EARIST panel member)
                </Label>
              </div>

              <div className="space-y-3 border-t border-(--earist-border-gray) pt-3">
                {/* Essay Evaluation Access */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-(--earist-body-text)">
                      Essay Evaluation Access
                    </Label>
                    <p className="text-xs text-gray-500">
                      Allows grading applicant entrance exam essays.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editForm.canEvaluateEssays}
                      onCheckedChange={(checked) =>
                        setEditForm({
                          ...editForm,
                          canEvaluateEssays: checked,
                        })
                      }
                    />
                    <span className="text-xs text-(--earist-body-text)">
                      {editForm.canEvaluateEssays ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {/* Available as Adviser */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-(--earist-body-text)">
                      Available as Adviser
                    </Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editForm.isAvailableAsAdviser}
                        disabled={editForm.isExternal}
                        onCheckedChange={(checked) =>
                          setEditForm({
                            ...editForm,
                            isAvailableAsAdviser: checked,
                          })
                        }
                      />
                      <span className="text-xs text-(--earist-body-text)">
                        {editForm.isAvailableAsAdviser ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                  {editForm.isExternal && (
                    <p className="mt-1 text-xs text-amber-700">
                      External faculty cannot serve as thesis/dissertation
                      advisers.
                    </p>
                  )}
                </div>

                {/* Account Status */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-(--earist-body-text)">
                    Account Status
                  </Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editForm.isActive}
                      onCheckedChange={(checked) =>
                        setEditForm({ ...editForm, isActive: checked })
                      }
                    />
                    <span className="text-xs text-(--earist-body-text)">
                      {editForm.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <Label className={labelClass}>
                    New Password (leave blank to keep current)
                  </Label>
                  <Input
                    type="password"
                    value={editForm.newPassword}
                    onChange={(e) =>
                      setEditForm({ ...editForm, newPassword: e.target.value })
                    }
                    placeholder="Enter new password"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedFaculty(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  editMutation.isPending ||
                  !editForm.firstName.trim() ||
                  !editForm.lastName.trim() ||
                  !editForm.email.trim()
                }
                onClick={() =>
                  editMutation.mutate({
                    id: selectedFaculty.id,
                    data: editForm,
                  })
                }
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                {editMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== */}
      {/* VIEW FACULTY MODAL       */}
      {/* ======================== */}
      {showViewModal && selectedFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Faculty Details
              </h3>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedFaculty(null);
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name & Email */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-(--earist-body-text)">Name</p>
                  <p className="font-semibold text-(--earist-primary)">
                    {formatDisplayName(selectedFaculty)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">Email</p>
                  <p className="text-sm text-(--earist-body-text)">
                    {selectedFaculty.email}
                  </p>
                </div>
              </div>

              {/* Qualification, Affiliation, Specialization */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-(--earist-body-text)">
                    Qualification
                  </p>
                  <p className="text-sm text-(--earist-body-text)">
                    {selectedFaculty.qualification}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">
                    Affiliation
                  </p>
                  <p className="text-sm text-(--earist-body-text)">
                    {selectedFaculty.affiliation}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">
                    Specialization
                  </p>
                  <p className="text-sm text-(--earist-body-text)">
                    {selectedFaculty.specialization}
                  </p>
                </div>
              </div>

              {/* Classification, Essay Evaluation, Adviser, Status */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 sm:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs text-(--earist-body-text)">
                    Classification
                  </p>
                  <Badge
                    className={
                      selectedFaculty.isExternal
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }
                  >
                    {selectedFaculty.isExternal ? "External" : "Internal"}
                  </Badge>
                </div>
                <div>
                  <p className="mb-1 text-xs text-(--earist-body-text)">
                    Essay Eval
                  </p>
                  <Badge
                    className={
                      selectedFaculty.canEvaluateEssays
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }
                  >
                    {selectedFaculty.canEvaluateEssays ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="mb-1 text-xs text-(--earist-body-text)">
                    Adviser
                  </p>
                  {selectedFaculty.isExternal ? (
                    <Badge className="bg-gray-100 text-gray-400">N/A</Badge>
                  ) : (
                    <Badge
                      className={
                        selectedFaculty.isAvailableAsAdviser
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }
                    >
                      {selectedFaculty.isAvailableAsAdviser ? "Yes" : "No"}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs text-(--earist-body-text)">
                    Status
                  </p>
                  <Badge
                    className={
                      selectedFaculty.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }
                  >
                    {selectedFaculty.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Assignment Summary */}
              <div className="border-t border-(--earist-border-gray) pt-3">
                <p className="mb-2 text-xs font-semibold tracking-wide text-(--earist-primary) uppercase">
                  Academic Assignment Summary
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-(--earist-border-gray) p-3">
                    <p className="text-xs text-(--earist-body-text)">
                      Active Advisees
                    </p>
                    <p className="text-lg font-bold text-(--earist-primary)">
                      {selectedFaculty.isExternal
                        ? "N/A"
                        : selectedFaculty.adviserAssignmentsCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-(--earist-border-gray) p-3">
                    <p className="text-xs text-(--earist-body-text)">
                      Defense Committee Assignments
                    </p>
                    <p className="text-lg font-bold text-(--earist-primary)">
                      {selectedFaculty.panelAssignmentsCount}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account History */}
              <div className="border-t border-(--earist-border-gray) pt-4">
                <p className="mb-3 text-xs font-semibold tracking-wide text-(--earist-primary) uppercase">
                  Account History
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-(--earist-body-text)">
                      Created At
                    </span>
                    <span className="text-sm text-gray-900">
                      {new Date(
                        selectedFaculty.userCreatedAt ||
                          selectedFaculty.createdAt,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {selectedFaculty.createdByName && (
                    <div className="flex justify-between">
                      <span className="text-xs text-(--earist-body-text)">
                        Created By
                      </span>
                      <span className="text-sm text-gray-900">
                        {selectedFaculty.createdByName}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs text-(--earist-body-text)">
                      Last Updated
                    </span>
                    <span className="text-sm text-gray-900">
                      {new Date(
                        selectedFaculty.userUpdatedAt ||
                          selectedFaculty.createdAt,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {selectedFaculty.updatedByName && (
                    <div className="flex justify-between">
                      <span className="text-xs text-(--earist-body-text)">
                        Updated By
                      </span>
                      <span className="text-sm text-gray-900">
                        {selectedFaculty.updatedByName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedFaculty(null);
                }}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowViewModal(false);
                  openEditModal(selectedFaculty);
                }}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Edit className="mr-1 h-4 w-4" />
                Edit Faculty
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
