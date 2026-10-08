import { redirect } from "next/navigation";

/**
 * UIUX-3D: the Defense Workspaces index is retired. It duplicated the My
 * Defenses assignment list, so this compatibility route now forwards to the
 * single entry point. The canonical
 * `/panelist/defense-workspace/[scheduleId]` workspace is unchanged.
 */
export default function PanelistScoringIndexRedirect() {
  redirect("/panelist/defenses");
}
