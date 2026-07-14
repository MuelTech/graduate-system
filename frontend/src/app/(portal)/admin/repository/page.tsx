"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Library,
  Search,
  Filter,
  Edit,
  CheckCircle2,
  Globe,
  GlobeLock,
  X,
  Save,
  FileText,
  Calendar,
  User,
  BookOpen,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { BackendEntry, Entry } from "@/types";

export default function AdminRepositoryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAbstract, setEditAbstract] = useState("");
  const [editKeywords, setEditKeywords] = useState("");

  // 1. Fetch live databank entries from backend
  const { data: databankData, isLoading } = useQuery({
    queryKey: ["admin-databank"],
    queryFn: async () => {
      const res = await apiClientRequest("/databank");
      return res || [];
    },
  });

  // Map backend structure to our UI state
  const entries: Entry[] = (databankData || []).map((d: BackendEntry) => ({
    id: d.id,
    title: d.title,
    author: d.thesis?.student?.user
      ? `${d.thesis.student.user.firstName} ${d.thesis.student.user.lastName}`
      : "Unknown",
    studentNumber: d.thesis?.student?.studentId || "Unknown",
    program: d.thesis?.student?.program?.programName || "Unknown",
    abstract: d.abstract || "No abstract provided.",
    keywords: d.keywords
      ? d.keywords.split(",").map((k: string) => k.trim())
      : [],
    datePublished: d.publishedAt
      ? new Date(d.publishedAt).toLocaleDateString()
      : null,
    status: d.isPublic ? "published" : "pending",
    downloads: 0, // Future analytics integration
    views: 0, // Future analytics integration
  }));

  // 2. Mutations for actions
  const publishMutation = useMutation({
    mutationFn: async (id: string) =>
      apiClientRequest(`/databank/${id}/publish`, { method: "PUT" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-databank"] }),
  });

  const unpublishMutation = useMutation({
    mutationFn: async (id: string) =>
      apiClientRequest(`/databank/${id}/unpublish`, { method: "PUT" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-databank"] }),
  });

  const editMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      title: string;
      abstract: string;
      keywords: string;
    }) =>
      apiClientRequest(`/databank/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: payload.title,
          abstract: payload.abstract,
          keywords: payload.keywords,
        }),
      }),
    onSuccess: () => {
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ["admin-databank"] });
    },
  });

  const filteredEntries = entries.filter((entry: Entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.keywords.some((k: string) =>
        k.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    if (!matchesSearch) return false;
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (programFilter !== "all" && entry.program !== programFilter)
      return false;

    return true;
  });

  const selectedEntryData = entries.find((e: Entry) => e.id === selectedEntryId);

  const publishedCount = entries.filter(
    (e: Entry) => e.status === "published",
  ).length;
  const pendingCount = entries.filter(
    (e: Entry) => e.status === "pending",
  ).length;
  const totalDownloads = entries.reduce(
    (sum: number, e: Entry) => sum + e.downloads,
    0,
  );
  const programs = Array.from(new Set(entries.map((e: Entry) => e.program)));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return (
          <Badge className="bg-green-100 text-green-700">
            <Globe className="mr-1 h-3 w-3" />
            Published
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700">
            <FileText className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleEditMetadata = () => {
    if (selectedEntryData) {
      setEditTitle(selectedEntryData.title);
      setEditAbstract(selectedEntryData.abstract);
      setEditKeywords(selectedEntryData.keywords.join(", "));
      setShowEditModal(true);
    }
  };

  if (isLoading)
    return (
      <div className="p-8 text-center text-gray-500">Loading Databank...</div>
    );

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Research Repository & Databank
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Manage published research entries and databank
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Published</p>
            <p className="text-lg font-bold text-green-600">{publishedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Pending</p>
            <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Total Downloads</p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {totalDownloads}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or keyword..."
                className="w-full rounded-lg border border-(--earist-border-gray) py-2 pr-3 pl-10 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="pending">Pending</option>
              </select>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none"
              >
                <option value="all">All Programs</option>
                {programs.map((p: string) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Entries List */}
        <div className="space-y-2 lg:col-span-1">
          {filteredEntries.map((entry: Entry) => (
            <button
              key={entry.id}
              onClick={() => setSelectedEntryId(entry.id)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${selectedEntryId === entry.id ? "border-(--earist-primary) bg-(--earist-surface-light-red)" : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-(--earist-primary)">
                    {entry.title}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    {entry.author} &middot; {entry.program}
                  </p>
                </div>
                {getStatusBadge(entry.status)}
              </div>
            </button>
          ))}
        </div>

        {/* Entry Detail */}
        {selectedEntryData ? (
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                    Research Details
                  </CardTitle>
                  {getStatusBadge(selectedEntryData.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold text-(--earist-primary)">
                      {selectedEntryData.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--earist-body-text)">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {selectedEntryData.author}
                      </span>
                      <span>&middot;</span>
                      <span>{selectedEntryData.studentNumber}</span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {selectedEntryData.program}
                      </span>
                      {selectedEntryData.datePublished && (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {selectedEntryData.datePublished}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                      Abstract
                    </p>
                    <p className="text-sm text-(--earist-body-text)">
                      {selectedEntryData.abstract}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                      Keywords
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedEntryData.keywords.map(
                        (keyword: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-2">
                  {selectedEntryData.status === "pending" && (
                    <Button
                      className="bg-green-600 text-white hover:bg-green-700"
                      onClick={() =>
                        publishMutation.mutate(selectedEntryData.id)
                      }
                      disabled={publishMutation.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {publishMutation.isPending
                        ? "Publishing..."
                        : "Approve & Publish"}
                    </Button>
                  )}
                  {selectedEntryData.status === "published" && (
                    <Button
                      variant="outline"
                      className="text-amber-600 hover:bg-amber-50"
                      onClick={() =>
                        unpublishMutation.mutate(selectedEntryData.id)
                      }
                      disabled={unpublishMutation.isPending}
                    >
                      <GlobeLock className="mr-2 h-4 w-4" />
                      {unpublishMutation.isPending
                        ? "Unpublishing..."
                        : "Unpublish"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleEditMetadata}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Metadata
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <Library className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select a Research Entry
                  </h3>
                  <p className="text-sm text-(--earist-body-text)">
                    Click an entry from the list to view details and manage.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {showEditModal && selectedEntryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--earist-primary)">
                Edit Metadata
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-full p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Abstract
                </label>
                <textarea
                  value={editAbstract}
                  onChange={(e) => setEditAbstract(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  rows={5}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-(--earist-secondary)">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  editMutation.mutate({
                    id: selectedEntryData.id,
                    title: editTitle,
                    abstract: editAbstract,
                    keywords: editKeywords,
                  })
                }
                disabled={editMutation.isPending}
                className="flex-1 bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
              >
                <Save className="mr-2 h-4 w-4" />
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
