import { redirect } from "next/navigation";

/** Legacy route — canonical STRIKE lives under Thesis Journey. */
export default function StudentPlagiarismPage() {
  redirect("/student/thesis/strike");
}
