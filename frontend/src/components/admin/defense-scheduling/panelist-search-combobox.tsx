"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import type { ActivePanelistCandidate, PaginatedResponse } from "@/types";

type Props = {
  assignedUserIds: string[];
  selected: ActivePanelistCandidate | null;
  onSelect: (p: ActivePanelistCandidate) => void;
};

export function PanelistSearchCombobox({
  assignedUserIds,
  selected,
  onSelect,
}: Props) {
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
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
      });
      const res = await apiClientRequest(
        `/thesis/panelist-search?${params.toString()}`,
      );
      return res as PaginatedResponse<ActivePanelistCandidate>;
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = page * pageSize < total;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-(--earist-body-text)" />
        <Input
          aria-label="Search panelist"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search name, email, department..."
          className="pl-8"
        />
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-(--earist-border-gray)">
        {(isLoading || isFetching) && items.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-(--earist-body-text)">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching panelists...
          </p>
        )}
        {isError && (
          <p className="py-6 text-center text-sm text-red-600">
            Unable to search panelists.
          </p>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <p className="py-6 text-center text-sm text-(--earist-body-text)">
            No active panelists match your search.
          </p>
        )}
        {items.map((p) => {
          const already = assignedUserIds.includes(p.id);
          const isSelected = selected?.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={already}
              aria-pressed={isSelected}
              onClick={() => onSelect(p)}
              className={`w-full px-3 py-2 text-left text-sm ${
                already
                  ? "cursor-not-allowed opacity-50"
                  : isSelected
                    ? "bg-(--earist-primary)/10"
                    : "hover:bg-(--earist-surface-gray)"
              }`}
            >
              <p className="font-medium">
                {p.firstName} {p.lastName}
                {already && (
                  <span className="ml-2 text-xs text-red-600">
                    Already assigned
                  </span>
                )}
              </p>
              <p className="text-xs text-(--earist-body-text)">{p.email}</p>
              <p className="text-xs text-(--earist-body-text)">
                {p.panelist?.isExternal
                  ? "External Panelist"
                  : p.panelist?.officeAffiliation || "Internal Faculty"}
              </p>
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
    </div>
  );
}
