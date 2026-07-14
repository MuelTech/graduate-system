"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Shield,
  Users,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function AdminRolesPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);

  const roles = [
    {
      id: 1,
      name: "Program Chair",
      description:
        "Reviews and grades essay examinations. Manages program-level academic decisions.",
      usersCount: 3,
      status: "active" as "active" | "inactive",
      permissions: [
        "View applicants",
        "Grade essays",
        "View exam results",
        "View analytics",
      ],
      createdAt: "January 15, 2026",
    },
    {
      id: 2,
      name: "GS Office Staff",
      description:
        "Handles document processing, COR verification, and day-to-day office operations.",
      usersCount: 5,
      status: "active" as "active" | "inactive",
      permissions: [
        "View applicants",
        "Validate waivers",
        "Verify COR",
        "Manage exam slots",
        "View notifications",
      ],
      createdAt: "February 1, 2026",
    },
    {
      id: 3,
      name: "Viewer (Read-Only)",
      description:
        "Read-only access for reporting and monitoring purposes. No edit permissions.",
      usersCount: 1,
      status: "inactive" as "active" | "inactive",
      permissions: [
        "View applicants",
        "View students",
        "View analytics",
        "View repository",
      ],
      createdAt: "May 20, 2026",
    },
  ];

  const allPermissions = [
    "View applicants",
    "View students",
    "View panelists",
    "Validate waivers",
    "Verify COR",
    "Manage exam slots",
    "Grade essays",
    "View exam results",
    "View thesis applications",
    "Manage thesis scheduling",
    "Manage repository",
    "Manage advisees",
    "View analytics",
    "Generate reports",
    "Manage settings",
    "Send notifications",
    "View notifications",
    "Manage memos",
  ];

  const selectedRoleData = roles.find((r) => r.id === selectedRole);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            Custom Role Management
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Create and configure custom roles with specific permissions
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          Create Role
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Roles List */}
        <div className="space-y-2 lg:col-span-1">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                selectedRole === role.id
                  ? "border-(--earist-primary) bg-(--earist-surface-light-red)"
                  : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-(--earist-surface-gray)">
                    <Shield className="h-4 w-4 text-(--earist-primary)" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-(--earist-primary)">
                      {role.name}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {role.usersCount} user(s)
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    role.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }
                >
                  {role.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
            </button>
          ))}
        </div>

        {/* Role Details */}
        <div className="lg:col-span-2">
          {selectedRoleData ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--earist-surface-light-red)">
                      <Shield className="h-5 w-5 text-(--earist-primary)" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-(--earist-primary)">
                        {selectedRoleData.name}
                      </CardTitle>
                      <p className="text-xs text-(--earist-body-text)">
                        Created: {selectedRoleData.createdAt}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                      title="Edit Role"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded p-1.5 text-red-600 hover:bg-red-50"
                      title="Delete Role"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Description */}
                  <div>
                    <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                      Description
                    </p>
                    <p className="text-sm text-(--earist-body-text)">
                      {selectedRoleData.description}
                    </p>
                  </div>

                  {/* Users Count */}
                  <div className="flex items-center gap-2 rounded-lg bg-(--earist-surface-gray) p-3">
                    <Users className="h-4 w-4 text-(--earist-body-text)" />
                    <p className="text-sm text-(--earist-body-text)">
                      <span className="font-semibold text-(--earist-primary)">
                        {selectedRoleData.usersCount}
                      </span>{" "}
                      user(s) assigned to this role
                    </p>
                  </div>

                  {/* Permissions */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-(--earist-secondary)">
                      Permissions ({selectedRoleData.permissions.length})
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {allPermissions.map((perm) => {
                        const hasPermission =
                          selectedRoleData.permissions.includes(perm);
                        return (
                          <div
                            key={perm}
                            className={`flex items-center gap-2 rounded-lg p-2 ${
                              hasPermission
                                ? "bg-green-50"
                                : "bg-(--earist-surface-gray)"
                            }`}
                          >
                            {hasPermission ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-gray-300" />
                            )}
                            <span
                              className={`text-xs ${
                                hasPermission
                                  ? "font-medium text-green-700"
                                  : "text-gray-400"
                              }`}
                            >
                              {perm}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <Shield className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select a Role
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Click a role from the list to view its details and
                    permissions.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Create New Role
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Role Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Program Chair"
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Description
                </label>
                <textarea
                  placeholder="Describe the role's responsibilities..."
                  className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-(--earist-secondary)">
                  Permissions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {allPermissions.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-2 rounded-lg border border-(--earist-border-gray) p-2 hover:bg-(--earist-surface-gray)"
                    >
                      <input type="checkbox" className="rounded" />
                      <span className="text-xs text-(--earist-body-text)">
                        {perm}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                Create Role
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
