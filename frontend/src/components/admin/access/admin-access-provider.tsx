"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
  useQuery,
} from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { FACULTY_ACCESS_CHANGED } from "@/lib/faculty-access";
import {
  adminAllows,
  adminKey,
  adminRouteAllowed,
  readAdminAccess,
  type AdminAccess,
  type AdminCapability,
} from "@/lib/admin-access";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CurrentAdmin {
  accountId: string;
  access: AdminAccess | null;
  snapshot: AdminAccess | null;
  loading: boolean;
  error: boolean;
  allows: (key: AdminCapability) => boolean;
  refresh: () => Promise<unknown>;
}
const Context = createContext<CurrentAdmin | null>(null);
export function useAdminAccess() {
  const value = useContext(Context);
  if (!value) throw new Error("Admin access provider is required.");
  return value;
}
export function AdminCan({
  capability,
  children,
}: {
  capability: AdminCapability;
  children: React.ReactNode;
}) {
  return useAdminAccess().allows(capability) ? children : null;
}
export function AdminLink(props: React.ComponentProps<typeof Link>) {
  const { access } = useAdminAccess();
  const path =
    typeof props.href === "string"
      ? props.href.split(/[?#]/)[0]
      : props.href.pathname;
  if (path?.startsWith("/admin/") && !adminRouteAllowed(access, path))
    return null;
  return <Link {...props} prefetch={false} />;
}
export function AdminAccessLoading() {
  return (
    <div
      role="status"
      aria-label="Loading account access"
      className="space-y-4"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full" />
      <span className="sr-only">Loading account access…</span>
    </div>
  );
}
export function AdminAccessError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border bg-white p-6">
      <p>Administrator access is temporarily unavailable.</p>
      <Button variant="outline" onClick={retry}>
        Retry account access
      </Button>
    </div>
  );
}

function WorkspaceQueries({
  refresh,
  children,
}: {
  refresh: () => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
        },
        mutationCache: new MutationCache({
          onSuccess: () => {
            void refresh();
          },
        }),
      }),
  );
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function AccessReader({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const query = useQuery({
    queryKey: adminKey(accountId, "access"),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    queryFn: async ({ signal }) =>
      readAdminAccess(
        await apiClientRequest("/auth/me", { signal, cache: "no-store" }),
        accountId,
      ),
  });
  const refresh = query.refetch;
  useEffect(() => {
    const run = () => {
      void refresh();
    };
    const foreground = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    // Reuse FACULTY-14's existing shared API-denial refresh signal. It grants nothing.
    window.addEventListener(FACULTY_ACCESS_CHANGED, run);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      window.removeEventListener("focus", run);
      window.removeEventListener(FACULTY_ACCESS_CHANGED, run);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [refresh]);
  const access = query.isError ? null : (query.data ?? null);
  const loading = query.isFetching || query.isPending;
  const fingerprint = access
    ? `${accountId}:${access.status}:${access.level}:${access.capabilities.join(",")}`
    : `${accountId}:unavailable`;
  return (
    <Context.Provider
      value={{
        accountId,
        access: loading ? null : access,
        snapshot: access,
        loading,
        error: query.isError,
        allows: (key) => !loading && adminAllows(access, key),
        refresh,
      }}
    >
      {/* Read state is outside the private operational client. Permission changes
        remount/clear all old module caches and dialogs before new work renders. */}
      <WorkspaceQueries key={fingerprint} refresh={refresh}>
        {children}
      </WorkspaceQueries>
    </Context.Provider>
  );
}
function AccountAccess({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  return (
    <QueryClientProvider client={client}>
      <AccessReader accountId={accountId}>{children}</AccessReader>
    </QueryClientProvider>
  );
}
export function AdminPortalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status, update } = useSession();
  const sessionError = session?.user?.currentAccountError;
  useEffect(() => {
    if (!sessionError) return;
    const run = () => {
      void update();
    };
    const foreground = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [sessionError, update]);
  if (status === "loading") return <AdminAccessLoading />;
  if (!session?.user) return <Link href="/login">Sign in to continue</Link>;
  if (sessionError || session.user.role !== "admin")
    return (
      <AdminAccessError
        retry={() => {
          void update();
        }}
      />
    );
  return (
    <AccountAccess key={session.user.id} accountId={session.user.id}>
      {children}
    </AccountAccess>
  );
}

/** Presentation only; no endpoint accepts this result as authorization. */
export function AdminRouteGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { snapshot: access, refresh, loading, error } = useAdminAccess();
  const [checked, setChecked] = useState("");
  useEffect(() => {
    let disposed = false;
    void refresh().then(() => {
      if (!disposed) setChecked(path);
    });
    return () => {
      disposed = true;
    };
  }, [path, refresh]);
  if (error)
    return (
      <AdminAccessError
        retry={() => {
          void refresh();
        }}
      />
    );
  if (!access || checked !== path) return <AdminAccessLoading />;
  if (!access || access.status !== "RESOLVED")
    return (
      <div className="space-y-4">
        <p>Administrator access is unavailable.</p>
        <Button variant="outline" onClick={() => void refresh()}>
          Retry account access
        </Button>
      </div>
    );
  if (!adminRouteAllowed(access, path))
    return (
      <div role="status" className="space-y-3">
        <p>Your access has changed.</p>
        <Link
          className="font-semibold text-(--earist-primary) underline"
          href="/admin/dashboard"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  return (
    <>
      {loading && <AdminAccessLoading />}
      <div hidden={loading}>{children}</div>
    </>
  );
}
