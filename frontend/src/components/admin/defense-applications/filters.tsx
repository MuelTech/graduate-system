"use client";

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

const ALL = "ALL";

const STAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ALL, label: "All Stages" },
  { value: "TITLE", label: "Title Defense" },
  { value: "PROPOSAL", label: "Proposal Defense" },
  { value: "FINAL", label: "Final Defense" },
];

type ProgramOption = { id: string; programName: string };

type Props = {
  search: string;
  stage: string;
  programId: string;
  programs: ProgramOption[];
  programsLoading?: boolean;
  programsError?: boolean;
  isFetching?: boolean;
  onSearchChange: (v: string) => void;
  onStageChange: (v: string) => void;
  onProgramChange: (v: string) => void;
  onClear: () => void;
};

export function DefenseApplicationFilters({
  search,
  stage,
  programId,
  programs,
  programsLoading = false,
  programsError = false,
  isFetching = false,
  onSearchChange,
  onStageChange,
  onProgramChange,
  onClear,
}: Props) {
  const stageLabel =
    STAGE_OPTIONS.find((option) => option.value === stage)?.label ??
    "All Stages";
  const programLabel =
    programId === ALL
      ? "All Programs"
      : (programs.find((program) => program.id === programId)?.programName ??
        "All Programs");
  const isFiltered = search !== "" || stage !== ALL || programId !== ALL;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full sm:min-w-[220px] sm:flex-1">
            <label
              htmlFor="defense-app-search"
              className="mb-1 block text-sm font-medium text-(--earist-body-text)"
            >
              Search
            </label>
            <div className="relative">
              <Search
                className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)/60"
                aria-hidden="true"
              />
              <Input
                id="defense-app-search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search student name, student number, or email…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-full sm:w-56">
            <label
              htmlFor="defense-app-stage"
              className="mb-1 block text-sm font-medium text-(--earist-body-text)"
            >
              Defense Stage
            </label>
            <Select
              value={stage}
              onValueChange={(value) => onStageChange(value ?? ALL)}
            >
              <SelectTrigger id="defense-app-stage" className="w-full">
                <span className="flex-1 truncate text-left" title={stageLabel}>
                  {stageLabel}
                </span>
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-72">
            <label
              htmlFor="defense-app-program"
              className="mb-1 block text-sm font-medium text-(--earist-body-text)"
            >
              Program
            </label>
            <Select
              value={programId}
              onValueChange={(value) => onProgramChange(value ?? ALL)}
              disabled={programsLoading || programsError}
            >
              <SelectTrigger id="defense-app-program" className="w-full">
                <span
                  className="flex-1 truncate text-left"
                  title={programLabel}
                >
                  {programsLoading
                    ? "Loading programs…"
                    : programsError
                      ? "Programs unavailable"
                      : programLabel}
                </span>
              </SelectTrigger>
              <SelectContent className="min-w-[min(92vw,24rem)]">
                <SelectItem
                  value={ALL}
                  className="items-start [&>div]:shrink [&>div]:whitespace-normal"
                >
                  All Programs
                </SelectItem>
                {programs.map((program) => (
                  <SelectItem
                    key={program.id}
                    value={program.id}
                    className="items-start [&>div]:shrink [&>div]:whitespace-normal"
                  >
                    {program.programName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto sm:pb-0.5">
            {isFetching && (
              <span className="text-xs text-(--earist-body-text)" role="status">
                Updating…
              </span>
            )}
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {programsError && (
          <p className="mt-3 text-xs text-(--earist-body-text)" role="status">
            The Program list could not be loaded. Program filtering is
            temporarily unavailable; the application list is unaffected.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
