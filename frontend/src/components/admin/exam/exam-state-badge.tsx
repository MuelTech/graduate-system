import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  EXAM_STATE_BADGE_CLASS,
  EXAM_STATE_LABEL,
  type ExamStateKey,
} from "@/lib/exam-record-state";

/** Shared exam-state badge for the Exam Records list and detail pages. */
export function ExamStateBadge({ state }: { state: ExamStateKey }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", EXAM_STATE_BADGE_CLASS[state])}
    >
      {EXAM_STATE_LABEL[state]}
    </Badge>
  );
}
