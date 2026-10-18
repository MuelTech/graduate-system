"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Filter,
  Library,
  Lock,
  Quote,
  Search,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { CitationModal } from "@/components/repository/citation-modal";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import type { RepositoryPublication } from "@/types";

export interface RepositoryBrowserProps {
  title?: string;
  description?: string;
  /** Optional page action (e.g. the Student "Databank Archive" link). */
  headerAction?: ReactNode;
}

function formatPublishedDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

/**
 * DL-10 & Phase 10: Research Repository Browser.
 *
 * Provides a discovery surface for published graduate theses and dissertations:
 * 1. Public guests: View metadata, abstracts, and academic citations. Full-text
 *    downloads require institutional sign-in.
 * 2. Authenticated users: Can preview and stream approved final manuscripts.
 * 3. Authoring student & Admin: Granted access to restricted respondent datasets
 *    under Data Privacy Act compliance.
 */
export function RepositoryBrowser({
  title = "Research Repository",
  description = "Browse published graduate research metadata from EARIST.",
  headerAction,
}: RepositoryBrowserProps) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Citation Modal State
  const [citationEntry, setCitationEntry] = useState<RepositoryPublication | null>(null);
  const [citationOpen, setCitationOpen] = useState(false);

  // Document Viewer State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["repository-public", searchQuery],
    queryFn: async () =>
      (await apiClientRequest(
        searchQuery
          ? `/repository?q=${encodeURIComponent(searchQuery)}`
          : "/repository",
      )) as RepositoryPublication[],
  });

  const entries: RepositoryPublication[] = useMemo(() => data ?? [], [data]);

  const programs = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((entry) => entry.program)
            .filter((program): program is string => Boolean(program)),
        ),
      ).sort(),
    [entries],
  );

  const years = useMemo(() => {
    const values = new Set<number>();
    for (const entry of entries) {
      if (!entry.publishedAt) continue;
      const date = new Date(entry.publishedAt);
      if (!Number.isNaN(date.getTime())) values.add(date.getFullYear());
    }
    return Array.from(values).sort((a, b) => b - a);
  }, [entries]);

  const filteredEntries = entries.filter((entry) => {
    if (programFilter !== "all" && entry.program !== programFilter) return false;
    if (yearFilter !== "all") {
      const date = entry.publishedAt ? new Date(entry.publishedAt) : null;
      if (!date || Number.isNaN(date.getTime())) return false;
      if (date.getFullYear() !== Number.parseInt(yearFilter, 10)) return false;
    }
    return true;
  });

  const hasActiveFilters = searchQuery !== "" || programFilter !== "all" || yearFilter !== "all";

  const handleClearFilters = () => {
    setSearchQuery("");
    setProgramFilter("all");
    setYearFilter("all");
  };

  const handleOpenCitation = (entry: RepositoryPublication, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCitationEntry(entry);
    setCitationOpen(true);
  };

  const handleOpenViewer = (url: string, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setViewerUrl(url);
    setViewerTitle(title);
    setViewerOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            {title}
          </h2>
          <p className="text-sm text-(--earist-body-text)">{description}</p>
        </div>
        {headerAction}
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title, author, program, or keyword..."
                className="w-full rounded-lg border border-(--earist-border-gray) py-2 pr-3 pl-10 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={programFilter}
                onChange={(event) => setProgramFilter(event.target.value)}
                className="rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Programs</option>
                {programs.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="rounded-lg border border-(--earist-border-gray) bg-white px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-xs text-(--earist-primary) hover:bg-(--earist-surface-light-red)"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count Banner */}
      {!isLoading && !isError && entries.length > 0 && (
        <div className="flex items-center justify-between text-xs text-(--earist-body-text) px-1">
          <span>
            Showing <strong className="text-gray-900">{filteredEntries.length}</strong> of{" "}
            <strong>{entries.length}</strong> published researches
          </span>
          {!isAuthenticated && (
            <span className="flex items-center gap-1 text-amber-700">
              <Lock className="h-3 w-3" />
              Sign-in required for full-text downloads
            </span>
          )}
        </div>
      )}

      {isLoading && (
        <p className="py-12 text-center text-sm text-(--earist-body-text)">
          Loading published research catalog…
        </p>
      )}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600">
            Unable to load the Research Repository. Please try again later.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && filteredEntries.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                <Library className="h-8 w-8 text-(--earist-body-text)/40" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                {entries.length === 0 ? "No Published Research Yet" : "No Results Found"}
              </h3>
              <p className="text-sm text-(--earist-body-text)">
                {entries.length === 0
                  ? "Published research metadata will appear here once the Graduate School publishes it."
                  : "Try adjusting your search query or filter selections."}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="mt-4 text-xs"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && filteredEntries.length > 0 && (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const publishedDate = formatPublishedDate(entry.publishedAt);
            const canDownload = entry.canDownloadManuscript || (isAuthenticated && Boolean(entry.downloadUrl));
            const downloadLink = entry.downloadUrl ?? `/api/documents/elibrary-manuscript/${entry.id}/file`;

            return (
              <Card
                key={entry.id}
                className={`transition-all ${
                  isExpanded ? "ring-1 ring-(--earist-primary)/20 shadow-sm" : "hover:border-gray-300"
                }`}
              >
                <CardContent className="p-0">
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="flex w-full cursor-pointer items-start gap-4 p-4 text-left transition-colors hover:bg-(--earist-surface-gray)/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--earist-surface-light-red)">
                      <FileText className="h-5 w-5 text-(--earist-primary)" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <p className="text-sm font-bold text-(--earist-primary) hover:underline">
                          {entry.title}
                        </p>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--earist-body-text)">
                        {entry.author && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-(--earist-secondary)" />
                            <strong className="text-gray-800">{entry.author}</strong>
                          </span>
                        )}
                        {entry.program && (
                          <>
                            <span>&middot;</span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3 text-(--earist-secondary)" />
                              {entry.program}
                            </span>
                          </>
                        )}
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-(--earist-secondary)" />
                          {publishedDate ?? "Published"}
                        </span>
                      </div>

                      {entry.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.keywords.slice(0, 4).map((keyword, index) => (
                            <Badge
                              key={`${keyword}-${index}`}
                              variant="outline"
                              className="text-[11px] bg-gray-50 border-(--earist-border-gray)"
                            >
                              {keyword}
                            </Badge>
                          ))}
                          {entry.keywords.length > 4 && (
                            <Badge variant="outline" className="text-[11px] bg-gray-50">
                              +{entry.keywords.length - 4} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleOpenCitation(entry, e)}
                        className="h-8 px-2 text-xs text-(--earist-secondary) hover:bg-(--earist-surface-gray)"
                        title="Cite this research"
                      >
                        <Quote className="h-3.5 w-3.5 mr-1" />
                        <span className="hidden sm:inline">Cite</span>
                      </Button>
                      <div className="text-(--earist-body-text) p-1">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-(--earist-border-gray) bg-gray-50/40 px-5 py-4 space-y-4">
                      {/* Abstract */}
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-(--earist-secondary)">
                          Official Abstract
                        </p>
                        <p className="rounded-lg border border-(--earist-border-gray) bg-white p-3 text-sm leading-relaxed text-(--earist-body-text)">
                          {entry.abstract ?? "No abstract provided."}
                        </p>
                      </div>

                      {/* Keywords */}
                      {entry.keywords.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-(--earist-secondary)">
                            Indexed Keywords
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.keywords.map((keyword, index) => (
                              <Badge
                                key={`${keyword}-${index}`}
                                variant="outline"
                                className="text-xs bg-white border-(--earist-border-gray)"
                              >
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Access & Download Actions */}
                      <div className="pt-2 border-t border-gray-200/80 space-y-3">
                        {/* 1. Manuscript Full-Text Download / Gate */}
                        {entry.hasManuscript ? (
                          canDownload ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50/50 p-3.5">
                              <div className="flex items-start gap-2.5">
                                <FileText className="h-4 w-4 shrink-0 text-green-700 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-green-950">
                                    Approved Final Manuscript (Full Text)
                                  </p>
                                  <p className="text-xs text-green-800">
                                    Complete Chapters 1–5 post-defense manuscript available for academic reading.
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) =>
                                    handleOpenViewer(
                                      downloadLink,
                                      `Approved Manuscript - ${entry.title}`,
                                      e,
                                    )
                                  }
                                  className="text-xs h-8 border-green-300 text-green-900 hover:bg-green-100 bg-white"
                                >
                                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                                  Preview PDF
                                </Button>
                                <a
                                  href={downloadLink}
                                  download
                                  className={cn(
                                    buttonVariants({ variant: "default", size: "sm" }),
                                    "text-xs h-8 bg-green-700 hover:bg-green-800 text-white inline-flex items-center",
                                  )}
                                >
                                  <Download className="mr-1.5 h-3.5 w-3.5" />
                                  Download PDF
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5">
                              <div className="flex items-start gap-2.5">
                                <Lock className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-amber-950">
                                    Full-Text Manuscript Available (Institutional Sign-in Required)
                                  </p>
                                  <p className="text-xs text-amber-800">
                                    Per EARIST policy, digital manuscripts are restricted to authenticated students, faculty, and alumni.
                                  </p>
                                </div>
                              </div>

                              <Link
                                href="/login?callbackUrl=/repository"
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "border-amber-300 bg-white text-amber-900 hover:bg-amber-100 text-xs shrink-0 whitespace-nowrap inline-flex items-center",
                                )}
                              >
                                Sign In to Download
                              </Link>
                            </div>
                          )
                        ) : (
                          <div className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
                            Full-text manuscript has not been archived for public download.
                          </div>
                        )}

                        {/* 2. Respondent Data Download (Strictly Owner/Admin) */}
                        {entry.canDownloadRespondentData && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3.5">
                            <div className="flex items-start gap-2.5">
                              <ShieldAlert className="h-4 w-4 shrink-0 text-blue-700 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-blue-950">
                                  Restricted Respondent Dataset
                                </p>
                                <p className="text-xs text-blue-800">
                                  Authorized under Data Privacy Act compliance (Researcher / GS Administrator access).
                                </p>
                              </div>
                            </div>

                            <a
                              href={
                                entry.respondentDataUrl ??
                                `/api/documents/elibrary-respondent-data/${entry.id}/file`
                              }
                              download
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "border-blue-300 bg-white text-blue-900 hover:bg-blue-100 text-xs shrink-0 inline-flex items-center",
                              )}
                            >
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                              Download Dataset
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Citation Modal */}
      <CitationModal
        entry={citationEntry}
        open={citationOpen}
        onOpenChange={setCitationOpen}
      />

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
