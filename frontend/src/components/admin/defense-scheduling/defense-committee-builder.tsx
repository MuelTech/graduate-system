"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Lock, Users, X } from "lucide-react";
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
  policyLoading?: boolean;
  policyError?: boolean;
  /** True for Proposal/Final (Adviser seat applies). */
  showAdviser: boolean;
  defenseStageLabel: string;
  programTypeLabel: string;
  members: CommitteeMember[];
  adviser: CommitteeMember | null;
  onAssignRole: (role: DefensePanelRole, people: PickerPerson[]) => void;
  onRemoveMember: (userId: string) => void;
};

function roleQuota(
  policy: CommitteePolicyDto | undefined,
  role: DefensePanelRole,
): number | undefined {
  if (!policy) return undefined;
  if (role === "PANELIST") return policy.panelistCount;
  return policy.maximumRoleCount[role] ?? 1;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function missingSentence(
  readiness: ReturnType<typeof computeCommitteeReadiness>,
): string | null {
  const parts: string[] = [];
  const panelists = readiness.panelistQuota - readiness.panelists;
  if (panelists > 0) parts.push(`${panelists} Panelist${panelists === 1 ? "" : "s"}`);
  if (readiness.rapporteur < 1) parts.push("1 Rapporteur");
  if (readiness.chairman < 1) parts.push("1 Chairman");
  if (readiness.facilitator < 1) parts.push("1 Facilitator");
  if (readiness.adviserMode === "AUTOMATIC" && !readiness.adviserPresent) {
    parts.push("the active adviser");
  }
  if (parts.length === 0) return null;
  return `${joinList(parts)} still required`;
}

export function DefenseCommitteeBuilder({
  policy,
  policyLoading = false,
  policyError = false,
  showAdviser,
  defenseStageLabel,
  programTypeLabel,
  members,
  adviser,
  onAssignRole,
  onRemoveMember,
}: Props) {
  const [activeRole, setActiveRole] = useState<DefensePanelRole | null>(null);
  const readiness = policy
    ? computeCommitteeReadiness(policy, members, adviser)
    : null;

  const membersOf = (role: DefensePanelRole) =>
    members.filter((m) => m.role === role);

  const assignedElsewhere = (role: DefensePanelRole) => [
    ...members
      .filter((m) => m.role !== role)
      .map((m) => ({ userId: m.userId, label: ROLE_LABELS[m.role] })),
    ...(adviser ? [{ userId: adviser.userId, label: "Adviser" }] : []),
  ];

  const totalAssigned = members.length + (adviser ? 1 : 0);
  const sessionTotal = policy?.sessionTotal;
  const actionsDisabled = !policy || policyLoading;

  const requiredCell = (assigned: number, quota?: number) =>
    quota === undefined ? (
      <span className="text-(--earist-body-text)">Loading…</span>
    ) : (
      <span>
        {assigned} / {quota}
      </span>
    );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Defense Committee
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Users className="mr-1 h-3 w-3" aria-hidden="true" />
            {sessionTotal
              ? `${totalAssigned} / ${sessionTotal} assigned`
              : `${totalAssigned} assigned`}
          </Badge>
        </div>
        <p className="text-xs text-(--earist-body-text)">
          {defenseStageLabel} · {programTypeLabel}
        </p>
        <p className="text-xs text-(--earist-body-text)">
          {showAdviser
            ? "The active adviser is included automatically; assign the remaining roles."
            : "Assign all participants required for this session."}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-(--earist-border-gray)">
          {showAdviser && (
            <div className="grid grid-cols-1 gap-1.5 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)_5rem_auto] sm:items-center sm:gap-3">
              <div className="text-sm font-semibold text-(--earist-secondary)">
                Adviser
              </div>
              <div className="min-w-0 text-sm">
                <span
                  className={adviser ? "text-foreground" : "text-(--earist-warning)"}
                >
                  {adviser ? adviser.name : "Active thesis adviser not found"}
                </span>
                <span className="mt-0.5 block text-xs text-(--earist-body-text)">
                  Automatic — managed in the Adviser workflow
                </span>
              </div>
              <div className="text-xs text-(--earist-body-text)">
                {adviser ? "1 / 1" : "0 / 1"}
              </div>
              <div className="sm:justify-self-end">
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
            const isPanelist = role === "PANELIST";
            return (
              <div
                key={role}
                className="grid grid-cols-1 gap-1.5 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)_5rem_auto] sm:items-center sm:gap-3"
              >
                <div className="text-sm font-semibold text-(--earist-secondary)">
                  {ROLE_LABELS[role]}
                </div>
                <div className="min-w-0 text-sm">
                  {roleMembers.length === 0 ? (
                    <span className="text-(--earist-body-text)">
                      Not assigned
                    </span>
                  ) : isPanelist ? (
                    <div className="flex flex-wrap gap-1.5">
                      {roleMembers.map((m) => (
                        <span
                          key={m.userId}
                          className="inline-flex items-center gap-1 rounded-full bg-(--earist-surface-gray) px-2 py-0.5 text-xs text-foreground"
                        >
                          {m.name}
                          <button
                            type="button"
                            aria-label={`Remove ${m.name} from Panelists`}
                            onClick={() => onRemoveMember(m.userId)}
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="font-medium text-foreground">
                      {roleMembers[0]?.name}
                    </span>
                  )}
                </div>
                <div className="text-xs text-(--earist-body-text)">
                  {requiredCell(roleMembers.length, quota)}
                </div>
                <div className="sm:justify-self-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionsDisabled}
                    onClick={() => setActiveRole(role)}
                  >
                    {isPanelist
                      ? "Edit Panelists"
                      : roleMembers.length > 0
                        ? "Change"
                        : "Assign"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Committee-only readiness strip */}
        <div className="mt-3 border-t border-(--earist-border-gray) pt-3 text-xs">
          {policyError ? (
            <span className="text-destructive">
              Committee requirements could not be loaded.
            </span>
          ) : !readiness ? (
            <span className="text-(--earist-body-text)">
              Loading committee requirements…
            </span>
          ) : readiness.complete ? (
            <span className="inline-flex items-center gap-1.5 text-(--earist-success)">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Committee complete · {readiness.totalCount} of{" "}
              {readiness.sessionTotal} participants assigned
            </span>
          ) : (
            <span className="text-(--earist-warning)">
              {missingSentence(readiness)}
            </span>
          )}
        </div>
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
          maxCount={roleQuota(policy, activeRole) ?? 0}
          current={membersOf(activeRole)}
          assignedElsewhere={assignedElsewhere(activeRole)}
          onConfirm={(people) => onAssignRole(activeRole, people)}
        />
      )}
    </Card>
  );
}
