"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
  Library,
  Search,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClientRequest } from "@/lib/api.client";
import type { RepositoryPublication } from "@/types";

/**
 * DL-10: shared Research Repository browser.
 *
 * Consumes the canonical public `/repository` projection only. The same safe
 * payload is used by the public, Student, and Panelist pages — there is no
 * role-based escalation and no full-text download button, because the
 * publication artifact policy is unresolved.
 */
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

export function RepositoryBrowser({
  title = "Research Repository",
  description = "Browse published graduate research metadata from EARIST.",
  headerAction,
}: RepositoryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
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
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={programFilter}
                onChange={(event) => setProgramFilter(event.target.value)}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
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
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <p className="py-8 text-center text-sm text-(--earist-body-text)">
          Loading published research…
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
                  : "Try adjusting your search or filters."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && filteredEntries.length > 0 && (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const publishedDate = formatPublishedDate(entry.publishedAt);
            return (
              <Card key={entry.id}>
                <CardContent className="p-0">
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : entry.id)
                    }
                    className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-(--earist-surface-gray)"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--earist-surface-light-red)">
                      <FileText className="h-5 w-5 text-(--earist-primary)" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-(--earist-primary)">
                        {entry.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--earist-body-text)">
                        {entry.author && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {entry.author}
                          </span>
                        )}
                        {entry.program && (
                          <>
                            <span>&middot;</span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {entry.program}
                            </span>
                          </>
                        )}
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {publishedDate ?? "Publication date unavailable"}
                        </span>
                      </div>
                      {entry.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.keywords.slice(0, 3).map((keyword, index) => (
                            <Badge
                              key={`${keyword}-${index}`}
                              variant="outline"
                              className="text-[11px]"
                            >
                              {keyword}
                            </Badge>
                          ))}
                          {entry.keywords.length > 3 && (
                            <Badge variant="outline" className="text-[11px]">
                              +{entry.keywords.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-(--earist-body-text)" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-(--earist-body-text)" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-(--earist-border-gray) px-4 py-4">
                      <div className="space-y-4">
                        <div>
                          <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                            Abstract
                          </p>
                          <p className="text-sm text-(--earist-body-text)">
                            {entry.abstract ?? "No abstract provided."}
                          </p>
                        </div>
                        {entry.keywords.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                              Keywords
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {entry.keywords.map((keyword, index) => (
                                <Badge
                                  key={`${keyword}-${index}`}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
                          {entry.artifact.available
                            ? "Full-text download available."
                            : "Full-text download unavailable."}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
