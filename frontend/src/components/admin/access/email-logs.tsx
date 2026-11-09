"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { adminAllows, adminKey } from "@/lib/admin-access";
import { useAdminAccess } from "./admin-access-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface LogPage {
  data: {
    id: string;
    recipient: string;
    subject: string;
    status: string;
    createdAt: string;
  }[];
  meta: { totalPages: number };
}

export function EmailLogs() {
  const { accountId, snapshot } = useAdminAccess();
  const [page, setPage] = useState(1);
  const query = useQuery<LogPage>({
    queryKey: [...adminKey(accountId, "email-logs"), page],
    enabled: adminAllows(snapshot, "email.logs.view"),
    queryFn: ({ signal }) =>
      apiClientRequest(`/admin/email-logs/logs?page=${page}&limit=20`, {
        signal,
        cache: "no-store",
      }),
  });
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">Email Logs</h2>
        {query.isPending ? (
          <p role="status">Loading email logs…</p>
        ) : query.isError ? (
          <div role="alert">
            <p>Email logs are unavailable.</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry email logs
            </Button>
          </div>
        ) : (
          <>
            {query.data.data.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {["Recipient", "Subject", "Status", "Sent"].map(
                        (label) => (
                          <th scope="col" key={label} className="p-2">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.data.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="p-2 break-all">{log.recipient}</td>
                        <td className="p-2">{log.subject}</td>
                        <td className="p-2">{log.status}</td>
                        <td className="p-2">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No email logs on this page.</p>
            )}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={page === 1 || query.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <span>Page {page}</span>
              <Button
                variant="outline"
                disabled={
                  page >= query.data.meta.totalPages || query.isFetching
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
