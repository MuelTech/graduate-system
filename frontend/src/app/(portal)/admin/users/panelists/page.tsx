"use client";

import { useState, useEffect } from "react";
import { PanelistResponse } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
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
  UserCheck,
  UserX,
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

interface PanelistFormData {
  title: string;
  firstName: string;
  lastName: string;
  suffix: string;
  email: string;
  qualification: string;
  affiliation: string;
  specialization: string;
  isExternal: boolean;
}

interface PanelistEditData extends PanelistFormData {
  isAvailableAsAdviser: boolean;
  isActive: boolean;
  newPassword: string;
}

const emptyCreateForm: PanelistFormData = {
  title: "",
  firstName: "",
  lastName: "",
  suffix: "",
  email: "",
  qualification: "",
  affiliation: "",
  specialization: "",
  isExternal: false,
};

type PanelistRow = {
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
  createdAt: string;
  userCreatedAt: string;
  userUpdatedAt: string;
};

function formatDisplayName(p: PanelistRow) {
  const parts = [p.title, p.firstName, p.lastName, p.suffix].filter(Boolean);
  return parts.join(" ") || p.firstName + " " + p.lastName;
}

function mapPanelist(p: PanelistResponse): PanelistRow {
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
    createdAt: p.createdAt,
    userCreatedAt: p.user.createdAt,
    userUpdatedAt: p.user.updatedAt || p.user.createdAt,
  };
}

export default function AdminPanelistsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPanelist, setSelectedPanelist] = useState<PanelistRow | null>(null);

  const [createForm, setCreateForm] = useState<PanelistFormData>({ ...emptyCreateForm });
  const [editForm, setEditForm] = useState<PanelistEditData>({
    ...emptyCreateForm,
    isAvailableAsAdviser: false,
    isActive: true,
    newPassword: "",
  });

  const queryClient = useQueryClient();

  const { data: panelists = [], isLoading } = useQuery({
    queryKey: ["adminPanelists"],
    queryFn: async () => {
      const res = await apiClientRequest("/panelists");
      return (Array.isArray(res) ? res : []).map(mapPanelist);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PanelistFormData) => {
      return apiClientRequest("/panelists", {
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
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPanelists"] });
      setShowCreateModal(false);
      setCreateForm({ ...emptyCreateForm });
      toast.success("Panelist created successfully!", {
        description: "Default password is the panelist's LAST NAME in all caps.",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create panelist.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClientRequest(`/panelists/${id}`, {
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
    mutationFn: async ({ id, data }: { id: string; data: PanelistEditData }) => {
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
        isAvailableAsAdviser: data.isAvailableAsAdviser,
        isActive: data.isActive,
      };
      if (data.newPassword.trim()) {
        payload.password = data.newPassword.trim();
      }
      return apiClientRequest(`/panelists/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPanelists"] });
      setShowEditModal(false);
      setSelectedPanelist(null);
      toast.success("Panelist updated successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update panelist.");
    },
  });

  const filteredPanelists = panelists.filter((p) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      formatDisplayName(p).toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower) ||
      p.specialization.toLowerCase().includes(searchLower) ||
      p.affiliation.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (typeFilter === "internal") return !p.isExternal;
    if (typeFilter === "external") return p.isExternal;
    if (typeFilter === "active") return p.isActive;
    if (typeFilter === "inactive") return !p.isActive;
    return true;
  });

  const totalPages = Math.ceil(filteredPanelists.length / pageSize);
  const paginatedPanelists = filteredPanelists.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter]);

  const activeCount = panelists.filter((p) => p.isActive).length;
  const internalCount = panelists.filter((p) => !p.isExternal).length;
  const externalCount = panelists.filter((p) => p.isExternal).length;
  const adviserCount = panelists.filter((p) => p.isAvailableAsAdviser).length;

  function openViewModal(panelist: PanelistRow) {
    setSelectedPanelist(panelist);
    setShowViewModal(true);
  }

  function openEditModal(panelist: PanelistRow) {
    setSelectedPanelist(panelist);
    setEditForm({
      title: panelist.title,
      firstName: panelist.firstName,
      lastName: panelist.lastName,
      suffix: panelist.suffix,
      email: panelist.email,
      qualification: panelist.qualification,
      affiliation: panelist.affiliation,
      specialization: panelist.specialization,
      isExternal: panelist.isExternal,
      isAvailableAsAdviser: panelist.isAvailableAsAdviser,
      isActive: panelist.isActive,
      newPassword: "",
    });
    setShowEditModal(true);
  }

  const labelClass = "mb-1 block text-xs font-medium text-(--earist-secondary)";

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            Panelist Management
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Manage faculty and external panelist accounts
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Panelist
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Active</p>
            <p className="text-lg font-bold text-(--earist-primary)">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Internal</p>
            <p className="text-lg font-bold text-(--earist-primary)">{internalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">External</p>
            <p className="text-lg font-bold text-(--earist-primary)">{externalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Available as Adviser</p>
            <p className="text-lg font-bold text-(--earist-primary)">{adviserCount}</p>
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, specialization, or affiliation..."
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Panelists</option>
                <option value="internal">Internal (Faculty)</option>
                <option value="external">External</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panelists Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-(--earist-primary)" />
              <span className="ml-2 text-sm text-(--earist-body-text)">
                Loading panelists...
              </span>
            </div>
          ) : paginatedPanelists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserX className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-sm text-(--earist-body-text)">No panelists found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Qualification
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                      Affiliation
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                      Type
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-(--earist-secondary)">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPanelists.map((panelist) => (
                    <tr
                      key={panelist.id}
                      className="border-b border-(--earist-border-gray) last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-(--earist-primary)">
                          {formatDisplayName(panelist)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                        {panelist.email}
                      </td>
                      <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                        {panelist.qualification}
                      </td>
                      <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                        {panelist.affiliation}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={
                            panelist.isExternal
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }
                        >
                          {panelist.isExternal ? "External" : "Internal"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={
                            panelist.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }
                        >
                          {panelist.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openViewModal(panelist)}
                            className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(panelist)}
                            className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: panelist.id,
                                isActive: !panelist.isActive,
                              })
                            }
                            disabled={updateMutation.isPending}
                            className={`rounded p-1.5 transition-colors ${
                              panelist.isActive
                                ? "text-red-600 hover:bg-red-50"
                                : "text-green-600 hover:bg-green-50"
                            } ${updateMutation.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                            title={panelist.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-(--earist-border-gray) px-4 py-3">
              <p className="text-xs text-(--earist-body-text)">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filteredPanelists.length)} of{" "}
                {filteredPanelists.length} panelists
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
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
        </CardContent>
      </Card>

      {/* ======================== */}
      {/* CREATE PANELIST MODAL    */}
      {/* ======================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Add New Panelist
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Title + Suffix */}
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
                      setCreateForm({ ...createForm, firstName: e.target.value })
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
                  placeholder="panelist@example.com"
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
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-isExternal"
                  checked={createForm.isExternal}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      isExternal: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-(--earist-border-gray) text-(--earist-primary) focus:ring-(--earist-primary)"
                />
                <Label
                  htmlFor="create-isExternal"
                  className="text-sm text-(--earist-body-text)"
                >
                  External Panelist
                </Label>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
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
                Add Panelist
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== */}
      {/* EDIT PANELIST MODAL      */}
      {/* ======================== */}
      {showEditModal && selectedPanelist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Edit Panelist
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPanelist(null);
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Title + Suffix */}
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
                  placeholder="panelist@example.com"
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
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-isExternal"
                  checked={editForm.isExternal}
                  onChange={(e) =>
                    setEditForm({ ...editForm, isExternal: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-(--earist-border-gray) text-(--earist-primary) focus:ring-(--earist-primary)"
                />
                <Label
                  htmlFor="edit-isExternal"
                  className="text-sm text-(--earist-body-text)"
                >
                  External Panelist
                </Label>
              </div>

              <div className="border-t border-(--earist-border-gray) pt-3">
                {/* Is Available as Adviser */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-(--earist-body-text)">Available as Adviser</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editForm.isAvailableAsAdviser}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, isAvailableAsAdviser: checked })}
                    />
                    <span className="text-xs text-(--earist-body-text)">
                      {editForm.isAvailableAsAdviser ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                {/* Account Status */}
                <div className="mt-3 flex items-center justify-between">
                  <Label className="text-sm text-(--earist-body-text)">Account Status</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editForm.isActive}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                    />
                    <span className="text-xs text-(--earist-body-text)">
                      {editForm.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* New Password */}
                <div className="mt-3">
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

            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPanelist(null);
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
                  editMutation.mutate({ id: selectedPanelist.id, data: editForm })
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
      {/* VIEW PANELIST MODAL      */}
      {/* ======================== */}
      {showViewModal && selectedPanelist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Panelist Details
              </h3>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedPanelist(null);
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <p className="text-xs text-(--earist-body-text)">Name</p>
                <p className="font-medium text-(--earist-primary)">
                  {formatDisplayName(selectedPanelist)}
                </p>
              </div>

              {/* Email */}
              <div>
                <p className="text-xs text-(--earist-body-text)">Email</p>
                <p className="text-sm text-(--earist-body-text)">
                  {selectedPanelist.email}
                </p>
              </div>

              {/* Qualification */}
              <div>
                <p className="text-xs text-(--earist-body-text)">Qualification</p>
                <p className="text-sm text-(--earist-body-text)">
                  {selectedPanelist.qualification}
                </p>
              </div>

              {/* Affiliation */}
              <div>
                <p className="text-xs text-(--earist-body-text)">Affiliation</p>
                <p className="text-sm text-(--earist-body-text)">
                  {selectedPanelist.affiliation}
                </p>
              </div>

              {/* Specialization */}
              <div>
                <p className="text-xs text-(--earist-body-text)">Specialization</p>
                <p className="text-sm text-(--earist-body-text)">
                  {selectedPanelist.specialization}
                </p>
              </div>

              {/* Type & Status row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-(--earist-body-text)">Type</p>
                  <Badge
                    className={
                      selectedPanelist.isExternal
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }
                  >
                    {selectedPanelist.isExternal ? "External" : "Internal"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">Status</p>
                  <Badge
                    className={
                      selectedPanelist.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }
                  >
                    {selectedPanelist.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Adviser */}
              <div>
                <p className="text-xs text-(--earist-body-text)">
                  Available as Adviser
                </p>
                <Badge
                  className={
                    selectedPanelist.isAvailableAsAdviser
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }
                >
                  {selectedPanelist.isAvailableAsAdviser ? "Yes" : "No"}
                </Badge>
              </div>

              {/* Created At */}
              <div>
                <p className="text-xs text-(--earist-body-text)">Created At</p>
                <p className="text-sm text-(--earist-body-text)">
                  {new Date(selectedPanelist.userCreatedAt).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
              </div>

              {/* Last Updated */}
              <div>
                <p className="text-xs text-(--earist-body-text)">Last Updated</p>
                <p className="text-sm text-(--earist-body-text)">
                  {new Date(selectedPanelist.userUpdatedAt).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedPanelist(null);
                }}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowViewModal(false);
                  openEditModal(selectedPanelist);
                }}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Edit className="mr-1 h-4 w-4" />
                Edit Panelist
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
