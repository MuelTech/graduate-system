"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { facultyKey } from "@/lib/faculty-access";
import { useFacultyAccess } from "@/components/faculty/faculty-access-provider";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface FacultyProfile {
  isExternal: boolean;
  specialization?: string | null;
  officeAffiliation?: string | null;
  highestEducationalAttainment?: string | null;
}

export default function FacultyProfile() {
  const { accountId } = useFacultyAccess();
  const query = useQuery<FacultyProfile>({
    queryKey: facultyKey(accountId, "profile"),
    queryFn: ({ signal }) => apiClientRequest("/panelists/me", { signal }),
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Faculty Profile" />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          {query.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : query.isError || !query.data ? (
            <div role="alert" className="space-y-3">
              <p>Unable to load your profile.</p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                Retry profile
              </Button>
            </div>
          ) : (
            <dl className="grid gap-6 sm:grid-cols-2">
              {[
                [
                  "Classification",
                  query.data.isExternal ? "External" : "Internal",
                ],
                ["Specialization", query.data.specialization],
                ["Office / Affiliation", query.data.officeAffiliation],
                [
                  "Highest Educational Attainment",
                  query.data.highestEducationalAttainment,
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-sm text-(--earist-body-text)">{label}</dt>
                  <dd className="mt-1 font-medium break-words text-(--earist-secondary)">
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
