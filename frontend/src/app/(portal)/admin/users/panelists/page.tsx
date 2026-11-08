"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { apiClientRequest } from "@/lib/api.client";
import {
  FACULTY_API,
  FACULTY_QUERY_KEY,
  facultyError,
  facultyName,
  filterFaculty,
  mapFaculty,
} from "@/lib/faculty-management";
import type { Faculty, FacultyResponse } from "@/types/faculty";
import { FacultyDetailDialog } from "@/components/admin/faculty/faculty-detail";
import { FacultyFormDialog } from "@/components/admin/faculty/faculty-form";
import {
  TemporaryCredentialDialog,
  type TemporaryCredential,
} from "@/components/admin/faculty/temporary-credential";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const selectClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
const PAGE_SIZE = 10;

export default function FacultyManagementPage() {
  const { data: session } = useSession();
  const accountId = session?.user?.id ?? "";
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ faculty?: Faculty } | null>(null);
  const [credential, setCredential] = useState<TemporaryCredential | null>(
    null,
  );
  const query = useQuery({
    queryKey: [...FACULTY_QUERY_KEY, accountId, "list"],
    retry: false,
    enabled: Boolean(accountId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [rows, context] = await Promise.all([
        apiClientRequest(FACULTY_API),
        apiClientRequest(`${FACULTY_API}/management-context`, {
          cache: "no-store",
        }),
      ]);
      if (!Array.isArray(rows) || typeof context?.canManage !== "boolean")
        throw new Error("Invalid Faculty response");
      return {
        rows: rows.map((row: FacultyResponse) => mapFaculty(row)),
        canManage: context.canManage as boolean,
      };
    },
  });
  const canManage =
    query.data?.canManage === true && !query.isError && !query.isFetching;
  const rows = query.data?.rows ?? [];
  const filtered = filterFaculty(rows, search, classification, status);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const hasFilters =
    Boolean(search.trim()) || classification !== "all" || status !== "all";
  function clearFilters() {
    setSearch("");
    setClassification("all");
    setStatus("all");
    setPage(1);
  }
  async function refresh() {
    await client.invalidateQueries({ queryKey: FACULTY_QUERY_KEY });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Management"
        description="Manage Faculty accounts, access, and adviser availability."
        actions={
          canManage ? (
            <Button id="faculty-create" onClick={() => setEditor({})}>
              <Plus aria-hidden="true" />
              Create Faculty
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="faculty-search">Search Faculty</Label>
              <Input
                id="faculty-search"
                placeholder="Name, email, affiliation, or specialization"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faculty-type-filter">Classification</Label>
              <select
                id="faculty-type-filter"
                className={selectClass}
                value={classification}
                onChange={(event) => {
                  setClassification(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Faculty</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="faculty-status-filter">Account status</Label>
              <select
                id="faculty-status-filter"
                className={selectClass}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          {query.isPending ? (
            <div aria-label="Loading Faculty" className="space-y-3">
              {[1, 2, 3, 4].map((key) => (
                <Skeleton key={key} className="h-16 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div role="alert" className="space-y-3 py-8 text-center">
              <p>{facultyError(query.error)}</p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="space-y-2 py-12 text-center">
              <h2 className="font-semibold">No Faculty accounts yet.</h2>
              {canManage && (
                <Button variant="outline" onClick={() => setEditor({})}>
                  Create Faculty
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <p role="status">
                  {filtered.length} Faculty
                  {query.isFetching ? " · Refreshing…" : ""}
                </p>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
              {filtered.length === 0 ? (
                <div className="space-y-3 py-12 text-center">
                  <h2 className="font-semibold">No matching Faculty.</h2>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-3xl text-left text-sm">
                    <caption className="sr-only">
                      Faculty accounts and configuration
                    </caption>
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="w-1/3 px-3 py-3">
                          Faculty
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Classification
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Account status
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Essay Evaluation
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Available as Adviser
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((faculty) => (
                        <tr key={faculty.id} className="border-b last:border-0">
                          <th
                            scope="row"
                            className="max-w-xs px-3 py-4 font-normal"
                          >
                            <p className="break-words font-medium">
                              {facultyName(faculty)}
                            </p>
                            <p className="break-all text-muted-foreground">
                              {faculty.email}
                            </p>
                          </th>
                          <td className="px-3 py-4">
                            {faculty.isExternal ? "External" : "Internal"}
                          </td>
                          <td className="px-3 py-4">
                            <Badge
                              variant={
                                faculty.isActive ? "secondary" : "outline"
                              }
                            >
                              {faculty.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-3 py-4">
                            {faculty.essayEvaluation
                              ? "Enabled"
                              : "Not enabled"}
                          </td>
                          <td className="px-3 py-4">
                            {faculty.isExternal
                              ? "Not applicable"
                              : faculty.isAvailableAsAdviser
                                ? "Yes"
                                : "No"}
                          </td>
                          <td className="px-3 py-4">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`View ${facultyName(faculty)}`}
                              onClick={() => setDetailId(faculty.id)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <nav
                aria-label="Faculty pagination"
                className="flex flex-wrap items-center justify-end gap-3"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </nav>
            </>
          )}
        </CardContent>
      </Card>
      {detailId && (
        <FacultyDetailDialog
          key={detailId}
          id={detailId}
          accountId={accountId}
          canManage={canManage}
          onClose={() => setDetailId(null)}
          onEdit={(faculty) => {
            setDetailId(null);
            setEditor({ faculty });
          }}
        />
      )}
      {editor && (
        <FacultyFormDialog
          faculty={editor.faculty}
          canManage={canManage}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await refresh();
            if (editor.faculty) toast.success("Faculty updated.");
          }}
          onCreated={(created) => {
            setEditor(null);
            setCredential(created);
          }}
        />
      )}
      {credential && (
        <TemporaryCredentialDialog
          credential={credential}
          onClose={() => setCredential(null)}
          returnFocus={() =>
            document.getElementById("faculty-create") ??
            document.getElementById("faculty-search")
          }
        />
      )}
    </div>
  );
}
