"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, Users } from "lucide-react";
import type { ActivePanelistCandidate, DefensePanelRole } from "@/types";
import { AddCommitteeMemberDialog } from "./add-committee-member-dialog";
import { ROLE_LABELS, panelistToMember, type CommitteeMember } from "./types";

type Props = {
  allowedRoles: DefensePanelRole[];
  sessionTotal?: number;
  committee: CommitteeMember[];
  adviser?: CommitteeMember | null;
  onAdd: (m: CommitteeMember) => void;
  onRemove: (userId: string) => void;
  onEditRole: (userId: string, role: DefensePanelRole) => void;
};

export function DefenseCommitteeBuilder({
  allowedRoles,
  sessionTotal,
  committee,
  adviser,
  onAdd,
  onRemove,
  onEditRole,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const assignedUserIds = [
    ...committee.map((c) => c.userId),
    ...(adviser ? [adviser.userId] : []),
  ];

  const handleAdd = ({
    person,
    role,
  }: {
    person: ActivePanelistCandidate;
    role: DefensePanelRole;
  }) => {
    onAdd(panelistToMember(person, role));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            2. Defense Committee
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Users className="mr-1 h-3 w-3" />
            {committee.length + (adviser ? 1 : 0)} members
          </Badge>
        </div>
        <p className="text-xs text-(--earist-body-text)">
          {sessionTotal
            ? `Confirmed session total: ${sessionTotal} (Facilitator + Rapporteur required). Adviser seat is optional and never auto-added.`
            : "Committee size is policy-configurable (session totals 7 Master's / 8 Doctoral)."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {adviser && (
          <div>
            <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
              Thesis Adviser
            </p>
            <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
              <p className="font-semibold">{adviser.name}</p>
              <p className="text-xs text-(--earist-body-text)">{adviser.email}</p>
              <p className="text-xs text-(--earist-body-text)">
                Active thesis adviser relationship (committee seat is optional — add explicitly if needed)
              </p>
              <Badge className="mt-2 bg-amber-100 text-amber-800">
                {ROLE_LABELS.ADVISER}
              </Badge>
            </div>
          </div>
        )}

        <div>
          {adviser && (
            <p className="mb-1 text-xs font-semibold text-(--earist-secondary)">
              Other Committee Members
            </p>
          )}
          {committee.length === 0 && !adviser && (
            <p className="rounded-lg border border-dashed border-(--earist-border-gray) py-6 text-center text-sm text-(--earist-body-text)">
              No committee members assigned yet.
            </p>
          )}
          {committee.length === 0 && adviser && (
            <p className="rounded-lg border border-dashed border-(--earist-border-gray) py-4 text-center text-sm text-(--earist-body-text)">
              No other committee members assigned yet.
            </p>
          )}
          <div className="space-y-2">
            {committee.map((m) => (
              <div
                key={m.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="truncate text-xs text-(--earist-body-text)">
                    {m.email}
                  </p>
                  <p className="truncate text-xs text-(--earist-body-text)">
                    {m.affiliation}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === m.userId ? (
                    <select
                      aria-label={`Edit role for ${m.name}`}
                      value={m.role}
                      onChange={(e) => {
                        onEditRole(
                          m.userId,
                          e.target.value as DefensePanelRole,
                        );
                        setEditingId(null);
                      }}
                      className="rounded-md border border-(--earist-border-gray) px-2 py-1 text-xs"
                    >
                      {allowedRoles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      className={
                        m.role === "CHAIRMAN"
                          ? "bg-(--earist-primary)/10 text-(--earist-primary)"
                          : m.role === "RAPPORTEUR"
                            ? "bg-blue-100 text-blue-700"
                            : m.role === "FACILITATOR"
                              ? "bg-teal-100 text-teal-700"
                              : "bg-gray-100 text-gray-700"
                      }
                    >
                      {ROLE_LABELS[m.role]}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit role for ${m.name}`}
                    onClick={() =>
                      setEditingId(editingId === m.userId ? null : m.userId)
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${m.name}`}
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => onRemove(m.userId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Committee Member
        </Button>

        <AddCommitteeMemberDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          allowedRoles={allowedRoles}
          assignedUserIds={assignedUserIds}
          onAdd={handleAdd}
        />
      </CardContent>
    </Card>
  );
}
