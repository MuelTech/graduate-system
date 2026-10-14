"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Clock, FileText, Search, Download } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";

interface MemoItem {
  id: string;
  title: string;
  content: string;
  targetAudience: string;
  attachmentUrl?: string | null;
  createdAt: string;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
}

export default function PanelistAnnouncements() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: memos = [], isLoading } = useQuery<MemoItem[]>({
    queryKey: ["panelist-memos"],
    queryFn: async () => await apiClientRequest("/memos"),
  });

  const filteredMemos = useMemo(() => {
    if (!searchTerm.trim()) return memos;
    const term = searchTerm.toLowerCase();
    return memos.filter(
      (m) =>
        m.title.toLowerCase().includes(term) ||
        m.content.toLowerCase().includes(term)
    );
  }, [memos, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            Announcements & Memos
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            View official communications and circulars from the Graduate School Office.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--earist-secondary)" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-(--earist-border-gray) bg-white pl-9 pr-3 py-2 text-sm text-(--earist-body-text) placeholder:text-(--earist-body-text)/50 focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) outline-none transition-colors"
          />
        </div>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <p className="text-sm text-center py-12 text-(--earist-body-text)">
          Loading announcements...
        </p>
      ) : filteredMemos.length === 0 ? (
        <Card className="bg-(--earist-surface-gray) border-none mt-6">
          <CardContent className="flex flex-col items-center py-12">
            <Megaphone className="h-12 w-12 text-(--earist-body-text)/30 mb-4" />
            <p className="text-sm font-bold text-(--earist-secondary)">
              {searchTerm ? "No matching announcements" : "No Announcements"}
            </p>
            <p className="text-xs text-(--earist-body-text)">
              {searchTerm
                ? "Try searching with different keywords."
                : "You have no active memos at this time."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMemos.map((memo) => (
            <Card
              key={memo.id}
              className="overflow-hidden hover:shadow-md transition-shadow border-(--earist-border-gray)"
            >
              <CardContent className="p-0 flex flex-col sm:flex-row">
                {/* Date Sidebar */}
                <div className="bg-(--earist-surface-light-red) p-4 flex flex-col justify-center items-center w-full sm:w-32 sm:border-r border-(--earist-border-gray)">
                  <Clock className="h-5 w-5 text-(--earist-primary) mb-1" />
                  <span className="text-xs font-bold text-(--earist-primary)">
                    {new Date(memo.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Details */}
                <div className="p-4 sm:p-6 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <h4 className="font-bold text-(--earist-primary) text-lg">
                      {memo.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      {memo.attachmentUrl && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-red-50 text-(--earist-primary) border-(--earist-accent) flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" /> Circular Attached
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-white text-(--earist-accent) border-(--earist-accent)"
                      >
                        Official Memo
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-(--earist-body-text) whitespace-pre-wrap leading-relaxed">
                    {memo.content}
                  </p>

                  {/* Attachment Action */}
                  {memo.attachmentUrl && (
                    <div className="mt-4 pt-3 border-t border-(--earist-border-gray)/50">
                      <a
                        href={`/api/documents/memo/${memo.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-(--earist-primary) text-(--earist-primary) hover:bg-(--earist-surface-light-red)"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF Circular
                        </Button>
                      </a>
                    </div>
                  )}

                  {/* Footer metadata */}
                  <div className="mt-4 pt-3 border-t border-(--earist-border-gray) flex justify-between items-center text-xs text-(--earist-secondary)">
                    <span>
                      Issued by:{" "}
                      {memo.createdBy
                        ? `${memo.createdBy.firstName} ${memo.createdBy.lastName}`
                        : "GS Office"}
                    </span>
                    <span>Target: {memo.targetAudience}</span>
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
