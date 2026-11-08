"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  FACULTY_API,
  FACULTY_QUERY_KEY,
  facultyError,
  facultyName,
  mapFaculty,
} from "@/lib/faculty-management";
import type { Faculty, FacultyResponse } from "@/types/faculty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FacultyDetailDialog({
  id,
  accountId,
  canManage,
  onClose,
  onEdit,
}: {
  id: string;
  accountId: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: (faculty: Faculty) => void;
}) {
  const query = useQuery({
    queryKey: [...FACULTY_QUERY_KEY, accountId, "detail", id],
    retry: false,
    staleTime: 0,
    queryFn: async () =>
      mapFaculty(
        (await apiClientRequest(
          `${FACULTY_API}/${encodeURIComponent(id)}`,
        )) as FacultyResponse,
      ),
  });
  const faculty = query.data;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Faculty Details</DialogTitle>
          <DialogDescription>
            {faculty ? facultyName(faculty) : "Faculty account information"}
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <div aria-label="Loading Faculty details" className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
          </div>
        ) : query.isError ? (
          <div role="alert" className="space-y-3">
            <p>{facultyError(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : faculty ? (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="font-semibold">Faculty Profile</h3>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Email", faculty.email],
                  [
                    "Classification",
                    faculty.isExternal ? "External" : "Internal",
                  ],
                  ["Qualification", faculty.qualification],
                  ["Office / affiliation", faculty.affiliation],
                  ["Specialization", faculty.specialization],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words">{value || "Not provided"}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Account Status</h3>
              <Badge variant="outline">
                {faculty.isActive ? "Active" : "Inactive"}
              </Badge>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Faculty Access</h3>
              <p>
                Essay Evaluation:{" "}
                {faculty.essayEvaluation ? "Enabled" : "Not enabled"}
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">Adviser Availability</h3>
              <p>
                {faculty.isExternal
                  ? "Not applicable to External Faculty."
                  : `Available as Adviser: ${faculty.isAvailableAsAdviser ? "Yes" : "No"}`}
              </p>
            </section>
            <section className="space-y-2 text-sm text-muted-foreground">
              <h3 className="font-semibold text-foreground">
                Account Activity
              </h3>
              <p>
                Created:{" "}
                {new Date(faculty.createdAt).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
                {faculty.createdBy ? ` by ${faculty.createdBy}` : ""}
              </p>
              <p>
                Updated:{" "}
                {new Date(faculty.updatedAt).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
                {faculty.updatedBy ? ` by ${faculty.updatedBy}` : ""}
              </p>
            </section>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canManage && faculty && !query.isError && !query.isFetching && (
            <Button onClick={() => onEdit(faculty)}>Edit Faculty</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
