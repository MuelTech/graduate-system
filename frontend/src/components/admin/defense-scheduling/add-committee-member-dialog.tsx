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
import { Label } from "@/components/ui/label";
import type { ActivePanelistCandidate, DefensePanelRole } from "@/types";
import { PanelistSearchCombobox } from "./panelist-search-combobox";
import { ROLE_LABELS } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedRoles: DefensePanelRole[];
  assignedUserIds: string[];
  onAdd: (member: {
    person: ActivePanelistCandidate;
    role: DefensePanelRole;
  }) => void;
};

export function AddCommitteeMemberDialog({
  open,
  onOpenChange,
  allowedRoles,
  assignedUserIds,
  onAdd,
}: Props) {
  const [person, setPerson] = useState<ActivePanelistCandidate | null>(null);
  const [role, setRole] = useState<DefensePanelRole>(
    allowedRoles[0] ?? "PANELIST",
  );

  const handleAdd = () => {
    if (!person) return;
    onAdd({ person, role });
    setPerson(null);
    setRole(allowedRoles[0] ?? "PANELIST");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Committee Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Search Panelist</Label>
            <div className="mt-1">
              <PanelistSearchCombobox
                assignedUserIds={assignedUserIds}
                selected={person}
                onSelect={setPerson}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs" htmlFor="committee-role">
              Assign Role
            </Label>
            <select
              id="committee-role"
              value={role}
              onChange={(e) => setRole(e.target.value as DefensePanelRole)}
              className="mt-1 w-full rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm"
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          {person && (
            <p className="text-xs text-(--earist-body-text)">
              Selected: <strong>{person.firstName} {person.lastName}</strong> as{" "}
              <strong>{ROLE_LABELS[role]}</strong>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!person}
            className="bg-(--earist-primary) text-white hover:bg-(--earist-primary)/90"
          >
            Add to Committee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
