"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  adminDeanReviewQueryKey,
  titleDefenseRoleLabel,
  type DeanAdviserReviewDto,
} from "@/lib/admin-adviser-review";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  RefreshCw,
  XCircle,
} from "lucide-react";

type PendingDecision = {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  adviserName: string;
} | null;

/**
 * WP10 — Adviser Request Review (Dean decision).
 * No adviser picker: Student already selected the requested adviser and
 * that adviser CONFORMED. Dean only Approves or Rejects.
 */
export default function AdminAdviserRequestReviewPage() {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const [pendingDecision, setPendingDecision] = useState<PendingDecision>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: requests = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: adminDeanReviewQueryKey,
    queryFn: async () => {
      const res = await apiClientRequest(
        "/thesis/adviser/requests/dean-review",
      );
      return (Array.isArray(res) ? res : []) as DeanAdviserReviewDto[];
    },
  });

  const decide = useMutation({
    mutationFn: async () => {
      if (!pendingDecision) throw new Error("No request selected.");
      return apiClientRequest(
        `/thesis/adviser/requests/${pendingDecision.requestId}/dean-response`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: pendingDecision.decision,
            remarks: remarks.trim() ? remarks.trim() : undefined,
          }),
        },
      );
    },
    onSuccess: async () => {
      setActionError(null);
      setPendingDecision(null);
      setRemarks("");
      await queryClient.invalidateQueries({
        queryKey: adminDeanReviewQueryKey,
      });
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to record the Dean decision.");
      setPendingDecision(null);
      setRemarks("");
      void queryClient.invalidateQueries({
        queryKey: adminDeanReviewQueryKey,
      });
      void refetch();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          Adviser Request Review
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review adviser requests that have received the requested
          adviser&apos;s CONFORME and are waiting for Dean decision.
        </p>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Decision failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <Card>
          <CardContent className="pt-6 text-sm text-(--earist-body-text)">
            Loading adviser requests…
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-red-600">
              Unable to load adviser requests for Dean review.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 pt-8 pb-8 text-center">
            <Inbox className="h-8 w-8 text-(--earist-body-text)/40" />
            <p className="text-sm text-(--earist-body-text)">
              No adviser requests are currently waiting for Dean review.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {requests.map((row) => (
          <Card key={row.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-(--earist-primary)">
                  {row.student.name}
                </span>
                <Badge variant="outline">
                  {row.student.studentNumber || "—"}
                </Badge>
                <Badge className="bg-amber-100 text-amber-800">
                  Waiting for Dean review
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-(--earist-body-text)">Program</p>
                  <p>{row.student.program || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-(--earist-body-text)">
                    Request date
                  </p>
                  <p>
                    {row.requestDate
                      ? new Date(row.requestDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-(--earist-body-text)">
                    Official selected title
                  </p>
                  <p className="font-medium text-(--earist-primary)">
                    {row.officialTitle || "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-(--earist-body-text)">
                    Requested adviser
                  </p>
                  <p className="font-medium">
                    {row.requestedAdviser.name}
                    <span className="ml-2 font-normal text-(--earist-body-text)">
                      {titleDefenseRoleLabel(row.titleDefenseRole)}
                      {row.requestedAdviser.specialization
                        ? ` · ${row.requestedAdviser.specialization}`
                        : ""}
                      {row.requestedAdviser.officeAffiliation
                        ? ` · ${row.requestedAdviser.officeAffiliation}`
                        : ""}
                    </span>
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-(--earist-body-text)">
                    Student remarks
                  </p>
                  <p>{row.reason || "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-(--earist-body-text)">
                    Adviser response
                  </p>
                  <p>
                    CONFORME recorded
                    {row.adviserRespondedAt
                      ? ` · ${new Date(row.adviserRespondedAt).toLocaleDateString()}`
                      : ""}
                    {row.adviserRemarks ? ` — ${row.adviserRemarks}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  className="bg-green-600 text-white hover:bg-green-700"
                  onClick={() =>
                    setPendingDecision({
                      requestId: row.id,
                      decision: "APPROVED",
                      adviserName: row.requestedAdviser.name,
                    })
                  }
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Request
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600"
                  onClick={() =>
                    setPendingDecision({
                      requestId: row.id,
                      decision: "REJECTED",
                      adviserName: row.requestedAdviser.name,
                    })
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDecision(null);
            setRemarks("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingDecision?.decision === "APPROVED"
                ? "Approve this adviser request?"
                : "Reject this adviser request?"}
            </DialogTitle>
            <DialogDescription>
              {pendingDecision?.decision === "APPROVED"
                ? `The requested adviser has already recorded CONFORME. Approval will officially assign ${pendingDecision.adviserName} as the student's adviser.`
                : "No active adviser assignment will be created. The student may submit another valid adviser request."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              className="text-xs font-medium text-(--earist-body-text)"
              htmlFor="dean-remarks"
            >
              Dean Remarks (Optional)
            </label>
            <Textarea
              id="dean-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Optional remarks for this decision"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingDecision(null);
                setRemarks("");
              }}
              disabled={decide.isPending}
            >
              Go Back
            </Button>
            <Button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate()}
              className={
                pendingDecision?.decision === "REJECTED"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }
            >
              {decide.isPending
                ? "Saving…"
                : pendingDecision?.decision === "APPROVED"
                  ? "Approve Request"
                  : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
