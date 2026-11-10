import { redirect } from "next/navigation";

export default function PanelistAdviserRequestsPage() {
  redirect("/faculty/advisees?tab=requests");
}
