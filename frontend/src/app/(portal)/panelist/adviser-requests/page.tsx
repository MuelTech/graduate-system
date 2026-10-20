import { redirect } from "next/navigation";

export default function PanelistAdviserRequestsPage() {
  redirect("/panelist/advisees?tab=requests");
}
