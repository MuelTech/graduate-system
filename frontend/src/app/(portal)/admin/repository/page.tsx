"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentViewer } from "@/components/ui/document-viewer";
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
  Edit3,
  Eye,
  Download,
  ShieldAlert,
  FileSpreadsheet,
  FileCheck,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { apiClientRequest } from "@/lib/api.client";
import type { RepositoryAdminEntry } from "@/types";

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Phase 10: Research Databank Archival & Repository Publication Management.
 *
 * Administrator portal allowing Graduate School Admins to:
 * 1. Inspect submitted archival records (Approved Final Manuscript Ch. 1-5,
 *    Research Certifications, Instruments, and Respondent Data).
 * 2. Edit research metadata (title, abstract, keywords) to fix typos without deleting entries.
 * 3. Publish / unpublish metadata to the discovery index with immutable audit logs.
 * 4. Securely stream restricted respondent datasets under Data Privacy Act compliance.
 */
export default function AdminRepositoryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Edit Metadata Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingAbstract, setEditingAbstract] = useState("");
  const [editingKeywords, setEditingKeywords] = useState("");

  // Document Viewer Modal State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");

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
    onSuccess: () => {
      toast.success("Research entry published to public repository.");
      queryClient.invalidateQueries({ queryKey: ["admin-repository-entries"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Publication could not be completed."),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) =>
      apiClientRequest(`/repository/admin/entries/${id}/unpublish`, {
        method: "PUT",
      }),
    onSuccess: () => {
      toast.success("Research entry unpublished from repository.");
      queryClient.invalidateQueries({ queryKey: ["admin-repository-entries"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Unpublish could not be completed."),
  });

  const updateMetadataMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      abstract,
      keywords,
    }: {
      id: string;
      title: string;
      abstract: string;
      keywords: string[];
    }) => {
      return apiClientRequest(`/repository/admin/entries/${id}/metadata`, {
        method: "PUT",
        body: JSON.stringify({ title, abstract, keywords }),
      });
    },
    onSuccess: () => {
      toast.success("Research metadata updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-repository-entries"] });
      setEditModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update metadata.");
    },
  });

  const handleOpenEditModal = (entry: RepositoryAdminEntry) => {
    setEditingTitle(entry.title);
    setEditingAbstract(entry.abstract ?? "");
    setEditingKeywords(entry.keywords.join(", "));
    setEditModalOpen(true);
  };

  const handleSaveMetadata = () => {
    if (!selectedEntryData) return;
    if (!editingTitle.trim()) {
      toast.error("Title cannot be empty.");
      return;
    }

    const keywordList = editingKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    updateMetadataMutation.mutate({
      id: selectedEntryData.id,
      title: editingTitle.trim(),
      abstract: editingAbstract.trim(),
      keywords: keywordList,
    });
  };

  const handleOpenViewer = (url: string, title: string) => {
    setViewerUrl(url);
    setViewerTitle(title);
    setViewerOpen(true);
  };

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
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
        <Globe className="mr-1 h-3 w-3" />
        Published in Repository
      </Badge>
    ) : (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        <FileText className="mr-1 h-3 w-3" />
        Private Databank Archive
      </Badge>
    );

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : null;

  if (isLoading)
    return (
      <div className="flex h-64 items-center justify-center text-sm text-(--earist-body-text)">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-(--earist-primary)" />
        Loading Databank & Repository archives…
      </div>
    );

  if (isError)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-red-600" />
        Unable to load repository entries. Please verify network connectivity or session.
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Research Databank & Repository Management
        </h2>
        <p className="mt-1 text-sm text-(--earist-body-text)">
          Review archived post-defense manuscripts, inspect research instruments and certifications,
          correct metadata, and manage public discovery indexing.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-(--earist-body-text)">Total Databank Submissions</p>
            <p className="mt-1 text-2xl font-bold text-(--earist-primary)">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-(--earist-body-text)">Published in Repository</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{publishedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-(--earist-body-text)">Private / Internal Archives</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{privateCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, student author, or keywords..."
                className="w-full rounded-lg border border-(--earist-border-gray) py-2 pr-3 pl-10 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Archives</option>
                <option value="published">Published Metadata</option>
                <option value="private">Private Archive Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Archives Queue */}
        <div className="space-y-3 lg:col-span-1">
          <h3 className="text-sm font-semibold text-(--earist-secondary)">
            Archival Submissions ({filteredEntries.length})
          </h3>
          <div className="max-h-[calc(100vh-280px)] space-y-2.5 overflow-y-auto pr-1">
            {filteredEntries.map((entry) => {
              const isSelected = selectedEntryId === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntryId(entry.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-(--earist-primary) bg-(--earist-surface-light-red) shadow-sm ring-1 ring-(--earist-primary)/20"
                      : "border-(--earist-border-gray) bg-white hover:border-(--earist-primary)/40 hover:bg-(--earist-surface-gray)/40"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-bold text-(--earist-primary)">
                        {entry.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-(--earist-body-text)">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{entry.author ?? "Unknown Author"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-(--earist-body-text)">
                      <BookOpen className="h-3 w-3 shrink-0" />
                      <span className="truncate">{entry.program ?? "Program unspecified"}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
                      <span className="text-[11px] text-gray-500">
                        {formatDate(entry.archiveRegisteredAt)}
                      </span>
                      {getStatusBadge(entry.publication.isPublished)}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredEntries.length === 0 && (
              <div className="rounded-xl border border-dashed border-(--earist-border-gray) p-8 text-center text-sm text-(--earist-body-text)">
                No archives match your current filters.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Entry Inspection & Management */}
        {selectedEntryData ? (
          <div className="space-y-6 lg:col-span-2">
            {/* Header / Actions Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-(--earist-primary)">
                      Archive Details & Publication
                    </CardTitle>
                    <p className="text-xs text-(--earist-body-text)">
                      Review manuscript elements, edit metadata, and publish to the repository.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(selectedEntryData)}
                      className="border-(--earist-primary) text-(--earist-primary) hover:bg-(--earist-surface-light-red)"
                    >
                      <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                      Edit Metadata
                    </Button>

                    {!selectedEntryData.publication.isPublished ? (
                      <Button
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => publishMutation.mutate(selectedEntryData.id)}
                        disabled={publishMutation.isPending}
                      >
                        {publishMutation.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Publish Metadata
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-400 text-amber-700 hover:bg-amber-50"
                        onClick={() => unpublishMutation.mutate(selectedEntryData.id)}
                        disabled={unpublishMutation.isPending}
                      >
                        {unpublishMutation.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <GlobeLock className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Unpublish
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-(--earist-surface-gray)/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-(--earist-primary)">
                      {selectedEntryData.title}
                    </h3>
                    {getStatusBadge(selectedEntryData.publication.isPublished)}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs text-(--earist-body-text)">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-(--earist-secondary)" />
                      <span className="font-medium text-gray-900">{selectedEntryData.author ?? "Unknown"}</span>
                      {selectedEntryData.studentNumber && (
                        <span className="text-gray-500">({selectedEntryData.studentNumber})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-(--earist-secondary)" />
                      <span>{selectedEntryData.program ?? "Unspecified program"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-(--earist-secondary)" />
                      <span>Archived: {formatDate(selectedEntryData.archiveRegisteredAt) ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-(--earist-secondary)" />
                      <span>
                        Published: {formatDate(selectedEntryData.publication.publishedAt) ?? "Not published"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Abstract Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-(--earist-secondary)">
                      Official Abstract
                    </Label>
                    <span className="text-xs text-gray-500">
                      {countWords(selectedEntryData.abstract ?? "")} words
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-(--earist-border-gray) bg-white p-3 text-sm leading-relaxed text-(--earist-body-text)">
                    {selectedEntryData.abstract || (
                      <span className="italic text-gray-400">No abstract provided for this submission.</span>
                    )}
                  </div>
                </div>

                {/* Keywords Section */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-(--earist-secondary)">
                    Indexed Keywords
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEntryData.keywords.length > 0 ? (
                      selectedEntryData.keywords.map((keyword, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="border-(--earist-border-gray) bg-gray-50 text-xs text-(--earist-body-text)"
                        >
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs italic text-gray-400">No keywords specified.</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Archival Payload Inspection Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-(--earist-secondary)">
                  Archival Payload Verification (4 Required Elements)
                </CardTitle>
                <p className="text-xs text-(--earist-body-text)">
                  Verify the post-defense final manuscript, certifications, research instruments, and raw respondent datasets.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 1. Final Manuscript */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-(--earist-border-gray) bg-white p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-(--earist-primary)">
                          Approved Final Manuscript (Chapters 1–5)
                        </p>
                        {selectedEntryData.hasManuscript ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">
                            Available
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">
                            Not uploaded
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-(--earist-body-text)">
                        Final post-defense revised manuscript approved by the advisory panel.
                      </p>
                    </div>
                  </div>

                  {selectedEntryData.hasManuscript && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleOpenViewer(
                            `/api/documents/elibrary-manuscript/${selectedEntryData.id}/file`,
                            `Approved Final Manuscript - ${selectedEntryData.title}`,
                          )
                        }
                        className="text-xs"
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Preview PDF
                      </Button>
                      <a
                        href={`/api/documents/elibrary-manuscript/${selectedEntryData.id}/file`}
                        download
                        className={cn(
                          buttonVariants({ variant: "secondary", size: "sm" }),
                          "text-xs inline-flex items-center",
                        )}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  )}
                </div>

                {/* 2. Respondent Data (DPA Protected) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-amber-900">
                          Respondent Data (Survey Forms, Questionnaires, Raw Data)
                        </p>
                        {selectedEntryData.hasRespondentData ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                            Restricted Dataset
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[10px]">
                            Not Provided
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-amber-800">
                        Strictly restricted to Graduate School Administrators and the original researcher (Data Privacy Act compliance).
                      </p>
                    </div>
                  </div>

                  {selectedEntryData.hasRespondentData && (
                    <a
                      href={`/api/documents/elibrary-respondent-data/${selectedEntryData.id}/file`}
                      download
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "border-amber-300 text-amber-900 hover:bg-amber-100 text-xs shrink-0 inline-flex items-center",
                      )}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download Dataset
                    </a>
                  )}
                </div>

                {/* 3. Research Certifications & Instruments */}
                <div className="rounded-lg border border-(--earist-border-gray) bg-white p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-(--earist-primary)">
                      Research Instruments & Certifications
                    </p>
                    <span className="text-xs text-gray-500">
                      {selectedEntryData.documents?.length ?? 0} attached files
                    </span>
                  </div>

                  {selectedEntryData.documents && selectedEntryData.documents.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {selectedEntryData.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <FileCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-800">
                                {doc.originalFilename ?? "Document"}
                              </p>
                              <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                                <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                  {doc.docType}
                                </Badge>
                                <span>{formatFileSize(doc.sizeBytes)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {doc.verifiedMimeType === "application/pdf" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleOpenViewer(
                                    `/api/documents/thesis-document/${doc.id}/file`,
                                    doc.originalFilename ?? "Document Preview",
                                  )
                                }
                                className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50"
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                View
                              </Button>
                            )}
                            <a
                              href={`/api/documents/thesis-document/${doc.id}/file`}
                              download={doc.originalFilename ?? undefined}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                                "h-7 px-2 text-xs text-(--earist-primary) hover:bg-(--earist-surface-light-red) inline-flex items-center",
                              )}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-gray-400 py-1">
                      No additional instrument or certification documents attached to this record.
                    </p>
                  )}
                </div>

                {/* Audit & Compliance Footer Notice */}
                <div className="flex items-start gap-2 rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
                  <Lock className="h-4 w-4 shrink-0 text-(--earist-secondary) mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-800">Institutional Audit Trail (NFR7 Compliance): </span>
                    All metadata edits, publication status toggles, and archival submissions are immutably logged with
                    administrator identification and timestamps. Public indexing exposes metadata and abstracts only; raw datasets are permanently shielded.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                    <Library className="h-8 w-8 text-(--earist-body-text)/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                    Select an Archival Record
                  </h3>
                  <p className="max-w-md text-sm text-(--earist-body-text)">
                    Select any submission from the queue on the left to inspect its uploaded manuscript, certifications,
                    research instruments, respondent dataset, and manage its publication status.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Metadata Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-(--earist-primary)">
              Edit Research Metadata
            </DialogTitle>
            <DialogDescription className="text-xs text-(--earist-body-text)">
              Correct typographical errors, title formatting, abstract wording, or keywords. Changes are permanently
              logged in the audit trail (<code className="font-mono text-[11px] bg-gray-100 px-1 py-0.5 rounded">REPOSITORY_METADATA_UPDATED</code>).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title" className="text-xs font-semibold text-(--earist-primary)">
                Research Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-title"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="Enter complete research title"
                className="text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-abstract" className="text-xs font-semibold text-(--earist-primary)">
                  Official Abstract
                </Label>
                <span
                  className={`text-xs ${
                    countWords(editingAbstract) < 150
                      ? "text-amber-600 font-medium"
                      : "text-emerald-600 font-medium"
                  }`}
                >
                  {countWords(editingAbstract)} words (recommended: &ge; 150)
                </span>
              </div>
              <Textarea
                id="edit-abstract"
                rows={7}
                value={editingAbstract}
                onChange={(e) => setEditingAbstract(e.target.value)}
                placeholder="Paste or edit the official research abstract..."
                className="text-sm leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-keywords" className="text-xs font-semibold text-(--earist-primary)">
                Keywords (comma-separated)
              </Label>
              <Input
                id="edit-keywords"
                value={editingKeywords}
                onChange={(e) => setEditingKeywords(e.target.value)}
                placeholder="e.g. Higher Education, Educational Technology, Quantitative Analysis"
                className="text-sm"
              />
              <p className="text-[11px] text-gray-500">
                Separate keywords with commas. At least 3 descriptive terms recommended for catalog indexing.
              </p>

              {/* Live Keyword Preview */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {editingKeywords
                  .split(",")
                  .map((k) => k.trim())
                  .filter((k) => k.length > 0)
                  .map((keyword, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-(--earist-border-gray) bg-gray-50 text-xs"
                    >
                      {keyword}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={updateMetadataMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMetadata}
              disabled={updateMetadataMutation.isPending || !editingTitle.trim()}
              className="bg-(--earist-primary) text-white hover:bg-(--earist-primary-dark)"
            >
              {updateMetadataMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Saving Changes…
                </>
              ) : (
                "Save Metadata"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Document Viewer Modal */}
      <DocumentViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        fetchUrl={viewerUrl}
        title={viewerTitle}
      />
    </div>
  );
}
