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

        <div className="min-h-[12rem] flex-1 overflow-y-auto rounded-lg border border-(--earist-border-gray)">
          {(isLoading || (isFetching && items.length === 0)) && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-(--earist-body-text)">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Searching faculty…
            </p>
          )}
          {isError && (
            <p className="py-8 text-center text-sm text-destructive">
              Unable to search faculty.
            </p>
          )}
          {!isLoading && !isError && items.length === 0 && (
            <p className="py-8 text-center text-sm text-(--earist-body-text)">
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
                className={`flex w-full items-center justify-between gap-2 border-b border-(--earist-border-gray) px-3 py-2 text-left text-sm last:border-0 ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : selected
                      ? "bg-(--earist-primary)/10"
                      : "hover:bg-(--earist-surface-gray)"
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {person.firstName} {person.lastName}
                  </span>
                  <span className="block text-xs text-(--earist-body-text)">
                    {person.email}
                  </span>
                  <span className="block text-xs text-(--earist-body-text)">
                    {person.panelist?.isExternal
                      ? "External Panelist"
                      : person.panelist?.officeAffiliation || "Internal Faculty"}
                  </span>
                  {elsewhere && (
                    <span className="block text-xs text-(--earist-warning)">
                      Already assigned as {elsewhere}
                    </span>
                  )}
                </span>
                {selected && (
                  <Check
                    className="h-4 w-4 shrink-0 text-(--earist-primary)"
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
              className="w-full border-t border-(--earist-border-gray) py-2 text-xs text-(--earist-primary) hover:bg-(--earist-surface-gray)"
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
            className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
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
