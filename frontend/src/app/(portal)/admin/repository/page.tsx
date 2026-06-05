"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Library,
  Search,
  Filter,
  Eye,
  Edit,
  CheckCircle2,
  XCircle,
  Globe,
  GlobeLock,
  Download,
  X,
  Save,
  FileText,
  Calendar,
  User,
  BookOpen,
} from "lucide-react";

export default function AdminRepositoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAbstract, setEditAbstract] = useState("");
  const [editKeywords, setEditKeywords] = useState("");

  const entries = [
    {
      id: 1,
      title: "Machine Learning Approaches for Early Detection of Student Academic Risk",
      author: "Maria Santos",
      studentNumber: "2026-GS-00456",
      program: "MSCS",
      abstract: "This study explores the application of machine learning algorithms for early detection of students at academic risk. Using historical academic data, the researchers developed a predictive model that identifies at-risk students with 87% accuracy. The system analyzes factors including attendance patterns, quiz scores, and assignment submission timeliness to generate early warnings for academic advisors.",
      keywords: ["machine learning", "academic risk", "prediction", "student performance"],
      datePublished: "May 28, 2026",
      status: "published" as "pending" | "published" | "unpublished",
      downloads: 45,
      views: 128,
    },
    {
      id: 2,
      title: "Effectiveness of Blended Learning in Graduate Education",
      author: "Elena Torres",
      studentNumber: "2026-GS-00460",
      program: "MSCS",
      abstract: "This research investigates the effectiveness of blended learning approaches in graduate-level computer science courses. The study compared student outcomes between traditional face-to-face instruction and blended learning formats across three graduate programs. Results indicate that blended learning improved student engagement by 23% and course completion rates by 15%.",
      keywords: ["blended learning", "graduate education", "online learning", "student engagement"],
      datePublished: "June 1, 2026",
      status: "published" as "pending" | "published" | "unpublished",
      downloads: 32,
      views: 95,
    },
    {
      id: 3,
      title: "NLP-Based Chatbot System for Graduate School Student Support",
      author: "Juan Dela Cruz",
      studentNumber: "2026-GS-00457",
      program: "MSCS",
      abstract: "This thesis presents the design, development, and evaluation of an NLP-powered chatbot system for graduate school student support. The system uses natural language processing to understand student queries and provide instant responses regarding enrollment procedures, thesis requirements, and academic policies. Evaluation showed 78% query resolution rate.",
      keywords: ["NLP", "chatbot", "student support", "natural language processing"],
      datePublished: null,
      status: "pending" as "pending" | "published" | "unpublished",
      downloads: 0,
      views: 0,
    },
    {
      id: 4,
      title: "Curriculum Mapping for Industry-Aligned Graduate Programs",
      author: "Ana Garcia",
      studentNumber: "2026-GS-00459",
      program: "MAED",
      abstract: "This study develops a curriculum mapping framework that aligns graduate program outcomes with industry requirements. Through surveys of employers and analysis of job market trends, the research identifies competency gaps and proposes curriculum modifications to better prepare graduates for industry demands.",
      keywords: ["curriculum mapping", "industry alignment", "graduate programs", "competency"],
      datePublished: null,
      status: "pending" as "pending" | "published" | "unpublished",
      downloads: 0,
      views: 0,
    },
    {
      id: 5,
      title: "Blockchain for Academic Credential Verification",
      author: "Carlos Luna",
      studentNumber: "2025-GS-00289",
      program: "PhD Education",
      abstract: "This research proposes a blockchain-based system for secure and tamper-proof academic credential verification. The prototype demonstrates how distributed ledger technology can streamline the verification process, reducing verification time from days to seconds while maintaining data integrity and privacy.",
      keywords: ["blockchain", "credential verification", "academic records", "distributed ledger"],
      datePublished: "May 15, 2026",
      status: "unpublished" as "pending" | "published" | "unpublished",
      downloads: 18,
      views: 52,
    },
  ];

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (programFilter !== "all" && entry.program !== programFilter) return false;

    return true;
  });

  const selectedEntryData = entries.find((e) => e.id === selectedEntry);

  const publishedCount = entries.filter((e) => e.status === "published").length;
  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const unpublishedCount = entries.filter((e) => e.status === "unpublished").length;
  const totalDownloads = entries.reduce((sum, e) => sum + e.downloads, 0);

  const programs = [...new Set(entries.map((e) => e.program))];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-100 text-green-700"><Globe className="mr-1 h-3 w-3" />Published</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700"><FileText className="mr-1 h-3 w-3" />Pending</Badge>;
      case "unpublished":
        return <Badge className="bg-gray-100 text-gray-500"><GlobeLock className="mr-1 h-3 w-3" />Unpublished</Badge>;
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

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--earist-primary)]" style={{ fontFamily: '"Calibri", sans-serif' }}>
          Research Repository & Databank
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          Manage published research entries and databank
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--earist-body-text)]">Published</p><p className="text-lg font-bold text-green-600">{publishedCount}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--earist-body-text)]">Pending</p><p className="text-lg font-bold text-amber-600">{pendingCount}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--earist-body-text)]">Unpublished</p><p className="text-lg font-bold text-gray-500">{unpublishedCount}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-[var(--earist-body-text)]">Total Downloads</p><p className="text-lg font-bold text-[var(--earist-primary)]">{totalDownloads}</p></CardContent></Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--earist-body-text)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or keyword..."
                className="w-full rounded-lg border border-[var(--earist-border-gray)] py-2 pl-10 pr-3 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--earist-primary)]/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--earist-body-text)]" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none">
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="pending">Pending</option>
                <option value="unpublished">Unpublished</option>
              </select>
              <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm text-[var(--earist-body-text)] focus:border-[var(--earist-primary)] focus:outline-none">
                <option value="all">All Programs</option>
                {programs.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Entries List */}
        <div className="space-y-2 lg:col-span-1">
          {filteredEntries.map((entry) => (
            <button key={entry.id} onClick={() => setSelectedEntry(entry.id)} className={`w-full rounded-lg border p-4 text-left transition-colors ${selectedEntry === entry.id ? "border-[var(--earist-primary)] bg-[var(--earist-surface-light-red)]" : "border-[var(--earist-border-gray)] hover:bg-[var(--earist-surface-gray)]"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--earist-primary)] truncate">{entry.title}</p>
                  <p className="text-xs text-[var(--earist-body-text)]">{entry.author} &middot; {entry.program}</p>
                </div>
                {getStatusBadge(entry.status)}
              </div>
              {entry.status === "published" && (
                <div className="mt-2 flex items-center gap-3 text-xs text-[var(--earist-body-text)]">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{entry.views}</span>
                  <span className="flex items-center gap-1"><Download className="h-3 w-3" />{entry.downloads}</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Entry Detail */}
        {selectedEntryData ? (
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">Research Details</CardTitle>
                  {getStatusBadge(selectedEntryData.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold text-[var(--earist-primary)]">{selectedEntryData.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--earist-body-text)]">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{selectedEntryData.author}</span>
                      <span>&middot;</span>
                      <span>{selectedEntryData.studentNumber}</span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{selectedEntryData.program}</span>
                      {selectedEntryData.datePublished && (
                        <>
                          <span>&middot;</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{selectedEntryData.datePublished}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-[var(--earist-secondary)]">Abstract</p>
                    <p className="text-sm text-[var(--earist-body-text)]">{selectedEntryData.abstract}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-[var(--earist-secondary)]">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedEntryData.keywords.map((keyword, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{keyword}</Badge>
                      ))}
                    </div>
                  </div>
                  {selectedEntryData.status === "published" && (
                    <div className="flex items-center gap-4 rounded-lg bg-[var(--earist-surface-gray)] p-3">
                      <div className="flex items-center gap-1 text-sm"><Eye className="h-4 w-4 text-[var(--earist-body-text)]" /><span className="font-medium text-[var(--earist-primary)]">{selectedEntryData.views}</span><span className="text-xs text-[var(--earist-body-text)]">views</span></div>
                      <div className="flex items-center gap-1 text-sm"><Download className="h-4 w-4 text-[var(--earist-body-text)]" /><span className="font-medium text-[var(--earist-primary)]">{selectedEntryData.downloads}</span><span className="text-xs text-[var(--earist-body-text)]">downloads</span></div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-2">
                  {selectedEntryData.status === "pending" && (
                    <Button className="bg-green-600 text-white hover:bg-green-700">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve & Publish
                    </Button>
                  )}
                  {selectedEntryData.status === "published" && (
                    <Button variant="outline" className="text-amber-600 hover:bg-amber-50">
                      <GlobeLock className="mr-2 h-4 w-4" />
                      Unpublish
                    </Button>
                  )}
                  {selectedEntryData.status === "unpublished" && (
                    <Button className="bg-green-600 text-white hover:bg-green-700">
                      <Globe className="mr-2 h-4 w-4" />
                      Republish
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleEditMetadata}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Metadata
                  </Button>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download Manuscript
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
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--earist-surface-gray)]">
                    <Library className="h-8 w-8 text-[var(--earist-body-text)]/40" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-[var(--earist-primary)]">Select a Research Entry</h3>
                  <p className="text-sm text-[var(--earist-body-text)]">Click an entry from the list to view details and manage.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Metadata Modal */}
      {showEditModal && selectedEntryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--earist-primary)]">Edit Metadata</h3>
              <button onClick={() => setShowEditModal(false)} className="rounded-full p-1 text-[var(--earist-body-text)] hover:bg-[var(--earist-surface-gray)]"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">Title</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">Abstract</label>
                <textarea value={editAbstract} onChange={(e) => setEditAbstract(e.target.value)} className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none" rows={5} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--earist-secondary)]">Keywords (comma-separated)</label>
                <input type="text" value={editKeywords} onChange={(e) => setEditKeywords(e.target.value)} className="w-full rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm focus:border-[var(--earist-primary)] focus:outline-none" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={() => setShowEditModal(false)} className="flex-1 bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90">
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
