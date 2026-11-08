"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { facultyKey } from "@/lib/faculty-access";
import {
  essayEndpoint,
  essayError,
  visibleEssayPage,
  type EssayPage,
} from "@/lib/faculty-essays";
import { useFacultyAccess } from "@/components/faculty/faculty-access-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function EssayEvaluations() {
  const { accountId } = useFacultyAccess();
  const query = useInfiniteQuery({
    queryKey: facultyKey(accountId, "essays", "queue"),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      visibleEssayPage(
        (cursor) =>
          apiClientRequest(
            `${essayEndpoint()}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
            { signal, cache: "no-store" },
          ) as Promise<EssayPage>,
        pageParam,
      ),
    getNextPageParam: (page) => page.nextCursor,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  // Keep identity unique across a refreshed candidate scan while preserving order.
  const unique = [
    ...new Map(items.map((item) => [item.applicationId, item])).values(),
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Essay Evaluations"
        description="Pending entrance-exam essays across Programs."
      />
      {query.isPending ? (
        <div aria-busy="true">
          <Skeleton className="h-56 w-full" />
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="space-y-3 p-6" role="alert">
            <p>{essayError(query.error)}</p>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() =>
                void (query.isFetchNextPageError
                  ? query.fetchNextPage()
                  : query.refetch())
              }
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div role="status" className="text-sm text-(--earist-body-text)">
            {query.isFetching ? "Loading evaluations…" : ""}
          </div>
          {!unique.length && !query.hasNextPage ? (
            <Card>
              <CardContent className="py-12 text-center">
                No pending essay evaluations.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">
                    Pending essay evaluations
                  </caption>
                  <thead className="border-b bg-(--earist-surface-gray)">
                    <tr>
                      {[
                        "Applicant",
                        "Program",
                        "Submitted",
                        "Status",
                        "Action",
                      ].map((label) => (
                        <th
                          scope="col"
                          key={label}
                          className="px-4 py-3 font-semibold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {unique.map((item) => (
                      <tr key={item.applicationId}>
                        <td className="max-w-64 px-4 py-4">
                          <p className="font-semibold break-words">
                            {item.applicant.firstName} {item.applicant.lastName}
                          </p>
                          <p className="mt-1 text-xs text-(--earist-body-text)">
                            Applicant ID: {item.applicant.pinnacleApplicantId}
                          </p>
                        </td>
                        <td className="max-w-64 px-4 py-4 break-words">
                          {item.programName}
                        </td>
                        <td className="px-4 py-4">
                          {new Date(item.finalizedAt).toLocaleDateString(
                            "en-PH",
                            { timeZone: "Asia/Manila" },
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline">Pending Evaluation</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            className="inline-flex rounded-lg border px-3 py-2 font-semibold text-(--earist-primary) hover:bg-(--earist-surface-light-red)"
                            href={`/panelist/essay-evaluations/${encodeURIComponent(item.applicationId)}`}
                            aria-label={`Review Essay for ${item.applicant.firstName} ${item.applicant.lastName}`}
                          >
                            Review Essay
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
          {query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Loading more…" : "Load More"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
