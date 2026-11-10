"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import type { AdministratorResponse } from "@/types";
import {
  ADMIN_CAPABILITY_GROUPS,
  ALL_ADMIN_CAPABILITY_KEYS,
  CAPABILITY_LABELS,
  type AdminAccessLevel,
  type AdminCapabilityKey,
} from "@/lib/admin-capabilities";
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
import { Switch } from "@/components/ui/switch";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  ShieldCheck,
  Shield,
  CheckSquare,
} from "lucide-react";

const TITLE_OPTIONS = ["Dr.", "Prof.", "Mr.", "Ms.", "Mrs.", "Engr.", "Atty.", ""];
const SUFFIX_OPTIONS = ["Jr.", "Sr.", "II", "III", "IV", ""];

const selectClass =
  "w-full rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none";

const labelClass = "mb-1 block text-xs font-medium text-(--earist-secondary)";

interface AdminFormData {
  title: string;
  firstName: string;
  lastName: string;
  suffix: string;
  email: string;
  adminAccessLevel: AdminAccessLevel;
  adminCapabilities: string[];
}

interface AdminEditData extends AdminFormData {
  isActive: boolean;
  newPassword: string;
}

const emptyCreateForm: AdminFormData = {
  title: "",
  firstName: "",
  lastName: "",
  suffix: "",
  email: "",
  adminAccessLevel: "RESTRICTED",
  adminCapabilities: [],
};

interface AdminRow {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  suffix: string;
  email: string;
  isActive: boolean;
  adminAccessLevel: AdminAccessLevel;
  adminCapabilities: string[];
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
}

function formatDisplayName(a: AdminRow) {
  const parts = [a.title, a.firstName, a.lastName, a.suffix].filter(Boolean);
  return parts.join(" ") || `${a.firstName} ${a.lastName}`;
}

function mapAdmin(a: AdministratorResponse): AdminRow {
  return {
    id: a.id,
    title: a.title || "",
    firstName: a.firstName,
    lastName: a.lastName,
    suffix: a.suffix || "",
    email: a.email,
    isActive: a.isActive,
    adminAccessLevel: a.adminAccessLevel ?? "FULL",
    adminCapabilities: Array.isArray(a.adminCapabilities)
      ? a.adminCapabilities
      : [],
    createdAt: a.createdAt,
    updatedAt: a.updatedAt || a.createdAt,
    createdByName: a.createdBy
      ? `${a.createdBy.firstName} ${a.createdBy.lastName}`
      : undefined,
    updatedByName: a.updatedBy
      ? `${a.updatedBy.firstName} ${a.updatedBy.lastName}`
      : undefined,
  };
}

function formatCapabilitySummary(admin: AdminRow): string {
  if (admin.adminAccessLevel === "FULL") {
    return "All Modules + Administrators Management";
  }
  const caps = admin.adminCapabilities.filter((c): c is AdminCapabilityKey =>
    ALL_ADMIN_CAPABILITY_KEYS.includes(c as AdminCapabilityKey),
  );
  if (caps.length === 0) {
    return "Dashboard only (no module access assigned)";
  }
  const labels = caps.map((c) => CAPABILITY_LABELS[c] || c);
  if (labels.length <= 2) {
    return labels.join(", ");
  }
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
}

function CapabilityEditor({
  selectedCapabilities,
  onChange,
}: {
  selectedCapabilities: string[];
  onChange: (next: string[]) => void;
}) {
  const toggleCapability = (key: string) => {
    if (selectedCapabilities.includes(key)) {
      onChange(selectedCapabilities.filter((k) => k !== key));
    } else {
      onChange([...selectedCapabilities, key]);
    }
  };

  const toggleGroup = (keys: string[]) => {
    const allSelected = keys.every((k) => selectedCapabilities.includes(k));
    if (allSelected) {
      onChange(selectedCapabilities.filter((k) => !keys.includes(k)));
    } else {
      const merged = new Set([...selectedCapabilities, ...keys]);
      onChange(Array.from(merged));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-(--earist-primary)">
            Assigned Module Access
          </p>
          <p className="text-xs text-(--earist-body-text)">
            Select at least one module capability for this Restricted
            Administrator.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          {selectedCapabilities.length} selected
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ADMIN_CAPABILITY_GROUPS.map((group) => {
          const groupKeys = group.capabilities.map((c) => c.key);
          const allInGroupSelected = groupKeys.every((k) =>
            selectedCapabilities.includes(k),
          );

          return (
            <div
              key={group.groupTitle}
              className="rounded-xl border border-(--earist-border-gray) bg-(--earist-surface-gray)/50 p-3.5"
            >
              <div className="mb-2.5 flex items-start justify-between gap-2 border-b border-(--earist-border-gray) pb-2">
                <div>
                  <p className="text-xs font-bold tracking-wide text-(--earist-primary) uppercase">
                    {group.groupTitle}
                  </p>
                  <p className="text-[11px] text-(--earist-body-text)">
                    {group.groupDescription}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroup(groupKeys)}
                  className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-(--earist-primary) hover:bg-white"
                >
                  <CheckSquare className="h-3 w-3" />
                  {allInGroupSelected ? "Clear" : "Select All"}
                </button>
              </div>

              <div className="space-y-2">
                {group.capabilities.map((cap) => {
                  const checked = selectedCapabilities.includes(cap.key);
                  return (
                    <label
                      key={cap.key}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2 transition-colors ${
                        checked
                          ? "border-(--earist-primary)/40 bg-white"
                          : "border-transparent hover:bg-white/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCapability(cap.key)}
                        className="mt-0.5 h-4 w-4 rounded border-(--earist-border-gray) text-(--earist-primary) focus:ring-(--earist-primary)"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">
                          {cap.label}
                        </p>
                        <p className="text-[11px] text-(--earist-body-text)">
                          {cap.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminAdministratorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminRow | null>(null);

  const [createForm, setCreateForm] = useState<AdminFormData>({
    ...emptyCreateForm,
  });
  const [editForm, setEditForm] = useState<AdminEditData>({
    ...emptyCreateForm,
    isActive: true,
    newPassword: "",
  });

  const queryClient = useQueryClient();

  const { data: administrators = [], isLoading } = useQuery({
    queryKey: ["adminAdministrators"],
    queryFn: async () => {
      const res = await apiClientRequest("/admin/administrators");
      return (Array.isArray(res) ? res : []).map(mapAdmin);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AdminFormData) => {
      return apiClientRequest("/admin/administrators", {
        method: "POST",
        body: JSON.stringify({
          title: data.title || undefined,
          firstName: data.firstName,
          lastName: data.lastName,
          suffix: data.suffix || undefined,
          email: data.email,
          adminAccessLevel: data.adminAccessLevel,
          adminCapabilities:
            data.adminAccessLevel === "FULL" ? [] : data.adminCapabilities,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAdministrators"] });
      setShowCreateModal(false);
      setCreateForm({ ...emptyCreateForm });
      toast.success("Administrator account created successfully!", {
        description:
          "Default password is the administrator's LAST NAME in all caps.",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create administrator.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClientRequest(`/admin/administrators/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAdministrators"] });
      queryClient.invalidateQueries({ queryKey: ["authMe"] });
      toast.success("Administrator status updated.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update status.");
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AdminEditData }) => {
      const payload: Record<string, unknown> = {
        title: data.title || null,
        firstName: data.firstName,
        lastName: data.lastName,
        suffix: data.suffix || null,
        email: data.email,
        isActive: data.isActive,
        adminAccessLevel: data.adminAccessLevel,
        adminCapabilities:
          data.adminAccessLevel === "FULL" ? [] : data.adminCapabilities,
      };
      if (data.newPassword.trim()) {
        payload.password = data.newPassword.trim();
      }
      return apiClientRequest(`/admin/administrators/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAdministrators"] });
      queryClient.invalidateQueries({ queryKey: ["authMe"] });
      setShowEditModal(false);
      setSelectedAdmin(null);
      toast.success("Administrator account updated successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update administrator.");
    },
  });

  const filteredAdmins = administrators.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      formatDisplayName(a).toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (typeFilter === "full") return a.adminAccessLevel === "FULL";
    if (typeFilter === "restricted") return a.adminAccessLevel === "RESTRICTED";
    if (typeFilter === "active") return a.isActive;
    if (typeFilter === "inactive") return !a.isActive;
    return true;
  });

  const totalPages = Math.ceil(filteredAdmins.length / pageSize);
  const paginatedAdmins = filteredAdmins.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const totalCount = administrators.length;
  const activeCount = administrators.filter((a) => a.isActive).length;
  const fullCount = administrators.filter(
    (a) => a.adminAccessLevel === "FULL",
  ).length;
  const restrictedCount = administrators.filter(
    (a) => a.adminAccessLevel === "RESTRICTED",
  ).length;

  function openViewModal(admin: AdminRow) {
    setSelectedAdmin(admin);
    setShowViewModal(true);
  }

  function openEditModal(admin: AdminRow) {
    setSelectedAdmin(admin);
    setEditForm({
      title: admin.title,
      firstName: admin.firstName,
      lastName: admin.lastName,
      suffix: admin.suffix,
      email: admin.email,
      adminAccessLevel: admin.adminAccessLevel,
      adminCapabilities: [...admin.adminCapabilities],
      isActive: admin.isActive,
      newPassword: "",
    });
    setShowEditModal(true);
  }

  const canSubmitCreate =
    createForm.firstName.trim() !== "" &&
    createForm.lastName.trim() !== "" &&
    createForm.email.trim() !== "" &&
    (createForm.adminAccessLevel === "FULL" ||
      createForm.adminCapabilities.length > 0);

  const canSubmitEdit =
    editForm.firstName.trim() !== "" &&
    editForm.lastName.trim() !== "" &&
    editForm.email.trim() !== "" &&
    (editForm.adminAccessLevel === "FULL" ||
      editForm.adminCapabilities.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrators Management"
        description="Manage Full Administrators and Restricted Administrators with scoped module permissions."
        actions={
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Administrator
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Total Administrators
            </p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {totalCount}
            </p>
          </CardContent>
        </Card>
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
            <p className="text-xs text-(--earist-body-text)">
              Full Administrators
            </p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {fullCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Restricted Administrators
            </p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {restrictedCount}
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
                placeholder="Search by administrator name or email..."
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
                <option value="all">All Administrators</option>
                <option value="full">Full Administrators</option>
                <option value="restricted">Restricted Administrators</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Administrators Table */}
      <TableCard>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-(--earist-primary)" />
            <span className="ml-2 text-sm text-(--earist-body-text)">
              Loading administrators...
            </span>
          </div>
        ) : paginatedAdmins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserX className="mb-4 h-12 w-12 text-gray-300" />
            <p className="text-sm text-(--earist-body-text)">
              No administrators found
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Access Level</TableHead>
                <TableHead>Granted Access</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAdmins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <p className="font-medium text-(--earist-primary)">
                      {formatDisplayName(admin)}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs text-(--earist-body-text)">
                    {admin.email}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        admin.adminAccessLevel === "FULL"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }
                    >
                      {admin.adminAccessLevel === "FULL"
                        ? "Full Administrator"
                        : "Restricted Administrator"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-(--earist-body-text)">
                    {formatCapabilitySummary(admin)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        admin.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }
                    >
                      {admin.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openViewModal(admin)}
                        className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(admin)}
                        className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                        title="Edit Administrator"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          statusMutation.mutate({
                            id: admin.id,
                            isActive: !admin.isActive,
                          })
                        }
                        disabled={statusMutation.isPending}
                        className={`rounded p-1.5 transition-colors ${
                          admin.isActive
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-600 hover:bg-green-50"
                        } ${statusMutation.isPending ? "cursor-not-allowed opacity-50" : ""}`}
                        title={admin.isActive ? "Deactivate" : "Activate"}
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
              {Math.min(page * pageSize, filteredAdmins.length)} of{" "}
              {filteredAdmins.length} administrators
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

      {/* ============================ */}
      {/* CREATE ADMINISTRATOR MODAL   */}
      {/* ============================ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Add New Administrator
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
                  The administrator&apos;s default password is their{" "}
                  <strong>LAST NAME in ALL CAPS</strong> (e.g., &quot;Cruz&quot;
                  →{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                    CRUZ
                  </code>
                  ). They will be required to change this password upon first
                  login.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Name Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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

              {/* Email */}
              <div>
                <Label className={labelClass}>Email Address *</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="admin.staff@earist.edu.ph"
                />
              </div>

              {/* Access Level Selection */}
              <div className="space-y-2 border-t border-(--earist-border-gray) pt-4">
                <Label className={labelClass}>Administrator Access Level</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm({
                        ...createForm,
                        adminAccessLevel: "RESTRICTED",
                      })
                    }
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      createForm.adminAccessLevel === "RESTRICTED"
                        ? "border-(--earist-primary) bg-red-50/40 ring-1 ring-(--earist-primary)"
                        : "border-(--earist-border-gray) hover:bg-gray-50"
                    }`}
                  >
                    <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        Restricted Administrator
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        Access only to specific modules and capabilities you
                        select below.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm({
                        ...createForm,
                        adminAccessLevel: "FULL",
                      })
                    }
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      createForm.adminAccessLevel === "FULL"
                        ? "border-(--earist-primary) bg-red-50/40 ring-1 ring-(--earist-primary)"
                        : "border-(--earist-border-gray) hover:bg-gray-50"
                    }`}
                  >
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
                    <div>
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        Full Administrator
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        Unrestricted access to all system modules and
                        Administrators Management.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Module Capability Editor (only when RESTRICTED) */}
              {createForm.adminAccessLevel === "RESTRICTED" ? (
                <div className="border-t border-(--earist-border-gray) pt-4">
                  <CapabilityEditor
                    selectedCapabilities={createForm.adminCapabilities}
                    onChange={(caps) =>
                      setCreateForm({ ...createForm, adminCapabilities: caps })
                    }
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 text-xs text-purple-900">
                  <p className="font-semibold">
                    Full Administrator Access Enabled
                  </p>
                  <p className="mt-0.5">
                    This account will have full access to User Management, Exam
                    Management, Thesis Management, Institutional & System
                    settings, and Administrators Management.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                disabled={createMutation.isPending || !canSubmitCreate}
                onClick={() => createMutation.mutate(createForm)}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Administrator
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================ */}
      {/* EDIT ADMINISTRATOR MODAL     */}
      {/* ============================ */}
      {showEditModal && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Edit Administrator
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedAdmin(null);
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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

              {/* Email */}
              <div>
                <Label className={labelClass}>Email Address *</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  placeholder="admin.staff@earist.edu.ph"
                />
              </div>

              {/* Access Level Selection */}
              <div className="space-y-2 border-t border-(--earist-border-gray) pt-4">
                <Label className={labelClass}>Administrator Access Level</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm({
                        ...editForm,
                        adminAccessLevel: "RESTRICTED",
                      })
                    }
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      editForm.adminAccessLevel === "RESTRICTED"
                        ? "border-(--earist-primary) bg-red-50/40 ring-1 ring-(--earist-primary)"
                        : "border-(--earist-border-gray) hover:bg-gray-50"
                    }`}
                  >
                    <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        Restricted Administrator
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        Access only to specific modules and capabilities you
                        select below.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditForm({
                        ...editForm,
                        adminAccessLevel: "FULL",
                      })
                    }
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      editForm.adminAccessLevel === "FULL"
                        ? "border-(--earist-primary) bg-red-50/40 ring-1 ring-(--earist-primary)"
                        : "border-(--earist-border-gray) hover:bg-gray-50"
                    }`}
                  >
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
                    <div>
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        Full Administrator
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        Unrestricted access to all system modules and
                        Administrators Management.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Module Capability Editor */}
              {editForm.adminAccessLevel === "RESTRICTED" ? (
                <div className="border-t border-(--earist-border-gray) pt-4">
                  <CapabilityEditor
                    selectedCapabilities={editForm.adminCapabilities}
                    onChange={(caps) =>
                      setEditForm({ ...editForm, adminCapabilities: caps })
                    }
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 text-xs text-purple-900">
                  <p className="font-semibold">
                    Full Administrator Access Enabled
                  </p>
                  <p className="mt-0.5">
                    This account has full access to all modules and
                    Administrators Management.
                  </p>
                </div>
              )}

              {/* Account Status & Password Reset */}
              <div className="space-y-3 border-t border-(--earist-border-gray) pt-4">
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

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedAdmin(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                disabled={editMutation.isPending || !canSubmitEdit}
                onClick={() =>
                  editMutation.mutate({
                    id: selectedAdmin.id,
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

      {/* ============================ */}
      {/* VIEW ADMINISTRATOR MODAL     */}
      {/* ============================ */}
      {showViewModal && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Administrator Details
              </h3>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedAdmin(null);
                }}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-(--earist-body-text)">Name</p>
                <p className="font-semibold text-(--earist-primary)">
                  {formatDisplayName(selectedAdmin)}
                </p>
              </div>

              <div>
                <p className="text-xs text-(--earist-body-text)">Email</p>
                <p className="text-sm text-(--earist-body-text)">
                  {selectedAdmin.email}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs text-(--earist-body-text)">
                    Access Level
                  </p>
                  <Badge
                    className={
                      selectedAdmin.adminAccessLevel === "FULL"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }
                  >
                    {selectedAdmin.adminAccessLevel === "FULL"
                      ? "Full Administrator"
                      : "Restricted Administrator"}
                  </Badge>
                </div>
                <div>
                  <p className="mb-1 text-xs text-(--earist-body-text)">
                    Status
                  </p>
                  <Badge
                    className={
                      selectedAdmin.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }
                  >
                    {selectedAdmin.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Granted Capabilities */}
              <div className="border-t border-(--earist-border-gray) pt-3">
                <p className="mb-2 text-xs font-semibold tracking-wide text-(--earist-primary) uppercase">
                  Granted Module Access
                </p>
                {selectedAdmin.adminAccessLevel === "FULL" ? (
                  <p className="text-sm text-(--earist-body-text)">
                    All System Modules + Administrators Management
                  </p>
                ) : selectedAdmin.adminCapabilities.length === 0 ? (
                  <p className="text-sm text-(--earist-body-text)">
                    Dashboard only (no module capabilities assigned)
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAdmin.adminCapabilities.map((capKey) => (
                      <Badge
                        key={capKey}
                        className="bg-blue-50 text-blue-700"
                      >
                        {CAPABILITY_LABELS[capKey as AdminCapabilityKey] ||
                          capKey}
                      </Badge>
                    ))}
                  </div>
                )}
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
                      {new Date(selectedAdmin.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                  {selectedAdmin.createdByName && (
                    <div className="flex justify-between">
                      <span className="text-xs text-(--earist-body-text)">
                        Created By
                      </span>
                      <span className="text-sm text-gray-900">
                        {selectedAdmin.createdByName}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs text-(--earist-body-text)">
                      Last Updated
                    </span>
                    <span className="text-sm text-gray-900">
                      {new Date(selectedAdmin.updatedAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                  {selectedAdmin.updatedByName && (
                    <div className="flex justify-between">
                      <span className="text-xs text-(--earist-body-text)">
                        Updated By
                      </span>
                      <span className="text-sm text-gray-900">
                        {selectedAdmin.updatedByName}
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
                  setSelectedAdmin(null);
                }}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowViewModal(false);
                  openEditModal(selectedAdmin);
                }}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Edit className="mr-1 h-4 w-4" />
                Edit Administrator
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
