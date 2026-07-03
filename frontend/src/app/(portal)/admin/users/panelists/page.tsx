"use client";

import { useState } from "react";
import { PanelistResponse } from "@/types";
import { Card, CardContent} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  UserCheck,
  UserX,
  GraduationCap,
  Building,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";

export default function AdminPanelistsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);

const queryClient = useQueryClient();

// Form State
const [formData, setFormData] = useState({
  firstName: "",
  lastName: "",
  email: "",
  type: "internal",
  qualification: "",
  affiliation: "",
  specialization: ""
});

// Fetch from backend
const { data: panelists = [] } = useQuery({
  queryKey: ["adminPanelists"],
  queryFn: async () => {
    const res = await apiClientRequest("/panelists");

    //Map backend data to match UI expected format
    return (Array.isArray(res) ? res : []).map((p: PanelistResponse) => ({
      id: p.id,
      name: `${p.user.firstName} ${p.user.lastName}`,
      email: p.user.email,
      type: p.isExternal ? "external" : "internal",
      qualification: p.highestEducationalAttainment || "N/A",
      affiliation: p.officeAffiliation || "N/A",
      specialization: p.specialization || "N/A",
      status: p.user.isActive ? "active" :"inactive",
      isAvailableAsAdviser: p.isAvailableAsAdviser,
      defensesAssigned: 0
    }));
  },
});

// Create Mutation
const createMutation = useMutation({
  mutationFn: async (data: typeof formData) => {
    return apiClientRequest("/panelists", {
      method: "POST",
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        officeAffiliation: data.affiliation,
        highestEducationalAttainment: data.qualification,
        specialization: data.specialization,
        isExternal: data.type === "external",
      }),
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ["adminPanelists"]
    });
    setShowAddModal(false);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      type: "internal",
      qualification: "",
      affiliation: "",
      specialization: ""
    });
    alert("Panelist created! Default password is their LAST NAME in all caps.");
  },
  onError: (error: Error) => alert(error.message)
});

  const filteredPanelists = panelists.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.specialization.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (typeFilter === "internal") return p.type === "internal";
    if (typeFilter === "external") return p.type === "external";
    if (typeFilter === "adviser") return p.isAvailableAsAdviser;
    return true;
  });

  const activeCount = panelists.filter((p) => p.status === "active").length;
  const internalCount = panelists.filter((p) => p.type === "internal").length;
  const externalCount = panelists.filter((p) => p.type === "external").length;
  const adviserCount = panelists.filter((p) => p.isAvailableAsAdviser).length;

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
          onClick={() => setShowAddModal(true)}
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
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or specialization..."
                className="w-full rounded-lg border border-(--earist-border-gray) py-2 pr-3 pl-10 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
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
                <option value="adviser">Available as Adviser</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panelists Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray)">
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Name
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Qualification
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-(--earist-secondary)">
                    Affiliation
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Defenses
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-(--earist-secondary)">
                    Adviser
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
                {filteredPanelists.map((panelist) => (
                  <tr
                    key={panelist.id}
                    className="border-b border-(--earist-border-gray) last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-(--earist-primary)">
                          {panelist.name}
                        </p>
                        <p className="text-xs text-(--earist-body-text)">
                          {panelist.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={
                          panelist.type === "internal"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }
                      >
                        {panelist.type === "internal" ? (
                          <>
                            <GraduationCap className="mr-1 h-3 w-3" />
                            Internal
                          </>
                        ) : (
                          <>
                            <Building className="mr-1 h-3 w-3" />
                            External
                          </>
                        )}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-(--earist-body-text)">
                        {panelist.qualification}
                      </p>
                      <p className="text-[11px] text-(--earist-body-text)">
                        {panelist.specialization}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                      {panelist.affiliation}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-(--earist-primary)">
                        {panelist.defensesAssigned}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {panelist.isAvailableAsAdviser ? (
                        <Badge className="bg-green-100 text-green-700">
                          <UserCheck className="mr-1 h-3 w-3" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500">
                          <UserX className="mr-1 h-3 w-3" />
                          No
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={
                          panelist.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }
                      >
                        {panelist.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className={`rounded p-1.5 ${
                            panelist.status === "active"
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                          title={
                            panelist.status === "active"
                              ? "Deactivate"
                              : "Activate"
                          }
                        >
                          {panelist.status === "active" ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-(--earist-border-gray) px-4 py-3">
            <p className="text-xs text-(--earist-body-text)">
              Showing {filteredPanelists.length} of {panelists.length} panelists
            </p>
            <div className="flex items-center gap-1">
              <button className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="rounded bg-(--earist-primary) px-2 py-1 text-xs text-white">
                1
              </button>
              <button className="rounded p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Panelist Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Add New Panelist
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-1 text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">First Name</label>
                  <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Last Name</label>
                  <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Type</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none">
                  <option value="internal">Internal (Faculty)</option>
                  <option value="external">External</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Qualification</label>
                <input type="text" value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Affiliation</label>
                <input type="text" value={formData.affiliation} onChange={e => setFormData({...formData, affiliation: e.target.value})} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">Specialization</label>
                <input type="text" value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
              <Button 
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(formData)} 
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Panelist
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
