"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Quote, BookOpen } from "lucide-react";
import { toast } from "sonner";
import type { RepositoryPublication } from "@/types";

interface CitationModalProps {
  entry: RepositoryPublication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CitationStyle = "apa" | "mla" | "chicago" | "bibtex";

function parseAuthorNames(fullName: string | null | undefined): {
  lastName: string;
  firstName: string;
  initials: string;
} {
  if (!fullName) {
    return { lastName: "EARIST Graduate School", firstName: "", initials: "" };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: "", initials: "" };
  }
  const lastName = parts[parts.length - 1];
  const firstParts = parts.slice(0, parts.length - 1);
  const firstName = firstParts.join(" ");
  const initials = firstParts.map((p) => `${p[0]?.toUpperCase()}.`).join(" ");
  return { lastName, firstName, initials };
}

function getDegreeType(program: string | null | undefined): string {
  if (!program) return "Master's thesis or Doctoral dissertation";
  const lower = program.toLowerCase();
  if (lower.includes("doctor") || lower.includes("phd") || lower.includes("edd")) {
    return "Doctoral dissertation";
  }
  return "Master's thesis";
}

function generateCitations(entry: RepositoryPublication): Record<CitationStyle, string> {
  const { lastName, firstName, initials } = parseAuthorNames(entry.author);
  const year = entry.publishedAt
    ? new Date(entry.publishedAt).getFullYear()
    : new Date().getFullYear();
  const degree = getDegreeType(entry.program);
  const title = entry.title;
  const authorDisplay = entry.author ?? "Unknown Author";

  // APA 7th Edition
  const apaAuthor = initials ? `${lastName}, ${initials}` : lastName;
  const apa = `${apaAuthor} (${year}). ${title} [${degree}, Eulogio "Amang" Rodriguez Institute of Science and Technology]. EARIST Institutional Repository.`;

  // MLA 9th Edition
  const mlaAuthor = firstName ? `${lastName}, ${firstName}` : lastName;
  const mla = `${mlaAuthor}. ${title}. ${year}. Eulogio "Amang" Rodriguez Institute of Science and Technology, ${degree}. EARIST Institutional Repository.`;

  // Chicago 17th Edition
  const chicago = `${mlaAuthor}. "${title}." ${degree}, Eulogio "Amang" Rodriguez Institute of Science and Technology, ${year}.`;

  // BibTeX format
  const citeKey = `${lastName.toLowerCase().replace(/[^a-z0-9]/g, "")}${year}`;
  const bibtex = `@thesis{${citeKey},
  author = {${authorDisplay}},
  title = {${title}},
  school = {Eulogio "Amang" Rodriguez Institute of Science and Technology},
  year = {${year}},
  type = {${degree}},
  note = {EARIST Institutional Repository}
}`;

  return { apa, mla, chicago, bibtex };
}

export function CitationModal({
  entry,
  open,
  onOpenChange,
}: CitationModalProps) {
  const [activeStyle, setActiveStyle] = useState<CitationStyle>("apa");
  const [copied, setCopied] = useState(false);

  if (!entry) return null;

  const citations = generateCitations(entry);
  const currentText = citations[activeStyle];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentText);
      setCopied(true);
      toast.success(`${activeStyle.toUpperCase()} citation copied to clipboard.`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Unable to copy to clipboard.");
    }
  };

  const styleLabels: Array<{ id: CitationStyle; label: string; desc: string }> = [
    { id: "apa", label: "APA 7th", desc: "American Psychological Association" },
    { id: "mla", label: "MLA 9th", desc: "Modern Language Association" },
    { id: "chicago", label: "Chicago", desc: "Notes & Bibliography" },
    { id: "bibtex", label: "BibTeX", desc: "LaTeX / Reference Managers" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--earist-surface-light-red) text-(--earist-primary)">
              <Quote className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-(--earist-primary)">
                Cite this Research
              </DialogTitle>
              <DialogDescription className="text-xs text-(--earist-body-text)">
                Export citation in standard academic reference formats.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Research Reference Header */}
          <div className="rounded-lg bg-(--earist-surface-gray)/70 p-3">
            <p className="line-clamp-2 text-xs font-semibold text-(--earist-primary)">
              {entry.title}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-(--earist-body-text)">
              <span>{entry.author ?? "Unknown Author"}</span>
              {entry.program && (
                <>
                  <span>&middot;</span>
                  <span className="truncate">{entry.program}</span>
                </>
              )}
            </div>
          </div>

          {/* Style Tabs */}
          <div className="flex rounded-lg border border-(--earist-border-gray) bg-gray-50/70 p-1">
            {styleLabels.map((style) => (
              <button
                key={style.id}
                onClick={() => {
                  setActiveStyle(style.id);
                  setCopied(false);
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
                  activeStyle === style.id
                    ? "bg-white text-(--earist-primary) shadow-xs font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>

          {/* Citation Preview Container */}
          <div className="relative">
            <pre
              className={`rounded-lg border border-(--earist-border-gray) bg-white p-3.5 text-xs leading-relaxed text-gray-800 whitespace-pre-wrap ${
                activeStyle === "bibtex" ? "font-mono bg-gray-50/50" : "font-sans"
              }`}
            >
              {currentText}
            </pre>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                {styleLabels.find((s) => s.id === activeStyle)?.desc}
              </span>
              <Button
                size="sm"
                onClick={handleCopy}
                className="h-8 gap-1.5 text-xs bg-(--earist-primary) hover:bg-(--earist-primary-dark) text-white"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-300" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Citation
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Academic Policy Helper */}
          <p className="text-[11px] text-gray-400">
            Please verify formatting according to your department or publisher guidelines before final submission.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
