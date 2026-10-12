import { redirect } from "next/navigation";

/**
 * RAP-1: the separate Admin RAP Reports workspace is retired.
 *
 * UIUX-2N schedule-scoped Defense Record detail is the canonical Admin RAP
 * lifecycle / signer-monitoring surface, driven by stored RapReportSignature
 * rows. This compatibility route forwards old bookmarks without fetching any
 * RAP data or rendering a transitional UI.
 */
export default function AdminRapReportsIndexRedirect() {
  redirect("/admin/thesis/defense-records");
}
