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
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200/80 bg-gray-50/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#333333]">
            {role}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "px-2 py-0 text-[11px] font-medium tabular-nums",
              empty
                ? "border-gray-200 bg-white text-gray-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            {automatic && (
              <Lock className="mr-1 h-3 w-3" aria-hidden="true" />
            )}
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
    <Card className="border-gray-100 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-bold text-[#333333]">
            Defense Committee
          </CardTitle>
          <Badge
            variant="outline"
            className="border-gray-200 bg-gray-50 text-xs font-medium text-[#333333]"
          >
            <Users className="mr-1 h-3 w-3" aria-hidden="true" />
            {total} participant{total === 1 ? "" : "s"}
          </Badge>
        </div>
        <p className="text-xs text-gray-500">
          {defenseStageLabel} · {programTypeLabel(programType)}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
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
