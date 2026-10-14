"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Lock, Users } from "lucide-react";
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
};

/** One consistent four-column grid for the header and every roster row. */
const ROSTER_GRID =
  "sm:grid sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_5.5rem_6rem] sm:items-center sm:gap-3";

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

/** Roster-order missing summary: Adviser (if shown) → Chairman → Panelists → Facilitator → Rapporteur. */
function missingSentence(
  readiness: ReturnType<typeof computeCommitteeReadiness>,
  showAdviser: boolean,
): string | null {
  const parts: string[] = [];
  if (showAdviser && readiness.adviserMode === "AUTOMATIC" && !readiness.adviserPresent) {
    parts.push("the active adviser");
  }
  if (readiness.chairman < 1) parts.push("1 Chairman");
  const panelists = readiness.panelistQuota - readiness.panelists;
  if (panelists > 0) parts.push(`${panelists} Panelist${panelists === 1 ? "" : "s"}`);
  if (readiness.facilitator < 1) parts.push("1 Facilitator");
  if (readiness.rapporteur < 1) parts.push("1 Rapporteur");
  if (parts.length === 0) return null;
  return `${joinList(parts)} still required`;
}

function compactNames(names: string[], max = 3): string {
  if (names.length <= max) return names.join(" · ");
  return `${names.slice(0, max).join(" · ")} +${names.length - max}`;
}

function RosterRow({
  role,
  participants,
  secondary,
  assigned,
  empty = false,
  action,
}: {
  role: string;
  participants: string;
  secondary?: string;
  assigned: string;
  empty?: boolean;
  action: React.ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-1 py-3", ROSTER_GRID)}>
      <div className="flex items-center justify-between gap-2 sm:block">
        <span className="text-sm font-semibold text-(--earist-secondary)">
          {role}
        </span>
        <span className="text-xs tabular-nums text-(--earist-body-text) sm:hidden">
          {assigned}
        </span>
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm",
            empty ? "text-(--earist-body-text)" : "text-foreground",
          )}
          title={participants}
        >
          {participants}
        </p>
        {secondary && (
          <p className="truncate text-xs text-(--earist-body-text)">{secondary}</p>
        )}
      </div>
      <div className="hidden text-center text-xs tabular-nums text-(--earist-body-text) sm:block">
        {assigned}
      </div>
      <div className="sm:justify-self-end">{action}</div>
    </div>
  );
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
          {/* Column headers — restrained, desktop only */}
          <div
            className={cn(
              "hidden pb-1 text-xs font-medium tracking-wide text-(--earist-body-text) uppercase",
              ROSTER_GRID,
            )}
          >
            <span>Role</span>
            <span>Assigned participant(s)</span>
            <span className="text-center">Assigned</span>
            <span className="text-right">Action</span>
          </div>

          {showAdviser && (
            <RosterRow
              role="Adviser"
              participants={adviser ? adviser.name : "Active thesis adviser not found"}
              secondary="Active thesis adviser"
              empty={!adviser}
              assigned={adviser ? "1 / 1" : "0 / 1"}
              action={
                <span className="inline-flex items-center gap-1 text-xs text-(--earist-body-text)">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Automatic
                </span>
              }
            />
          )}

          {MANUAL_ROLE_ORDER.map((role) => {
            const roleMembers = membersOf(role);
            const quota = roleQuota(policy, role);
            const isPanelist = role === "PANELIST";
            const participants = isPanelist
              ? compactNames(roleMembers.map((m) => m.name))
              : (roleMembers[0]?.name ?? "Not assigned");
            const empty = roleMembers.length === 0;
            return (
              <RosterRow
                key={role}
                role={isPanelist ? "Panelists" : ROLE_LABELS[role]}
                participants={participants}
                empty={empty}
                assigned={
                  quota === undefined ? "Loading…" : `${roleMembers.length} / ${quota}`
                }
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionsDisabled}
                    className="w-20 justify-center"
                    onClick={() => setActiveRole(role)}
                  >
                    {empty ? "Assign" : "Edit"}
                  </Button>
                }
              />
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
              {missingSentence(readiness, showAdviser)}
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
