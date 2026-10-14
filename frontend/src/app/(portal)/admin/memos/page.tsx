"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  Plus,
  Send,
  Clock,
  Users,
  X,
  FileText,
  Upload,
  Archive,
  Download,
  Search,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

interface Memo {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  attachmentUrl?: string | null;
  isArchived: boolean;
  createdAt: string;
  program?: {
    programName: string;
  };
}

export default function AdminMemosPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isComposing, setIsComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [programId, setProgramId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");

  const { data: memos = [], isLoading } = useQuery<Memo[]>({
    queryKey: ["admin-memos"],
    queryFn: async () => await apiClientRequest("/memos"),
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const res = await apiClientRequest("/programs");
      return res.graduatePrograms || [];
    },
  });

  // Broadcast Mutation (supports Multipart FormData for PDF attachments)
  const publishMemo = useMutation({
    mutationFn: async () => {
      const session = await getSession();
      const token = session?.user?.accessToken;
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5000";

      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);
      formData.append("targetAudience", audience);
      if (audience === "PROGRAM" && programId) {
        formData.append("programId", programId);
      }
      if (selectedFile) {
        formData.append("attachment", selectedFile);
      }

      const res = await fetch(`${apiUrl}/api/memos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to broadcast memo");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-memos"] });
      setIsComposing(false);
      setTitle("");
      setContent("");
      setAudience("ALL");
      setProgramId("");
      setSelectedFile(null);
    },
    onError: (err: Error) => {
      alert(`Error broadcasting memo: ${err.message}`);
    },
  });

  // Archive Mutation (Audit Compliant)
  const archiveMemo = useMutation({
    mutationFn: async (id: string) => {
      return await apiClientRequest(`/memos/${id}/archive`, {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-memos"] });
    },
    onError: (err: Error) => {
      alert(`Error archiving memo: ${err.message}`);
    },
  });

  const handleArchive = (id: string, memoTitle: string) => {
    if (
      window.confirm(
        `Are you sure you want to archive "${memoTitle}"?\n\nThis will remove it from student and panelist portals and record an immutable audit log entry.`
      )
    ) {
      archiveMemo.mutate(id);
    }
  };

  const filteredMemos = useMemo(() => {
    return memos.filter((m) => {
      // Status filter
      if (statusFilter === "ACTIVE" && m.isArchived) return false;
      if (statusFilter === "ARCHIVED" && !m.isArchived) return false;

      // Search keyword filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          m.title.toLowerCase().includes(term) ||
          m.content.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [memos, statusFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            Announcements & Memos
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Broadcast official circulars and notices via portal and email.
          </p>
        </div>
        {!isComposing && (
          <Button
            onClick={() => setIsComposing(true)}
            className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90 shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" /> Compose Memo
          </Button>
        )}
      </div>

      {/* Compose Card */}
      {isComposing && (
        <Card className="border-(--earist-accent) shadow-md">
          <CardHeader className="bg-(--earist-surface-gray) pb-4 flex flex-row items-center justify-between rounded-t-xl">
            <CardTitle className="text-lg font-bold text-(--earist-primary) flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-(--earist-accent)" /> New Broadcast
            </CardTitle>
            <button
              onClick={() => {
                setIsComposing(false);
                setSelectedFile(null);
              }}
              className="text-(--earist-body-text) hover:text-(--earist-primary)"
            >
              <X className="h-5 w-5" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {/* Audience Target */}
            <div>
              <label className="text-xs font-bold text-(--earist-secondary) uppercase tracking-wider mb-1 block">
                Audience Target
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="rounded-lg border border-(--earist-border-gray) p-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) outline-none w-full sm:w-1/3"
                >
                  <option value="ALL">Everyone (All Users)</option>
                  <option value="STUDENTS">All Students</option>
                  <option value="PANELISTS">All Panelists</option>
                  <option value="PROGRAM">Specific Academic Program</option>
                </select>
                {audience === "PROGRAM" && (
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="rounded-lg border border-(--earist-border-gray) p-2 text-sm text-(--earist-body-text) w-full sm:w-2/3"
                  >
                    <option value="">Select a Program...</option>
                    {programs.map((p: { id: string; programName: string }) => (
                      <option key={p.id} value={p.id}>
                        {p.programName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Memo Title */}
            <div>
              <label className="text-xs font-bold text-(--earist-secondary) uppercase tracking-wider mb-1 block">
                Memo Title
              </label>
              <input
                type="text"
                placeholder="e.g., GS Memorandum No. 12: Defense Application Guidelines"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-sm focus:border-(--earist-primary) outline-none"
              />
            </div>

            {/* Memo Content */}
            <div>
              <label className="text-xs font-bold text-(--earist-secondary) uppercase tracking-wider mb-1 block">
                Memo Content
              </label>
              <textarea
                placeholder="Write the full content of the memo or summary of the circular here..."
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-lg border border-(--earist-border-gray) p-3 text-sm focus:border-(--earist-primary) outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Optional PDF Circular Upload */}
            <div>
              <label className="text-xs font-bold text-(--earist-secondary) uppercase tracking-wider mb-1 block">
                Attach Official Circular (Optional PDF)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    if (file.type !== "application/pdf") {
                      alert("Only PDF documents are permitted for memo circulars.");
                      return;
                    }
                    setSelectedFile(file);
                  }
                }}
              />

              {!selectedFile ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-dashed border-(--earist-border-gray) hover:border-(--earist-primary) py-6 flex flex-col items-center justify-center gap-1 text-(--earist-body-text)"
                >
                  <Upload className="h-5 w-5 text-(--earist-accent)" />
                  <span className="text-xs font-medium">
                    Click to attach official PDF circular (Max 10MB)
                  </span>
                </Button>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
                  <div className="flex items-center gap-2 text-sm text-(--earist-primary)">
                    <FileText className="h-4 w-4 text-(--earist-accent)" />
                    <span className="font-semibold">{selectedFile.name}</span>
                    <span className="text-xs text-(--earist-secondary)">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-red-500 hover:text-red-700 h-7 px-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-(--earist-border-gray)">
              <Button
                variant="outline"
                onClick={() => {
                  setIsComposing(false);
                  setSelectedFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => publishMemo.mutate()}
                disabled={
                  !title ||
                  !content ||
                  (audience === "PROGRAM" && !programId) ||
                  publishMemo.isPending
                }
                className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
              >
                <Send className="mr-2 h-4 w-4" />
                {publishMemo.isPending ? "Broadcasting..." : "Publish Broadcast"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Broadcast History Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4">
        <h3 className="text-sm font-bold text-(--earist-secondary) uppercase tracking-wider">
          Broadcast History ({filteredMemos.length})
        </h3>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {/* Status Filter */}
           <select
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "ARCHIVED")
            }
            className="rounded-lg border border-(--earist-border-gray) bg-white p-2 text-xs text-(--earist-body-text) outline-none"
          >
            <option value="ALL">All Memos</option>
            <option value="ACTIVE">Active Only</option>
            <option value="ARCHIVED">Archived Only</option>
          </select>

          {/* Search */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--earist-secondary)" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-(--earist-border-gray) bg-white pl-8 pr-3 py-1.5 text-xs text-(--earist-body-text) outline-none focus:border-(--earist-primary)"
            />
          </div>
        </div>
      </div>

      {/* History List */}
      {isLoading ? (
        <p className="text-sm text-center py-10 text-(--earist-body-text)">
          Loading history...
        </p>
      ) : filteredMemos.length === 0 ? (
        <Card className="bg-(--earist-surface-gray) border-none">
          <CardContent className="flex flex-col items-center py-12">
            <Megaphone className="h-10 w-10 text-(--earist-body-text)/30 mb-3" />
            <p className="text-sm font-bold text-(--earist-secondary)">
              No memos found
            </p>
            <p className="text-xs text-(--earist-body-text)">
              {searchTerm || statusFilter !== "ALL"
                ? "No memos match your active filters."
                : "No memos have been published yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMemos.map((memo) => (
            <Card
              key={memo.id}
              className={`overflow-hidden hover:shadow-md transition-shadow border-(--earist-border-gray) ${
                memo.isArchived ? "opacity-75 bg-gray-50/50" : ""
              }`}
            >
              <CardContent className="p-0 flex flex-col sm:flex-row">
                {/* Date Sidebar */}
                <div
                  className={`p-4 flex flex-col justify-center items-center w-full sm:w-32 sm:border-r border-(--earist-border-gray) ${
                    memo.isArchived
                      ? "bg-gray-100 text-gray-500"
                      : "bg-(--earist-surface-light-red)"
                  }`}
                >
                  <Clock
                    className={`h-5 w-5 mb-1 ${
                      memo.isArchived ? "text-gray-400" : "text-(--earist-primary)"
                    }`}
                  />
                  <span
                    className={`text-xs font-bold ${
                      memo.isArchived ? "text-gray-600" : "text-(--earist-primary)"
                    }`}
                  >
                    {new Date(memo.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Details */}
                <div className="p-4 sm:p-5 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`font-bold text-lg ${
                          memo.isArchived ? "text-gray-600 line-through" : "text-(--earist-primary)"
                        }`}
                      >
                        {memo.title}
                      </h4>
                      {memo.isArchived && (
                        <Badge variant="outline" className="text-[10px] bg-gray-200 text-gray-700">
                          Archived
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {memo.attachmentUrl && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-red-50 text-(--earist-primary) border-(--earist-accent) flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" /> PDF Attached
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] bg-white">
                        <Users className="h-3 w-3 mr-1 inline" />
                        {memo.targetAudience}
                        {memo.program ? ` (${memo.program.programName})` : ""}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-(--earist-body-text) whitespace-pre-wrap leading-relaxed mb-4">
                    {memo.content}
                  </p>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-(--earist-border-gray) flex flex-wrap justify-between items-center gap-2">
                    <div>
                      {memo.attachmentUrl && (
                        <a
                          href={`/api/documents/memo/${memo.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-(--earist-primary) text-(--earist-primary) hover:bg-(--earist-surface-light-red)"
                          >
                            <Download className="h-3 w-3" /> View Circular
                          </Button>
                        </a>
                      )}
                    </div>

                    {!memo.isArchived && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(memo.id, memo.title)}
                        disabled={archiveMemo.isPending}
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-1"
                      >
                        <Archive className="h-3 w-3" /> Archive Memo
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
