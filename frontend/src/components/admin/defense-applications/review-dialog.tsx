"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { DocumentViewer } from "@/components/ui/document-viewer";
import {
  STAGE_LABELS,
  STATUS_LABELS,
  requirementLabel,
} from "./labels";
import type { DefenseApplicationDto } from "./application-card";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: DefenseApplicationDto | null;
  onApprove: (thesisId: string) => void;
  onReject: (thesisId: string, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
};

export function DefenseApplicationReviewDialog({
  open,
  onOpenChange,
  app,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: Props) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{ fetchUrl: string; title: string } | null>(
    null,
  );

  if (!app) return null;
  const student = app.student;
  const isTitle = app.stage === "TITLE";
  const isProposal = app.stage === "PROPOSAL";
  const isFinal = app.stage === "FINAL";
  const selectedTitle = app.thesisTitles.find((t) => t.isSelected) ?? null;
  const adviser = app.assignment?.adviser;
  const canDecide = app.status === "PENDING";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Defense Application</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs text-(--earist-body-text)">Student</p>
                <p className="font-semibold">
                  {student.user.firstName} {student.user.lastName}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {student.studentNumber || student.user.email}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  {student.program?.programName || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-(--earist-body-text)">Defense</p>
                <p className="font-semibold">{STAGE_LABELS[app.stage]}</p>
                <p className="text-xs text-(--earist-body-text)">
                  Submitted {new Date(app.createdAt).toLocaleDateString()}
                </p>
                <Badge className="mt-1">
                  {STATUS_LABELS[app.status] ?? app.status}
                </Badge>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                Requirements
              </p>
              <ul className="space-y-1">
                {(app.thesisDocuments ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-md bg-(--earist-surface-gray) px-3 py-2"
                  >
                    <span>
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-green-600" />
                      {requirementLabel(d.docType)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`View ${requirementLabel(d.docType)}`}
                      onClick={() =>
                        setViewerDoc({
                          fetchUrl: `/api/documents/thesis-document/${d.id}/file`,
                          title: requirementLabel(d.docType),
                        })
                      }
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                  </li>
                ))}
                {(app.thesisDocuments ?? []).length === 0 && (
                  <li className="text-(--earist-body-text)">
                    No documents uploaded yet.
                  </li>
                )}
              </ul>
            </div>

            {isTitle && (
              <div>
                <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                  Proposed Research Titles (all remain proposals)
                </p>
                <ol className="list-decimal space-y-1 pl-5">
                  {app.thesisTitles.map((t) => (
                    <li key={t.id}>{t.titleText}</li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-(--earist-body-text)">
                  Winning title is selected only at Title Defense conclusion.
                  Application approval does not select a title.
                </p>
              </div>
            )}

            {(isProposal || isFinal) && (
              <div>
                <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
                  Official Approved Research Title
                </p>
                <p>{selectedTitle?.titleText || "Not selected yet"}</p>
                <p className="mt-2 text-xs font-semibold text-(--earist-secondary)">
                  Thesis Adviser
                </p>
                {adviser ? (
                  <p>
                    Dr. {adviser.firstName} {adviser.lastName}
                  </p>
                ) : (
                  <div className="rounded-md bg-amber-50 p-2 text-amber-800">
                    <p>Not assigned</p>
                    <p className="text-xs">
                      ⚠ This application cannot proceed until an active Thesis
                      Adviser is assigned.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isFinal && (
              <p className="text-xs text-(--earist-body-text)">
                Final Defense covers the complete manuscript. Rapporteur Report
                is only created after the defense is conducted and concluded.
              </p>
            )}

            {app.status === "REJECTED" && app.rejectionReason && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                Rejection reason: {app.rejectionReason}
              </p>
            )}

            {canDecide && (
              <div className="border-t border-(--earist-border-gray) pt-3">
                <p className="mb-2 text-xs font-semibold text-(--earist-secondary)">
                  Admin Decision
                </p>
                {!showReject ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="text-red-600"
                      onClick={() => setShowReject(true)}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      Reject Application
                    </Button>
                    <Button
                      className="bg-green-600 text-white hover:bg-green-700"
                      disabled={isApproving}
                      onClick={() => onApprove(app.id)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {isApproving ? "Approving..." : "Approve Application"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label
                      className="text-xs font-medium text-(--earist-secondary)"
                      htmlFor="reject-reason"
                    >
                      Reason for rejection *
                    </label>
                    <textarea
                      id="reject-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm"
                      placeholder="Explain what must be corrected..."
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowReject(false);
                          setRejectReason("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="bg-red-600 text-white hover:bg-red-700"
                        disabled={!rejectReason.trim() || isRejecting}
                        onClick={() => onReject(app.id, rejectReason.trim())}
                      >
                        {isRejecting ? "Rejecting..." : "Reject Application"}
                      </Button>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-(--earist-body-text)">
                  Approve this defense application? The application will become
                  ready for panel assignment and scheduling. This does not select
                  a title or mark the defense as passed.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewerDoc && (
        <DocumentViewer
          open={!!viewerDoc}
          onOpenChange={(open) => {
            if (!open) setViewerDoc(null);
          }}
          fetchUrl={viewerDoc.fetchUrl}
          title={viewerDoc.title}
        />
      )}
    </>
  );
}
