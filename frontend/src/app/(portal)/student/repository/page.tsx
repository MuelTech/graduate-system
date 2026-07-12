"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Library, Search, Filter, Download, Calendar, User,
  BookOpen, FileText, ChevronDown, ChevronUp, Copy, Upload,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { BackendEntry } from "@/types";

type PublicEntry = {
  id: string;
  title: string;
  author: string;
  program: string;
  year: number;
  abstract: string;
  keywords: string[];
  datePublished: string | null;
  downloadAllowed: boolean;
  citation: string;
};

export default function StudentRepositoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: publicData, isLoading } = useQuery({
    queryKey: ["public-databank"],
    queryFn: async () => {
      const res = await apiClientRequest("/databank/search/public");
      return res || [];
    },
  });

  // Map our backend data to match the UI expectations and automatically generate APA citations
  const researchEntries: PublicEntry[] = (publicData || []).map((d: BackendEntry) => {
    const authorName = d.thesis?.student?.user 
      ? `${d.thesis.student.user.firstName} ${d.thesis.student.user.lastName}` 
      : "Unknown Author";
    const date = d.publishedAt ? new Date(d.publishedAt) : new Date();
    
    // Simple mock formatting for the citation (Author Last Name, First Initial)
    const nameParts = authorName.split(" ");
    const lastName = nameParts[nameParts.length - 1];
    const firstInitial = nameParts[0].charAt(0);
    
    return {
      id: d.id,
      title: d.title,
      author: authorName,
      program: d.thesis?.student?.program?.programName || "Unknown Program",
      year: date.getFullYear(),
      abstract: d.abstract || "No abstract provided.",
      keywords: d.keywords ? d.keywords.split(",").map(k => k.trim()) : [],
      datePublished: date.toLocaleDateString(),
      downloadAllowed: true, // Assuming public entries are downloadable
      citation: `${lastName}, ${firstInitial}. (${date.getFullYear()}). ${d.title}. EARIST Graduate School Repository.`,
    };
  });

  const filteredEntries = researchEntries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (programFilter !== "all" && entry.program !== programFilter) return false;
    if (yearFilter !== "all" && entry.year !== parseInt(yearFilter)) return false;

    return true;
  });

  const programs = Array.from(new Set(researchEntries.map((e) => e.program)));
  const years = Array.from(new Set(researchEntries.map((e) => e.year))).sort((a, b) => b - a);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Public Repository...</div>;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)" style={{ fontFamily: '"Calibri", sans-serif' }}>
            Research Repository
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Browse published graduate research from EARIST
          </p>
        </div>
        
        <Link href="/student/repository/submit">
          <Button className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90">
            <Upload className="mr-2 h-4 w-4" />
            Submit to Databank
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="flex gap-2">
        <Badge className="bg-(--earist-surface-gray) text-(--earist-body-text)">
          {researchEntries.length} publications
        </Badge>
        <Badge className="bg-green-100 text-green-700">
          {researchEntries.filter((e) => e.downloadAllowed).length} downloadable
        </Badge>
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
                placeholder="Search by title, author, or keyword..."
                className="w-full rounded-lg border border-(--earist-border-gray) py-2 pr-3 pl-10 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:ring-2 focus:ring-(--earist-primary)/20 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-(--earist-body-text)" />
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Programs</option>
                {programs.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Research Entries */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--earist-surface-gray)">
                  <Library className="h-8 w-8 text-(--earist-body-text)/40" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">No Results Found</h3>
                <p className="text-sm text-(--earist-body-text)">Try adjusting your search or filters.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <Card key={entry.id}>
                <CardContent className="p-0">
                  <button onClick={() => toggleExpand(entry.id)} className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-(--earist-surface-gray)">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--earist-surface-light-red)">
                      <FileText className="h-5 w-5 text-(--earist-primary)" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-(--earist-primary)">{entry.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--earist-body-text)">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{entry.author}</span>
                        <span>&middot;</span><span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{entry.program}</span>
                        <span>&middot;</span><span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{entry.datePublished}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.keywords.slice(0, 3).map((keyword, i) => (
                          <Badge key={i} variant="outline" className="text-[11px]">{keyword}</Badge>
                        ))}
                        {entry.keywords.length > 3 && <Badge variant="outline" className="text-[11px]">+{entry.keywords.length - 3} more</Badge>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-(--earist-body-text)" /> : <ChevronDown className="h-5 w-5 text-(--earist-body-text)" />}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-(--earist-border-gray) px-4 py-4">
                      <div className="space-y-4">
                        <div>
                          <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">Abstract</p>
                          <p className="text-sm text-(--earist-body-text)">{entry.abstract}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">Keywords</p>
                          <div className="flex flex-wrap gap-1">
                            {entry.keywords.map((keyword, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{keyword}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold text-(--earist-secondary)">Citation</p>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(entry.citation); }}
                              className="flex items-center gap-1 text-xs text-(--earist-body-text) hover:text-(--earist-primary)"
                            >
                              <Copy className="h-3 w-3" /> Copy
                            </button>
                          </div>
                          <p className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text) italic">
                            {entry.citation}
                          </p>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-(--earist-surface-gray) p-3">
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-(--earist-body-text)" />
                            <span className="text-sm text-(--earist-body-text)">
                              {entry.downloadAllowed ? "Full manuscript download available" : "Download restricted by author"}
                            </span>
                          </div>
                          {entry.downloadAllowed ? (
                            <Button size="sm" className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90">
                              <Download className="mr-1 h-3 w-3" /> Download PDF
                            </Button>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500">Restricted</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
