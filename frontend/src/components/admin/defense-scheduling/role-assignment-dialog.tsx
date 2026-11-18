"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClientRequest } from "@/lib/api.client";
import type { ActivePanelistCandidate, PaginatedResponse } from "@/types";
import {
  ROLE_LABELS,
  memberToPerson,
  panelistToPerson,
  type CommitteeMember,
  type DefensePanelRole,
  type PickerPerson,
} from "./types";
import { Check, Loader2, Search, X } from "lucide-react";

type AssignedElsewhere = { userId: string; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: DefensePanelRole;
  multi: boolean;
  /** Quota for this role (panelists: stage/program quota; single roles: 1). */
  maxCount: number;
  /** Current members already in this role (preselected). */
  current: CommitteeMember[];
  /** Members in other roles or the automatic adviser (cannot be selected). */
  assignedElsewhere: AssignedElsewhere[];
  onConfirm: (people: PickerPerson[]) => void;
};

export function RoleAssignmentDialog({
  open,
  onOpenChange,
  role,
  multi,
  maxCount,
  current,
  assignedElsewhere,
  onConfirm,
}: Props) {
  const [selection, setSelection] = useState<PickerPerson[]>(() =>
    current.map(memberToPerson),
  );
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchDraft);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["panelistSearch", search, page],
    enabled: open,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
      });
      return (await apiClientRequest(
        `/thesis/panelist-search?${params.toString()}`,
      )) as PaginatedResponse<ActivePanelistCandidate>;
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = page * pageSize < total;
  const excluded = new Map(assignedElsewhere.map((a) => [a.userId, a.label]));

  const isSelected = (id: string) => selection.some((p) => p.id === id);
  const atCapacity = multi && selection.length >= maxCount;

  const toggle = (person: PickerPerson) => {
    setSelection((prev) => {
      if (prev.some((p) => p.id === person.id)) {
        return prev.filter((p) => p.id !== person.id);
      }
      if (multi) {
        if (prev.length >= maxCount) return prev;
        return [...prev, person];
      }
      return [person];
    });
  };

  const confirmDisabled = multi
    ? selection.length > maxCount
    : selection.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {multi
              ? "Select Panelists"
              : `Assign ${ROLE_LABELS[role]}`}
          </DialogTitle>
          <DialogDescription>
            {multi
              ? `Select up to ${maxCount} eligible panelists. Selected ${selection.length} of ${maxCount} required.`
              : `Choose one eligible person for the ${ROLE_LABELS[role]} role.`}
          </DialogDescription>
        </DialogHeader>

        {multi && (
          <p className="text-sm font-medium text-(--earist-primary)">
            Selected {selection.length} of {maxCount} required
          </p>
        )}

        {/* Current selection chips */}
        {selection.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selection.map((p) => (
              <Badge key={p.id} variant="outline" className="gap-1 text-xs">
                {p.firstName} {p.lastName}
                <button
                  type="button"
                  aria-label={`Remove ${p.firstName} ${p.lastName}`}
                  onClick={() => toggle(p)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="relative">
          <Search
            className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-(--earist-body-text)"
            aria-hidden="true"
          />
          <Input
            aria-label="Search eligible faculty"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search name, email, or department…"
            className="pl-8"
          />
        </div>

        <div className="min-h-[12rem] flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white">
          {(isLoading || (isFetching && items.length === 0)) && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#e02b20]" aria-hidden="true" />
              Searching faculty…
            </p>
          )}
          {isError && (
            <p className="py-8 text-center text-sm text-destructive">
              Unable to search faculty.
            </p>
          )}
          {!isLoading && !isError && items.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              No eligible faculty match your search.
            </p>
          )}
          {items.map((person) => {
            const elsewhere = excluded.get(person.id);
            const selected = isSelected(person.id);
            const disabled = !!elsewhere || (!selected && atCapacity);
            return (
              <button
                key={person.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => toggle(panelistToPerson(person))}
                className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3.5 py-2.5 text-left text-sm transition-colors last:border-0 ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : selected
                      ? "bg-red-50/50"
                      : "hover:bg-gray-50/80"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#333333]">
                      {person.firstName} {person.lastName}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-gray-200 bg-gray-50 px-1.5 py-0 text-[10px] font-medium text-gray-600"
                    >
                      {person.panelist?.isExternal
                        ? "External Panelist"
                        : person.panelist?.officeAffiliation || "Internal Faculty"}
                    </Badge>
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {person.email}
                  </span>
                  {elsewhere && (
                    <span className="mt-0.5 block text-xs font-medium text-amber-700">
                      Already assigned as {elsewhere}
                    </span>
                  )}
                </span>
                {selected && (
                  <Check
                    className="h-4 w-4 shrink-0 text-[#e02b20]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="w-full border-t border-gray-100 py-2 text-xs font-semibold text-[#e02b20] hover:bg-gray-50"
            >
              Load more
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm(selection);
              onOpenChange(false);
            }}
            className="bg-[#e02b20] text-white hover:bg-[#b71c1c]"
          >
            {multi
              ? `Add ${selection.length} Panelist${selection.length === 1 ? "" : "s"}`
              : selection[0]
                ? `Assign ${ROLE_LABELS[role]}`
                : `Clear ${ROLE_LABELS[role]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
