"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface DefenseRecordRow {
  scheduleId: string;
  studentName: string | null;
  studentNumber: string | null;
  program: string | null;
  defenseType: string;
  defenseDate: string | null;
  sessionStatus: string;
  formalResult: string | null;
  summaryReady: boolean;
  rapStatus: string | null;
}

export default function AdminDefenseRecordsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["adminDefenseRecords", page, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: searchQuery,
      });
      return (await apiClientRequest(
        `/thesis/defense/records?${params.toString()}`,
      )) as {
        data: DefenseRecordRow[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-(--earist-primary)">
          Defense Records
        </h1>
        <p className="text-sm text-(--earist-body-text)">
          Read-only official defense session records. Academic scores and formal
          results are not editable here.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-(--earist-body-text)" />
          <Input
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by student name or number…"
          />
        </div>
        {search && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setSearchQuery("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Defense Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-(--earist-body-text)">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-(--earist-body-text)">
              No defense sessions found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-(--earist-body-text)">
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Program</th>
                    <th className="py-2 pr-3">Defense</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Session</th>
                    <th className="py-2 pr-3">Result</th>
                    <th className="py-2 pr-3">Summary</th>
                    <th className="py-2 pr-3">RAP</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.scheduleId}
                      className="border-b border-(--earist-border-gray)"
                    >
                      <td className="py-2 pr-3">
                        <div>{r.studentName}</div>
                        <div className="text-xs text-(--earist-body-text)">
                          {r.studentNumber}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{r.program}</td>
                      <td className="py-2 pr-3">{r.defenseType}</td>
                      <td className="py-2 pr-3">
                        {r.defenseDate?.slice(0, 10) ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline">{r.sessionStatus}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {r.formalResult ? (
                          <Badge
                            className={
                              r.formalResult === "PASSED"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.formalResult === "FAILED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                            }
                          >
                            {r.formalResult}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {r.summaryReady ? "Ready" : "Not ready"}
                      </td>
                      <td className="py-2 pr-3">{r.rapStatus ?? "—"}</td>
                      <td className="py-2">
                        <Link
                          href={`/admin/thesis/defense-records/${r.scheduleId}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-(--earist-body-text)">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
