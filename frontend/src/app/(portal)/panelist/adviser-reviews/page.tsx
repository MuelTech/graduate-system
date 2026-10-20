import { redirect } from "next/navigation";

export default function ProposalAdviserReviewsPage() {
  redirect("/panelist/advisees?tab=reviews");
}
