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
  CheckCircle2,
  Globe,
  GlobeLock,
  FileText,
  Calendar,
  User,
  BookOpen,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import type { RepositoryAdminEntry } from "@/types";

/**
 * DL-10: Research Repository publication management.
 *
 * Admin publishes/unpublishes *metadata* derived from private Databank
 * archives. Admin does not edit the official title, upload a publication file,
 * or delete the private archive; the archival manuscript / download policy is
 * an unresolved institutional decision.
 */
export default function AdminRepositoryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-repository-entries"],
    queryFn: async () =>
      (await apiClientRequest(
        "/repository/admin/entries",
      )) as RepositoryAdminEntry[],
  });

  const entries: RepositoryAdminEntry[] = data ?? [];

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      apiClientRequest(`/repository/admin/entries/${id}/publish`, {
        method: "PUT",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-repository-entries"] }),
    onError: (error: Error) =>
      alert(error.message || "Publication could not be completed."),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) =>
      apiClientRequest(`/repository/admin/entries/${id}/unpublish`, {
        method: "PUT",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-repository-entries"] }),
    onError: (error: Error) =>
      alert(error.message || "Unpublish could not be completed."),
  });

  const filteredEntries = entries.filter((entry) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      entry.title.toLowerCase().includes(query) ||
      (entry.author ?? "").toLowerCase().includes(query) ||
      entry.keywords.some((keyword) => keyword.toLowerCase().includes(query));

    if (!matchesSearch) return false;
    if (statusFilter === "published" && !entry.publication.isPublished)
      return false;
    if (statusFilter === "private" && entry.publication.isPublished)
      return false;

    return true;
  });

  const selectedEntryData = entries.find((e) => e.id === selectedEntryId);

  const publishedCount = entries.filter(
    (e) => e.publication.isPublished,
  ).length;
  const privateCount = entries.length - publishedCount;

  const getStatusBadge = (isPublished: boolean) =>
    isPublished ? (
      <Badge className="bg-green-100 text-green-700">
        <Globe className="mr-1 h-3 w-3" />
        Published Metadata
      </Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-600">
        <FileText className="mr-1 h-3 w-3" />
        Private Archive
      </Badge>
    );

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : null;

  if (isLoading)
    return (
      <div className="p-8 text-center text-gray-500">
        Loading repository entries…
      </div>
    );

  if (isError)
    return (
      <div className="p-8 text-center text-sm text-red-600">
        Unable to load repository entries. Please try again.
      </div>
    );

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Research Repository Publication
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Publish or unpublish Repository metadata derived from private Databank
          archives. Publishing metadata does not publish manuscripts or
          respondent data.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Published Metadata</p>
            <p className="text-lg font-bold text-green-600">{publishedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">Private Archives</p>
            <p className="text-lg font-bold text-(--earist-primary)">
              {privateCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-(--earist-body-text)">
              Full-text Downloads
            </p>
            <p className="text-sm font-semibold text-(--earist-body-text)">
              Not enabled
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
                <option value="published">Published Metadata</option>
                <option value="private">Private Archive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Entries List */}
        <div className="space-y-2 lg:col-span-1">
          {filteredEntries.map((entry) => (
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
                    {entry.author ?? "Unknown"} &middot;{" "}
                    {entry.program ?? "Unknown program"}
                  </p>
                </div>
                {getStatusBadge(entry.publication.isPublished)}
              </div>
            </button>
          ))}
          {filteredEntries.length === 0 && (
            <p className="rounded-lg border border-(--earist-border-gray) p-4 text-sm text-(--earist-body-text)">
              No archives match your filters.
            </p>
          )}
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
                  {getStatusBadge(selectedEntryData.publication.isPublished)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold text-(--earist-primary)">
                      {selectedEntryData.title}
                    </p>
                    <p className="mt-1 text-xs text-(--earist-secondary)">
                      Official research title (read-only, derived from the
                      Defense records)
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--earist-body-text)">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {selectedEntryData.author ?? "Unknown"}
                      </span>
                      {selectedEntryData.studentNumber && (
                        <>
                          <span>&middot;</span>
                          <span>{selectedEntryData.studentNumber}</span>
                        </>
                      )}
                      {selectedEntryData.program && (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {selectedEntryData.program}
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
                      {selectedEntryData.abstract ?? "No abstract provided."}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                      Keywords
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedEntryData.keywords.length === 0 ? (
                        <span className="text-sm text-(--earist-body-text)">
                          None
                        </span>
                      ) : (
                        selectedEntryData.keywords.map((keyword, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-(--earist-body-text)">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Archive registered{" "}
                      {formatDate(selectedEntryData.archiveRegisteredAt) ?? "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      Published{" "}
                      {formatDate(selectedEntryData.publication.publishedAt) ??
                        "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap gap-2">
                  {!selectedEntryData.publication.isPublished && (
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
                        : "Publish Metadata"}
                    </Button>
                  )}
                  {selectedEntryData.publication.isPublished && (
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
                </div>
                <div className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
                  Publishing exposes metadata only. Manuscripts, respondent
                  data, and files are never published from this screen, and the
                  private Databank archive is never deleted or edited here.
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
                    Click a private archive from the list to publish or
                    unpublish its metadata.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
