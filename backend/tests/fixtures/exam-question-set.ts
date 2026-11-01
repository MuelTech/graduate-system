import type { AdminExamQuestion } from "../../src/interfaces/exam-content.interfaces";
export const qid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const mediaId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export function setQuestion(id = qid, order = 7): AdminExamQuestion {
  return { id, order, type: "MULTIPLE_CHOICE", questionText: "Choose NOT this.",
    questionTextEmphasis: [{ start: 7, end: 10, style: "BOLD" }, { start: 7, end: 10, style: "ITALIC" }, { start: 7, end: 10, style: "UNDERLINE" }],
    stimulusType: "NONE", stimulusMediaId: null, structuredStimulus: null, structuredStimulusEmphasis: null,
    options: [{ id: `${id.slice(0, -1)}1`, questionId: id, label: "F", order: 2, optionText: "First", optionTextEmphasis: [{ start: 0, end: 5, style: "ITALIC" }], mediaId: null, isCorrect: true },
      { id: `${id.slice(0, -1)}2`, questionId: id, label: "K", order: 9, optionText: "Second", optionTextEmphasis: null, mediaId: null, isCorrect: false }] };
}
