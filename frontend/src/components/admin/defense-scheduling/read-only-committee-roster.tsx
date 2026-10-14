"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Lock, Users } from "lucide-react";
import type { CommitteePolicyDto } from "@/types";
import { MANUAL_ROLE_ORDER, ROLE_LABELS, programTypeLabel } from "./types";

type Seat = { userId: string; name: string; role: string };

type Props = {
  committee: Seat[];
  /** Authoritative DefenseSchedule.defenseType. */
  defenseType: string;
  defenseStageLabel: string;
  programType: string | null;
  /** Committee policy (quotas). Optional — degrade to counts without a quota. */
  policy?: CommitteePolicyDto;
};

/** Same aligned four-column roster language as the editable builder, minus Action. */
const ROSTER_GRID =
  "sm:grid sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_5.5rem] sm:items-center sm:gap-3";

function compactNames(names: string[], max = 3): string {
  if (!names.length) return "—";
  if (names.length <= max) return names.join(" · ");
  return `${names.slice(0, max).join(" · ")} +${names.length - max}`;
}

function RosterRow({
  role,
  participants,
  secondary,
  assigned,
  automatic = false,
  empty = false,
}: {
  role: string;
  participants: string;
  secondary?: string;
  assigned: string;
  automatic?: boolean;
  empty?: boolean;
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
        {automatic ? (
          <span className="inline-flex items-center justify-center gap-1">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {assigned}
          </span>
        ) : (
          assigned
        )}
      </div>
    </div>
  );
}

/**
 * UIUX-2L FIX-3: read-only committee roster for a confirmed schedule. No
 * assign/edit controls and no academic authority — "here is who was confirmed".
 */
export function ReadOnlyCommitteeRoster({
  committee,
  defenseType,
  defenseStageLabel,
  programType,
  policy,
}: Props) {
  const isTitle = String(defenseType).toUpperCase() === "TITLE_DEFENSE";
  const of = (role: string) => committee.filter((c) => c.role === role);
  const total = committee.length;

  const panelistQuota = policy?.panelistCount;
  const adviserRow = !isTitle;
  const adviserMembers = of("ADVISER");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Defense Committee
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Users className="mr-1 h-3 w-3" aria-hidden="true" />
            {total} participant{total === 1 ? "" : "s"}
          </Badge>
        </div>
        <p className="text-xs text-(--earist-body-text)">
          {defenseStageLabel} · {programTypeLabel(programType)}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-(--earist-border-gray)">
          <div
            className={cn(
              "hidden pb-1 text-xs font-medium tracking-wide text-(--earist-body-text) uppercase",
              ROSTER_GRID,
            )}
          >
            <span>Role</span>
            <span>Assigned participant(s)</span>
            <span className="text-center">Assigned</span>
          </div>

          {adviserRow && (
            <RosterRow
              role="Adviser"
              participants={adviserMembers.map((m) => m.name).join(" · ") || "Not recorded"}
              secondary="Active thesis adviser"
              empty={adviserMembers.length === 0}
              automatic
              assigned={`${adviserMembers.length} / 1`}
            />
          )}

          {MANUAL_ROLE_ORDER.map((role) => {
            const members = of(role);
            const isPanelist = role === "PANELIST";
            const quota =
              isPanelist ? panelistQuota : role === "CHAIRMAN" ? 1 : 1;
            return (
              <RosterRow
                key={role}
                role={isPanelist ? "Panelists" : ROLE_LABELS[role]}
                participants={
                  isPanelist
                    ? compactNames(members.map((m) => m.name))
                    : members[0]?.name ?? "Not recorded"
                }
                empty={members.length === 0}
                assigned={
                  quota === undefined
                    ? `${members.length}`
                    : `${members.length} / ${quota}`
                }
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
