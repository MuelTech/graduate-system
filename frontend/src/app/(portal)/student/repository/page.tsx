"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Library,
  Search,
  Filter,
  Eye,
  Download,
  Calendar,
  User,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";

export default function StudentRepositoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const researchEntries = [
    {
      id: 1,
      title:
        "Machine Learning Approaches for Early Detection of Student Academic Risk",
      author: "Maria Santos",
      program: "MSCS",
      year: 2026,
      abstract:
        "This study explores the application of machine learning algorithms for early detection of students at academic risk. Using historical academic data from EARIST, the researchers developed a predictive model that identifies at-risk students with 87% accuracy. The system analyzes factors including attendance patterns, quiz scores, and assignment submission timeliness to generate early warnings for academic advisors. Results show that early intervention based on the model's predictions improved student retention by 15%.",
      keywords: [
        "machine learning",
        "academic risk",
        "prediction",
        "student performance",
        "early detection",
      ],
      datePublished: "May 28, 2026",
      downloadAllowed: true,
      citation:
        "Santos, M. (2026). Machine Learning Approaches for Early Detection of Student Academic Risk. EARIST Graduate School Repository.",
    },
    {
      id: 2,
      title: "Effectiveness of Blended Learning in Graduate Education",
      author: "Elena Torres",
      program: "MSCS",
      year: 2026,
      abstract:
        "This research investigates the effectiveness of blended learning approaches in graduate-level computer science courses. The study compared student outcomes between traditional face-to-face instruction and blended learning formats across three graduate programs at EARIST. Results indicate that blended learning improved student engagement by 23% and course completion rates by 15%. The study also identifies best practices for implementing blended learning in graduate education.",
      keywords: [
        "blended learning",
        "graduate education",
        "online learning",
        "student engagement",
      ],
      datePublished: "June 1, 2026",
      downloadAllowed: true,
      citation:
        "Torres, E. (2026). Effectiveness of Blended Learning in Graduate Education. EARIST Graduate School Repository.",
    },
    {
      id: 3,
      title: "Blockchain for Academic Credential Verification",
      author: "Carlos Luna",
      program: "PhD Education",
      year: 2026,
      abstract:
        "This research proposes a blockchain-based system for secure and tamper-proof academic credential verification. The prototype demonstrates how distributed ledger technology can streamline the verification process, reducing verification time from days to seconds while maintaining data integrity and privacy. The system was tested with partner institutions and achieved 99.9% verification accuracy.",
      keywords: [
        "blockchain",
        "credential verification",
        "academic records",
        "distributed ledger",
      ],
      datePublished: "May 15, 2026",
      downloadAllowed: true,
      citation:
        "Luna, C. (2026). Blockchain for Academic Credential Verification. EARIST Graduate School Repository.",
    },
    {
      id: 4,
      title: "Student Engagement Strategies in Online Thesis Advising",
      author: "Ana Garcia",
      program: "MAED",
      year: 2026,
      abstract:
        "This study examines effective strategies for maintaining student engagement in online thesis advising sessions. Through surveys and interviews with graduate students and faculty advisers, the research identifies key factors that contribute to productive virtual advising relationships. The findings suggest that structured agendas, regular check-ins, and collaborative document editing significantly improve student satisfaction and thesis progress.",
      keywords: [
        "student engagement",
        "online advising",
        "thesis",
        "graduate students",
      ],
      datePublished: "June 3, 2026",
      downloadAllowed: false,
      citation:
        "Garcia, A. (2026). Student Engagement Strategies in Online Thesis Advising. EARIST Graduate School Repository.",
    },
    {
      id: 5,
      title: "Curriculum Mapping for Industry-Aligned Graduate Programs",
      author: "Pedro Reyes",
      program: "MIT",
      year: 2025,
      abstract:
        "This study develops a curriculum mapping framework that aligns graduate program outcomes with industry requirements. Through surveys of employers and analysis of job market trends in Metro Manila, the research identifies competency gaps and proposes curriculum modifications to better prepare graduates for industry demands. The framework was validated through focus groups with industry partners.",
      keywords: [
        "curriculum mapping",
        "industry alignment",
        "graduate programs",
        "competency",
      ],
      datePublished: "December 15, 2025",
      downloadAllowed: true,
      citation:
        "Reyes, P. (2025). Curriculum Mapping for Industry-Aligned Graduate Programs. EARIST Graduate School Repository.",
    },
  ];

  const filteredEntries = researchEntries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.keywords.some((k) =>
        k.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    if (!matchesSearch) return false;
    if (programFilter !== "all" && entry.program !== programFilter)
      return false;
    if (yearFilter !== "all" && entry.year !== parseInt(yearFilter))
      return false;

    return true;
  });

  const programs = [...new Set(researchEntries.map((e) => e.program))];
  const years = [...new Set(researchEntries.map((e) => e.year))].sort(
    (a, b) => b - a,
  );

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Research Repository
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Browse published graduate research from EARIST
        </p>
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
                {programs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="all">All Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
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
                <h3 className="mb-2 text-lg font-bold text-(--earist-primary)">
                  No Results Found
                </h3>
                <p className="text-sm text-(--earist-body-text)">
                  Try adjusting your search or filters.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <Card key={entry.id}>
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleExpand(entry.id)}
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
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.author}
                        </span>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {entry.program}
                        </span>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {entry.datePublished}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.keywords.slice(0, 3).map((keyword, i) => (
                          <Badge
                            key={i}
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
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-(--earist-body-text)" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-(--earist-body-text)" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-(--earist-border-gray) px-4 py-4">
                      <div className="space-y-4">
                        {/* Abstract */}
                        <div>
                          <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                            Abstract
                          </p>
                          <p className="text-sm text-(--earist-body-text)">
                            {entry.abstract}
                          </p>
                        </div>

                        {/* Keywords */}
                        <div>
                          <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                            Keywords
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {entry.keywords.map((keyword, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs"
                              >
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Citation */}
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-semibold text-(--earist-secondary)">
                              Citation
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(entry.citation);
                              }}
                              className="flex items-center gap-1 text-xs text-(--earist-body-text) hover:text-(--earist-primary)"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </button>
                          </div>
                          <p className="rounded-lg bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text) italic">
                            {entry.citation}
                          </p>
                        </div>

                        {/* Download */}
                        <div className="flex items-center justify-between rounded-lg bg-(--earist-surface-gray) p-3">
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-(--earist-body-text)" />
                            <span className="text-sm text-(--earist-body-text)">
                              {entry.downloadAllowed
                                ? "Full manuscript download available"
                                : "Download restricted by author"}
                            </span>
                          </div>
                          {entry.downloadAllowed ? (
                            <Button
                              size="sm"
                              className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                            >
                              <Download className="mr-1 h-3 w-3" />
                              Download PDF
                            </Button>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500">
                              Restricted
                            </Badge>
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
