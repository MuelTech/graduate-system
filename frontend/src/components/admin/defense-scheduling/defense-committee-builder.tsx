"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Plus,
  Users,
  X,
} from "lucide-react";
import type { CommitteePolicyDto, DefensePanelRole } from "@/types";
import { RoleAssignmentDialog } from "./role-assignment-dialog";
import {
  MANUAL_ROLE_ORDER,
  ROLE_LABELS,
  computeCommitteeReadiness,
  type CommitteeMember,
  type PickerPerson,
} from "./types";

type Props = {
  policy?: CommitteePolicyDto;
  members: CommitteeMember[];
  adviser: CommitteeMember | null;
  onAssignRole: (role: DefensePanelRole, people: PickerPerson[]) => void;
  onRemoveMember: (userId: string) => void;
};

function roleQuota(policy: CommitteePolicyDto | undefined, role: DefensePanelRole): number {
  if (!policy) return role === "PANELIST" ? 0 : 1;
  if (role === "PANELIST") return policy.panelistCount;
  return policy.maximumRoleCount[role] ?? 1;
}

export function DefenseCommitteeBuilder({
  policy,
  members,
  adviser,
  onAssignRole,
  onRemoveMember,
}: Props) {
  const [activeRole, setActiveRole] = useState<DefensePanelRole | null>(null);
  const readiness = computeCommitteeReadiness(policy, members, adviser);

  const membersOf = (role: DefensePanelRole) =>
    members.filter((m) => m.role === role);

  const assignedElsewhere = (role: DefensePanelRole) => [
    ...members
      .filter((m) => m.role !== role)
      .map((m) => ({ userId: m.userId, label: ROLE_LABELS[m.role] })),
    ...(adviser ? [{ userId: adviser.userId, label: "Adviser" }] : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Defense Committee
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Users className="mr-1 h-3 w-3" aria-hidden="true" />
            {readiness.totalCount} / {readiness.sessionTotal} assigned
          </Badge>
        </div>
        <p className="text-xs text-(--earist-body-text)">
          {readiness.adviserMode === "AUTOMATIC"
            ? "The active thesis adviser occupies one seat automatically; assign the remaining participants."
            : "Assign all session participants for this Title Defense."}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {adviser && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-(--earist-secondary)">
                Adviser
              </p>
              <span className="text-xs text-(--earist-body-text)">1 / 1</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold break-words">
                  {adviser.name}
                </p>
                <p className="text-xs text-(--earist-body-text)">
                  Active thesis adviser — managed in the Adviser workflow
                </p>
              </div>
              <Badge variant="outline" className="gap-1 text-xs">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Automatic
              </Badge>
            </div>
          </div>
        )}

        {MANUAL_ROLE_ORDER.map((role) => {
          const roleMembers = membersOf(role);
          const quota = roleQuota(policy, role);
          return (
            <div key={role}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-(--earist-secondary)">
                  {ROLE_LABELS[role]}
                </p>
                <span className="text-xs text-(--earist-body-text)">
                  {roleMembers.length} / {quota}
                </span>
              </div>
              <div className="space-y-2">
                {roleMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--earist-border-gray) p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold break-words">
                        {m.name}
                      </p>
                      <p className="text-xs text-(--earist-body-text)">
                        {m.email || m.affiliation}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${m.name} from ${ROLE_LABELS[role]}`}
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveMember(m.userId)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveRole(role)}
                >
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {role === "PANELIST"
                    ? "Select Panelists"
                    : `Assign ${ROLE_LABELS[role]}`}
                </Button>
              </div>
            </div>
          );
        })}

        {readiness.missing.length > 0 ? (
          <p className="rounded-md bg-(--earist-surface-gray) px-3 py-2 text-xs text-(--earist-body-text)">
            {readiness.missing.join(" · ")}
          </p>
        ) : (
          <p className="rounded-md bg-(--earist-surface-gray) px-3 py-2 text-xs text-(--earist-success)">
            Committee complete.
          </p>
        )}
      </CardContent>

      {activeRole && (
        <RoleAssignmentDialog
          key={activeRole}
          open={activeRole !== null}
          onOpenChange={(open) => {
            if (!open) setActiveRole(null);
          }}
          role={activeRole}
          multi={activeRole === "PANELIST"}
          maxCount={roleQuota(policy, activeRole)}
          current={membersOf(activeRole)}
          assignedElsewhere={assignedElsewhere(activeRole)}
          onConfirm={(people) => onAssignRole(activeRole, people)}
        />
      )}
    </Card>
  );
}
