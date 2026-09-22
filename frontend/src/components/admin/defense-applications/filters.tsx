"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

type Props = {
  search: string;
  stage: string;
  status: string;
  programId: string;
  programs: Array<{ id: string; programName: string }>;
  onSearchChange: (v: string) => void;
  onStageChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onProgramChange: (v: string) => void;
};

export function DefenseApplicationFilters({
  search,
  stage,
  status,
  programId,
  programs,
  onSearchChange,
  onStageChange,
  onStatusChange,
  onProgramChange,
}: Props) {
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== search) onSearchChange(searchDraft);
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft, search, onSearchChange]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-(--earist-body-text)" />
        <Input
          aria-label="Search defense applications"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search student name, student number, or email..."
          className="pl-8"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-xs" htmlFor="stage-filter">
            Defense Stage
          </Label>
          <select
            id="stage-filter"
            value={stage}
            onChange={(e) => onStageChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="TITLE">Title Defense</option>
            <option value="PROPOSAL">Proposal Defense</option>
            <option value="FINAL">Final Defense</option>
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
        <div>
          <Label className="text-xs" htmlFor="status-filter">
            Status
          </Label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="PENDING">Needs Review</option>
            <option value="APPROVED">Ready for Scheduling</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="REJECTED">Rejected</option>
            <option value="PASSED">Passed</option>
            <option value="REVISION">Revision Required</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>
    </div>
  );
}
