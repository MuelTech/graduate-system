"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import {
  panelistAdviserRequestsQueryKey,
  requestStatusLabel,
  resolvePanelistRequestUiState,
  titleDefenseRoleLabel,
  type PanelistAdviserRequestDto,
} from "@/lib/panelist-adviser-requests";
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
  Clock,
  Inbox,
  RefreshCw,
  XCircle,
} from "lucide-react";

type PendingAction = {
  requestId: string;
  decision: "CONFORMED" | "DECLINED";
} | null;

export default function PanelistAdviserRequestsPage() {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: requests = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: panelistAdviserRequestsQueryKey,
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/adviser/requests/mine");
      return (Array.isArray(res) ? res : []) as PanelistAdviserRequestDto[];
    },
  });

  const respond = useMutation({
    mutationFn: async () => {
      if (!pendingAction) throw new Error("No request selected.");
      return apiClientRequest(
        `/thesis/adviser/requests/${pendingAction.requestId}/adviser-response`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: pendingAction.decision,
            remarks: remarks.trim() ? remarks.trim() : undefined,
          }),
        },
      );
    },
    onSuccess: async () => {
      setActionError(null);
      setPendingAction(null);
      setRemarks("");
      await queryClient.invalidateQueries({
        queryKey: panelistAdviserRequestsQueryKey,
      });
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to record your response.");
      setPendingAction(null);
      setRemarks("");
      void queryClient.invalidateQueries({
        queryKey: panelistAdviserRequestsQueryKey,
      });
      void refetch();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-(--earist-primary)">
          Adviser Requests
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Review adviser requests sent to you by students whose Title Defense
          panel included you as an eligible adviser candidate.
        </p>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Response failed</AlertTitle>
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
              Unable to load adviser requests.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 pt-8 pb-8 text-center">
            <Inbox className="h-8 w-8 text-(--earist-body-text)/40" />
            <p className="text-sm text-(--earist-body-text)">
              No adviser requests have been sent to you yet.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {requests.map((row) => {
          const state = resolvePanelistRequestUiState(row);
          const label = requestStatusLabel(state);
          const actionable = state === "ACTIONABLE";

          return (
            <Card key={row.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-(--earist-primary)">
                    {row.student.name}
                  </span>
                  <Badge variant="outline">
                    {row.student.studentNumber || "—"}
                  </Badge>
                  <Badge
                    className={
                      state === "ACTIONABLE"
                        ? "bg-amber-100 text-amber-800"
                        : state === "DECLINED"
                          ? "bg-red-100 text-red-800"
                          : state === "CONFORMED_DEAN_APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : state === "CONFORMED_DEAN_REJECTED"
                              ? "bg-red-100 text-red-800"
                              : "bg-sky-100 text-sky-800"
                    }
                  >
                    {state === "ACTIONABLE" && (
                      <Clock className="mr-1 inline h-3 w-3" />
                    )}
                    {state === "DECLINED" && (
                      <XCircle className="mr-1 inline h-3 w-3" />
                    )}
                    {state === "CONFORMED_WAITING_DEAN" && (
                      <Clock className="mr-1 inline h-3 w-3" />
                    )}
                    {state === "CONFORMED_DEAN_APPROVED" && (
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                    )}
                    {label}
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
                      Your Title Defense role
                    </p>
                    <p>{titleDefenseRoleLabel(row.titleDefenseRole)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-(--earist-body-text)">
                      Official research title
                    </p>
                    <p className="font-medium text-(--earist-primary)">
                      {row.officialTitle || "—"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-(--earist-body-text)">
                      Student remarks
                    </p>
                    <p>{row.reason || "—"}</p>
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
                  {row.adviserRespondedAt && (
                    <div>
                      <p className="text-xs text-(--earist-body-text)">
                        Your response
                      </p>
                      <p>
                        {new Date(row.adviserRespondedAt).toLocaleDateString()}
                        {row.adviserRemarks ? ` — ${row.adviserRemarks}` : ""}
                      </p>
                    </div>
                  )}
                </div>

                {state === "CONFORMED_WAITING_DEAN" && (
                  <p className="rounded-md bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
                    Your response has been recorded. This request is now waiting
                    for Dean approval. No active adviser assignment exists yet.
                  </p>
                )}
                {state === "CONFORMED_DEAN_APPROVED" && (
                  <p className="text-xs text-emerald-800">
                    Dean approved this adviser request.
                  </p>
                )}
                {state === "CONFORMED_DEAN_REJECTED" && (
                  <div className="space-y-1 text-xs text-red-800">
                    <p>Dean rejected this adviser request.</p>
                    {row.deanRemarks && <p>Dean remarks: {row.deanRemarks}</p>}
                  </div>
                )}
                {state === "DECLINED" && (
                  <p className="text-xs text-(--earist-body-text)">
                    You declined this request. The student may submit another
                    valid adviser request.
                  </p>
                )}

                {actionable && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
                      onClick={() =>
                        setPendingAction({
                          requestId: row.id,
                          decision: "CONFORMED",
                        })
                      }
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      CONFORME / Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600"
                      onClick={() =>
                        setPendingAction({
                          requestId: row.id,
                          decision: "DECLINED",
                        })
                      }
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setRemarks("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.decision === "CONFORMED"
                ? "Record CONFORME?"
                : "Decline Adviser Request?"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.decision === "CONFORMED"
                ? "After you accept, this request will be forwarded for Dean review. You are not yet the officially assigned adviser until Dean approval."
                : "No adviser assignment will be created. The student may submit another valid adviser request."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              className="text-xs font-medium text-(--earist-body-text)"
              htmlFor="response-remarks"
            >
              Response Remarks (Optional)
            </label>
            <Textarea
              id="response-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Optional note for the student"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingAction(null);
                setRemarks("");
              }}
              disabled={respond.isPending}
            >
              Go Back
            </Button>
            <Button
              type="button"
              disabled={respond.isPending}
              onClick={() => respond.mutate()}
              className={
                pendingAction?.decision === "DECLINED"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-(--earist-primary) hover:bg-(--earist-primary)/90"
              }
            >
              {respond.isPending
                ? "Saving…"
                : pendingAction?.decision === "CONFORMED"
                  ? "Record CONFORME"
                  : "Decline Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
