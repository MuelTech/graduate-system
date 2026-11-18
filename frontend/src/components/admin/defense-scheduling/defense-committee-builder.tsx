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
  /** Invalid duplicate active advisers were detected; no Adviser was chosen. */
  adviserConflict?: boolean;
  onAssignRole: (role: DefensePanelRole, people: PickerPerson[]) => void;
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
  complete = false,
  empty = false,
  action,
}: {
  role: string;
  participants: string;
  secondary?: string;
  assigned: string;
  complete?: boolean;
  empty?: boolean;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-gray-200/80 bg-gray-50/40 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#333333]">
            {role}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "px-2 py-0 text-[11px] font-medium tabular-nums",
              complete
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : empty
                  ? "border-gray-200 bg-white text-gray-600"
                  : "border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            {assigned}
          </Badge>
        </div>
        <p
          className={cn(
            "truncate text-sm",
            empty ? "text-gray-400 italic" : "font-medium text-[#333333]",
          )}
          title={participants}
        >
          {participants}
        </p>
        {secondary && (
          <p className="truncate text-xs text-gray-500">{secondary}</p>
        )}
      </div>
      <div className="shrink-0">{action}</div>
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
  adviserConflict = false,
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
    <Card className="border-gray-100 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-bold text-[#333333]">
            Defense Committee
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              readiness?.complete
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-50 text-[#333333]",
            )}
          >
            <Users className="mr-1 h-3 w-3" aria-hidden="true" />
            {sessionTotal
              ? `${totalAssigned} / ${sessionTotal} assigned`
              : `${totalAssigned} assigned`}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          {defenseStageLabel} · {programTypeLabel} —{" "}
          {showAdviser
            ? "The active adviser is included automatically; assign the remaining roles."
            : "Assign all participants required for this session."}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {showAdviser && (
            <RosterRow
              role="Adviser"
              participants={
                adviser
                  ? adviser.name
                  : adviserConflict
                    ? "Multiple active advisers recorded"
                    : "Active thesis adviser not found"
              }
              secondary="Active thesis adviser"
              complete={!!adviser}
              empty={!adviser}
              assigned={adviser ? "1 / 1" : "0 / 1"}
              action={
                <Badge
                  variant="outline"
                  className="inline-flex items-center gap-1 border-gray-200 bg-white text-xs text-gray-600"
                >
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Automatic
                </Badge>
              }
            />
          )}

          {MANUAL_ROLE_ORDER.map((role) => {
            const roleMembers = membersOf(role);
            const quota = roleQuota(policy, role);
            const isPanelist = role === "PANELIST";
            const participants = isPanelist
              ? roleMembers.length > 0
                ? compactNames(roleMembers.map((m) => m.name))
                : "Not assigned"
              : (roleMembers[0]?.name ?? "Not assigned");
            const empty = roleMembers.length === 0;
            const complete = quota !== undefined && roleMembers.length >= quota;
            return (
              <RosterRow
                key={role}
                role={isPanelist ? "Panelists" : ROLE_LABELS[role]}
                participants={participants}
                complete={complete}
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
                    className="w-20 justify-center bg-white"
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
        <div className="mt-3 border-t border-gray-100 pt-3 text-xs">
          {policyError ? (
            <span className="text-destructive">
              Committee requirements could not be loaded.
            </span>
          ) : !readiness ? (
            <span className="text-gray-500">
              Loading committee requirements…
            </span>
          ) : readiness.complete ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Committee complete · {readiness.totalCount} of{" "}
              {readiness.sessionTotal} participants assigned
            </span>
          ) : (
            <span className="font-medium text-amber-700">
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
