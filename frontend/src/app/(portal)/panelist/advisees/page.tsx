import { Suspense } from "react";

import { MyAdviseesWorkspace } from "@/components/panelist/my-advisees-workspace";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * ADV-6: the search-param-consuming workspace lives under Suspense so Next.js
 * can keep the route prerender-safe while the URL controls the active context.
 */
export default function MyAdviseesPage() {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto w-full max-w-6xl space-y-4"
          aria-busy="true"
          aria-live="polite"
        >
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <MyAdviseesWorkspace />
    </Suspense>
  );
}
