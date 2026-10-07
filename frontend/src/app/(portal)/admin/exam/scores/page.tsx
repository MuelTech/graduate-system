import { redirect } from "next/navigation";

/**
 * UIUX-2E: the legacy Score Management workspace was retired in favour of the
 * Exam Records flow (list → Exam Record detail → Save Essay Grade / Send Result
 * Email). This route is kept only as a minimal server-side compatibility
 * redirect to the retained operational surface.
 */
export default function AdminExamScoresPage() {
  redirect("/admin/exam/applications");
}
