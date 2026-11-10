import { redirect } from "next/navigation";

export default function ProposalAdviserReviewsPage() {
  redirect("/faculty/advisees?tab=reviews");
}
