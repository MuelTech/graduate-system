"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import type { ApprovedApplicationDto } from "@/types";
import {
  ROLE_LABELS,
  defenseTypeLabel,
  type CommitteeMember,
  type ScheduleFormState,
} from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: ApprovedApplicationDto;
  committee: CommitteeMember[];
  adviser?: CommitteeMember | null;
  schedule: ScheduleFormState;
};

export function EmailPreviewDialog({
  open,
  onOpenChange,
  application,
  committee,
  adviser,
  schedule,
}: Props) {
  const student = application.student;
  const recipients = [...(adviser ? [adviser] : []), ...committee];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Email Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-(--earist-secondary)">
              Recipients
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">
                <Mail className="mr-1 h-3 w-3" />
                {student.user.firstName} {student.user.lastName}
              </Badge>
              {recipients.map((m) => (
                <Badge key={m.userId} variant="outline" className="text-xs">
                  <Mail className="mr-1 h-3 w-3" />
                  {m.name} ({ROLE_LABELS[m.role]})
                </Badge>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-(--earist-border-gray) p-4">
            <p className="mb-2 font-semibold text-(--earist-primary)">
              Subject: Defense Schedule — {defenseTypeLabel(application.stage)}
            </p>
            <div className="space-y-2 text-(--earist-body-text)">
              <p>Dear [Recipient],</p>
              <p>
                This is to inform you that a{" "}
                <span className="font-semibold">
                  {defenseTypeLabel(application.stage)}
                </span>{" "}
                has been scheduled.
              </p>
              <div className="rounded-lg bg-(--earist-surface-gray) p-3">
                <p className="font-semibold text-(--earist-primary)">
                  Defense Details
                </p>
                <p>Researcher: {student.user.firstName} {student.user.lastName}</p>
                <p>Program: {student.program?.programName || "N/A"}</p>
                <p>Date: {schedule.defenseDate}</p>
                <p>Time: {schedule.defenseTime}</p>
                <p>MS Teams: {schedule.meetingLink}</p>
              </div>
              <p className="text-xs">
                This preview does not send email. Notification is sent when you
                confirm Schedule Defense &amp; Notify.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
