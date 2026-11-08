"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  FACULTY_ACCESS_CHANGED,
  facultyAreaForPath,
  facultyKey,
  readFacultyWork,
  type FacultyWork,
} from "@/lib/faculty-access";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type AccessContext = {
  accountId: string;
  work: FacultyWork | null;
  snapshot: FacultyWork | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<unknown>;
};
const Context = createContext<AccessContext | null>(null);

export function useFacultyAccess() {
  const access = useContext(Context);
  if (!access) throw new Error("Faculty access provider is required.");
  return access;
}

export function FacultyAccessLoading() {
  return (
    <div
      role="status"
      aria-label="Loading account access"
      className="space-y-4"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-36 w-full" />
      <span className="sr-only">Loading account access…</span>
    </div>
  );
}

export function FacultyAccessError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border bg-white p-6">
      <p>Account access is temporarily unavailable.</p>
      <Button variant="outline" onClick={retry}>
        Retry account access
      </Button>
    </div>
  );
}

function AccessReader({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const query = useQuery({
    queryKey: facultyKey(accountId, "access"),
    queryFn: async ({ signal }) =>
      readFacultyWork(
        await apiClientRequest("/auth/me", { signal, cache: "no-store" }),
        accountId,
      ),
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const refetch = query.refetch;
  useEffect(() => {
    const refresh = () => {
      void refetch();
    };
    const foreground = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener(FACULTY_ACCESS_CHANGED, refresh);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(FACULTY_ACCESS_CHANGED, refresh);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [refetch]);
  const snapshot = query.isError ? null : (query.data ?? null);
  return (
    <Context.Provider
      value={{
        accountId,
        snapshot,
        work: query.isFetching ? null : snapshot,
        loading: query.isPending || query.isFetching,
        error: query.isError,
        refresh: refetch,
      }}
    >
      {children}
    </Context.Provider>
  );
}

/** A fresh private QueryClient per Faculty account. Existing workspace keys are
 * isolated too; switching accounts/logout unmounts, cancels and clears this cache.
 * This prevents inherited legacy generic keys from crossing account boundaries.
 */
function AccountQueries({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const [client] = useState(() => {
    const instance = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
      },
      mutationCache: new MutationCache({
        onSuccess: () => {
          void instance.invalidateQueries({
            queryKey: facultyKey(accountId, "access"),
          });
        },
      }),
    });
    return instance;
  });
  useEffect(
    () => () => {
      client.clear();
    },
    [client],
  );
  return (
    <QueryClientProvider client={client}>
      <AccessReader accountId={accountId}>{children}</AccessReader>
    </QueryClientProvider>
  );
}

export function FacultyPortalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status, update } = useSession();
  // Session synchronization may itself fail before the account query can run.
  // Keep foreground recovery available even while that private scope is absent.
  const sessionError = session?.user?.currentAccountError;
  useEffect(() => {
    if (!sessionError) return;
    const refresh = () => {
      void update();
    };
    const foreground = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [sessionError, update]);
  if (status === "loading") return <FacultyAccessLoading />;
  if (!session?.user) return <Link href="/login">Sign in to continue</Link>;
  if (
    session.user.currentAccountError ||
    !["faculty", "panelist"].includes(session.user.role)
  ) {
    return (
      <FacultyAccessError
        retry={() => {
          void update();
        }}
      />
    );
  }
  return (
    <AccountQueries key={session.user.id} accountId={session.user.id}>
      {children}
    </AccountQueries>
  );
}

/** Presentation guard only. Every exact API still reauthorizes the resource.
 * Refresh once per navigation before showing a blocked direct route. During a
 * foreground refresh, hide the workspace while preserving a mounted score draft.
 */
export function FacultyRouteGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const access = useFacultyAccess();
  const [checkedPath, setCheckedPath] = useState("");
  const refresh = access.refresh;
  useEffect(() => {
    let disposed = false;
    void refresh().then(() => {
      if (!disposed) setCheckedPath(path);
    });
    return () => {
      disposed = true;
    };
  }, [path, refresh]);
  const area = facultyAreaForPath(path);
  if (access.error)
    return (
      <FacultyAccessError
        retry={() => {
          void refresh();
        }}
      />
    );
  if (!area) return children;
  const loading = checkedPath !== path || access.loading;
  const permitted =
    checkedPath === path && access.snapshot?.[area].relevant === true;
  return (
    <>
      {loading && <FacultyAccessLoading />}
      {permitted && <div hidden={loading}>{children}</div>}
      {!loading && !permitted && (
        <div role="status" className="space-y-3">
          <p>Your access has changed.</p>
          <Link
            className="font-semibold text-(--earist-primary) underline"
            href="/panelist/dashboard"
          >
            Return to Dashboard
          </Link>
        </div>
      )}
    </>
  );
}
