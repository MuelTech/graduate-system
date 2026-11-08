"use client";

import { useParams } from "next/navigation";
import { FacultyEssayDetail } from "@/components/faculty/essay-detail";

export default function EssayEvaluationPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  return (
    <FacultyEssayDetail key={applicationId} applicationId={applicationId} />
  );
}
