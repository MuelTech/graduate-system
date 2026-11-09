"use client";
import { AdminDialogContent as DialogContent } from "@/components/admin/access/admin-dialog";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  ADMINISTRATORS_API,
  ADMIN_CAPABILITY_LABELS,
  adminKey,
  administratorError,
  fullAdministrator,
  readAdministrator,
  type AdministratorAccount,
} from "@/lib/admin-access";
import { useAdminAccess } from "@/components/admin/access/admin-access-provider";
import { AdministratorForm } from "@/components/admin/administrators/administrator-form";
import {
  AdministratorCredentialDialog,
  type AdministratorCredential,
} from "@/components/admin/administrators/temporary-credential";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AdministratorsPage() {
  const { accountId, access, snapshot, refresh } = useAdminAccess();
  const allowed = fullAdministrator(access);
  const readable = fullAdministrator(snapshot);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdministratorAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [credential, setCredential] = useState<AdministratorCredential | null>(
    null,
  );
  const createButton = useRef<HTMLButtonElement>(null);
  const restoreCreateFocus = useRef(false);
  useEffect(() => {
    if (
      !restoreCreateFocus.current ||
      !allowed ||
      credential ||
      creating ||
      editing
    )
      return;
    const frame = requestAnimationFrame(() => {
      createButton.current?.focus();
      restoreCreateFocus.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [allowed, credential, creating, editing]);
  const client = useQueryClient();
  const prefix = adminKey(accountId, "administrators");
  const query = useQuery({
    queryKey: [...prefix, "list", page],
    enabled: readable,
    queryFn: async ({ signal }) => {
      const value = await apiClientRequest(
        `${ADMINISTRATORS_API}?page=${page}&pageSize=25`,
        { signal, cache: "no-store" },
      );
      if (!value || !Array.isArray(value.accounts))
        throw new Error("Invalid Administrator list");
      return value.accounts.map(readAdministrator) as AdministratorAccount[];
    },
  });
  const detail = useQuery({
    queryKey: [...prefix, "detail", selected],
    enabled: readable && Boolean(selected),
    queryFn: async ({ signal }) =>
      readAdministrator(
        await apiClientRequest(
          `${ADMINISTRATORS_API}/${encodeURIComponent(selected!)}`,
          { signal, cache: "no-store" },
        ),
      ),
  });
  async function saved() {
    await client.invalidateQueries({ queryKey: prefix });
    await refresh();
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrators Management"
        description="Manage Administrator accounts and access."
        actions={
          <Button
            ref={createButton}
            disabled={!allowed}
            onClick={() => setCreating(true)}
          >
            Create Administrator
          </Button>
        }
      />
      {query.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError ? (
        <Card>
          <CardContent role="alert" className="space-y-3 p-6">
            <p>{administratorError(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !query.data?.length ? (
        <Card>
          <CardContent className="py-10 text-center">
            No Administrator accounts on this page.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[650px] text-left text-sm">
              <caption className="sr-only">Administrator accounts</caption>
              <thead className="border-b bg-(--earist-surface-gray)">
                <tr>
                  {[
                    "Administrator",
                    "Account Status",
                    "Access Level",
                    "Access",
                    "Action",
                  ].map((label) => (
                    <th key={label} scope="col" className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {query.data.map((account) => (
                  <tr key={account.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold">
                        {account.firstName} {account.lastName}
                      </p>
                      <p className="text-xs break-all text-muted-foreground">
                        {account.email}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="outline">
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {account.mustChangePassword && (
                        <p className="mt-1 text-xs">Password change required</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {account.level === "FULL"
                        ? "Full Administrator"
                        : account.level === "RESTRICTED"
                          ? "Restricted Administrator"
                          : "Access unavailable"}
                    </td>
                    <td className="px-4 py-4">
                      {!account.managed
                        ? "Review required"
                        : account.level === "FULL"
                          ? "All administrative access"
                          : `${account.capabilityKeys.length} selected actions`}
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        variant="outline"
                        onClick={() => setSelected(account.id)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={page === 1 || query.isFetching}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </Button>
        <span className="text-sm">Page {page}</span>
        <Button
          variant="outline"
          disabled={query.isFetching || !query.data || query.data.length < 25}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </Button>
      </div>
      {selected && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Administrator Details</DialogTitle>
              <DialogDescription>
                Account and configured access.
              </DialogDescription>
            </DialogHeader>
            {detail.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : detail.isError || !detail.data ? (
              <div role="alert" className="space-y-3">
                <p>{administratorError(detail.error)}</p>
                <Button variant="outline" onClick={() => void detail.refetch()}>
                  Reload Details
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold">
                    {detail.data.firstName} {detail.data.lastName}
                  </p>
                  <p className="break-all">{detail.data.email}</p>
                </div>
                <p>
                  {detail.data.isActive ? "Active" : "Inactive"} ·{" "}
                  {detail.data.level === "FULL"
                    ? "Full Administrator"
                    : detail.data.level === "RESTRICTED"
                      ? "Restricted Administrator"
                      : "Access unavailable"}
                </p>
                {!detail.data.managed ? (
                  <p>
                    This account requires access review before it can be
                    changed.
                  </p>
                ) : detail.data.level === "FULL" ? (
                  <p>All administrative access.</p>
                ) : (
                  <div>
                    <p>
                      {detail.data.capabilityKeys.length
                        ? "Selected access:"
                        : "Account access only. No administrative modules assigned."}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {detail.data.capabilityKeys.map((key) => (
                        <li key={key}>{ADMIN_CAPABILITY_LABELS[key]}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                  {detail.data.managed && (
                    <Button
                      disabled={!allowed || detail.isFetching}
                      onClick={() => {
                        setEditing(detail.data!);
                        setSelected(null);
                      }}
                    >
                      Edit Access
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
      {(creating || editing) && (
        <AdministratorForm
          key={editing?.id ?? "create"}
          account={editing ?? undefined}
          canManage={allowed}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={saved}
          onCreated={setCredential}
        />
      )}
      {credential && (
        <AdministratorCredentialDialog
          value={credential}
          close={() => {
            restoreCreateFocus.current = true;
            setCredential(null);
          }}
          returnFocus={() => createButton.current}
        />
      )}
    </div>
  );
}
