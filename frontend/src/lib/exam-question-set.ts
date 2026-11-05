export interface QuestionSetPublication {
  id: string;
  publishedAt: string;
  questionCount: number;
}
export interface QuestionSetDraft {
  questionIds: string[];
  questions: {
    id: string;
    questionText: string;
    type: "MULTIPLE_CHOICE" | "ESSAY";
    order: number;
  }[];
  latestPublication: QuestionSetPublication | null;
}
export function sameSelection(left: string[], right: string[]) {
  const ids = new Set(left);
  return left.length === right.length && right.every((id) => ids.has(id));
}
export function toggleQuestion(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}
