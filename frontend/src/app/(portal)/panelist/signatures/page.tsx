import { redirect } from "next/navigation";

/**
 * Redundant standalone Faculty E-Signatures page is retired.
 * Signing happens contextually inside Defense Workspace / My Defenses,
 * while reusable personal signatures are managed under Faculty Profile.
 */
export default function PanelistSignaturesRedirect() {
  redirect("/faculty/defenses");
}
