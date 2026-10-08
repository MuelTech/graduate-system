"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleAlert, RefreshCw, UserCheck } from "lucide-react";

interface PanelistProfile {
  id: string;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
  specialization?: string | null;
  officeAffiliation?: string | null;
}

/**
 * UIUX-3A: the adviser-availability control moved here from the dashboard.
 * Uses the existing /panelists/me + /panelists/me/availability API and the
 * existing business semantics (external panelists are never adviser-eligible).
 */
export default function PanelistProfile() {
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<PanelistProfile>({
    queryKey: ["panelistProfile"],
    queryFn: async () =>
      (await apiClientRequest("/panelists/me")) as PanelistProfile,
  });

  const toggleMutation = useMutation({
    mutationFn: async (isAvailable: boolean) =>
      apiClientRequest("/panelists/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ isAvailable }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["panelistProfile"] });
    },
  });

  const isExternal = profile?.isExternal === true;
  const saving = toggleMutation.isPending;
  const saveError = toggleMutation.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your profile and adviser availability."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck
              className="h-4 w-4 text-(--earist-secondary)"
              aria-hidden="true"
            />
            Adviser Availability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-between gap-4" aria-busy="true">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
          ) : isError || !profile ? (
            <div className="flex flex-col items-start gap-2 py-2">
              <p className="flex items-center gap-2 text-sm text-(--earist-body-text)">
                <CircleAlert
                  className="h-4 w-4 text-(--earist-secondary)"
                  aria-hidden="true"
                />
                Unable to load your availability setting.
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="inline-flex items-center text-sm font-medium text-(--earist-secondary) hover:underline disabled:opacity-60"
              >
                <RefreshCw
                  className={cn(
                    "mr-1.5 h-3.5 w-3.5",
                    isFetching && "animate-spin",
                  )}
                  aria-hidden="true"
                />
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="adviser-availability" className="text-sm font-medium">
                    Available as Thesis/Dissertation Adviser
                  </Label>
                  <p className="text-xs text-(--earist-body-text)">
                    When available, students may select you as an adviser from
                    your Title Defense panel. This does not create an adviser
                    assignment by itself.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <Switch
                    id="adviser-availability"
                    size="default"
                    checked={profile.isAvailableAsAdviser}
                    disabled={saving || isExternal}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate(checked)
                    }
                    aria-label="Available as Thesis/Dissertation Adviser"
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      profile.isAvailableAsAdviser
                        ? "text-(--earist-body-text)"
                        : "text-(--earist-body-text)",
                    )}
                  >
                    {saving
                      ? "Saving…"
                      : profile.isAvailableAsAdviser
                        ? "Available"
                        : "Not available"}
                  </span>
                </div>
              </div>

              {isExternal ? (
                <p className="text-xs text-(--earist-body-text)">
                  External panelists cannot serve as thesis/dissertation
                  advisers; this setting is unavailable for your account.
                </p>
              ) : null}

              {saveError ? (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  {(toggleMutation.error as Error)?.message ||
                    "Unable to update your availability. Please try again."}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
