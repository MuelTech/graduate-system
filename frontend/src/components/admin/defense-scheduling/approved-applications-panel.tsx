"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import type { ApprovedApplicationDto, PaginatedResponse } from "@/types";
import { defenseTypeLabel } from "./types";

type Props = {
  data: PaginatedResponse<ApprovedApplicationDto> | undefined;
  isLoading: boolean;
  isError: boolean;
  page: number;
  search: string;
  defenseType: string;
  programId: string;
  programs: Array<{ id: string; programName: string }>;
  selectedId: string | null;
  onSearchChange: (value: string) => void;
  onDefenseTypeChange: (value: string) => void;
  onProgramChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (app: ApprovedApplicationDto) => void;
};

export function ApprovedApplicationsPanel({
  data,
  isLoading,
  isError,
  page,
  search,
  defenseType,
  programId,
  programs,
  selectedId,
  onSearchChange,
  onDefenseTypeChange,
  onProgramChange,
  onPageChange,
  onSelect,
}: Props) {
  const [searchDraft, setSearchDraft] = useState(search);
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = data?.data ?? [];

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== search) onSearchChange(searchDraft);
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft, search, onSearchChange]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
          1. Approved Applications
        </CardTitle>
        <p className="text-xs text-(--earist-body-text)">
          Requirements verified — ready for panel assignment and scheduling.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-(--earist-body-text)" />
          <Input
            aria-label="Search approved applications"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search student, student number, or email..."
            className="pl-8"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <Label className="text-xs" htmlFor="defense-type-filter">
              Defense Type
            </Label>
            <select
              id="defense-type-filter"
              value={defenseType}
              onChange={(e) => onDefenseTypeChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm"
            >
              <option value="ALL">All</option>
              <option value="TITLE_DEFENSE">Title Defense</option>
              <option value="PROPOSAL_DEFENSE">Proposal Defense</option>
              <option value="FINAL_DEFENSE">Final Defense</option>
            </select>
          </div>
          <div>
            <Label className="text-xs" htmlFor="program-filter">
              Program
            </Label>
            <select
              id="program-filter"
              value={programId}
              onChange={(e) => onProgramChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm"
            >
              <option value="ALL">All</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.programName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-[280px] space-y-2">
          {isLoading && (
            <p className="py-8 text-center text-sm text-(--earist-body-text)">
              Loading approved applications...
            </p>
          )}
          {isError && (
            <p className="py-8 text-center text-sm text-red-600">
              Unable to load approved applications.
            </p>
          )}
          {!isLoading && !isError && items.length === 0 && (
            <p className="py-8 text-center text-sm text-(--earist-body-text)">
              {search || defenseType !== "ALL" || programId !== "ALL"
                ? "No approved applications match the selected filters."
                : "No approved defense applications are ready for scheduling."}
            </p>
          )}
          {!isLoading &&
            items.map((app) => {
              const selected = selectedId === app.id;
              const student = app.student;
              return (
                <button
                  key={app.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(app)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? "border-(--earist-primary) bg-(--earist-primary)/5 shadow-sm"
                      : "border-(--earist-border-gray) hover:bg-(--earist-surface-gray)"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-(--earist-primary)">
                        {student.user.firstName} {student.user.lastName}
                      </p>
                      <p className="truncate text-xs text-(--earist-body-text)">
                        {student.studentNumber || student.user.email}
                      </p>
                      <p className="truncate text-xs text-(--earist-body-text)">
                        {student.program?.programName || "Program N/A"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge className="bg-purple-100 text-purple-700">
                        {defenseTypeLabel(app.stage)}
                      </Badge>
                      <span className="text-[10px] text-(--earist-body-text)">
                        Approved {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                      {selected && (
                        <CheckCircle2 className="h-4 w-4 text-(--earist-primary)" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>

        <div className="flex items-center justify-between border-t border-(--earist-border-gray) pt-2 text-xs text-(--earist-body-text)">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
