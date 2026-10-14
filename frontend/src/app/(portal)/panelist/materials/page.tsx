import { redirect } from "next/navigation";

/**
 * UIUX-3D: the Materials assignment index is retired. Its broad
 * `thesisDocuments` listing was never the authoritative manuscript selection;
 * the authorized paper is now opened from My Defenses via View Manuscript.
 * This compatibility route forwards to the single entry point.
 */
export default function PanelistMaterialsIndexRedirect() {
  redirect("/panelist/defenses");
}
