"use client";

import { useId } from "react";
import { CheckCircle2 } from "lucide-react";
import type { ExamQuestion } from "@/types";
import { applicantOptionViews } from "@/lib/applicant-exam-content";
import { StimulusRenderer } from "./stimulus-renderer";
import { SemanticText } from "./semantic-text";
import { OptionContentRenderer } from "./option-content-renderer";

/** Selection belongs to the exam page; this composition owns no answer state. */
export function ApplicantQuestionRenderer({
  question,
  selectedOptionId,
  onSelect,
}: {
  question: ExamQuestion;
  selectedOptionId: string | undefined;
  onSelect: (optionId: string) => void;
}) {
  const groupId = useId();
  const options = applicantOptionViews(
    question.options,
    selectedOptionId,
    onSelect,
  );
  const visualChoices = options.some((option) => option.mediaId !== null);

  return (
    <fieldset className="min-w-0 space-y-5">
      <legend className="mb-5 max-w-full whitespace-pre-wrap break-words text-base font-medium text-(--earist-primary)">
        <SemanticText
          text={question.questionText}
          emphasis={question.questionTextEmphasis}
        />
      </legend>
      <div className="min-w-0 max-w-full">
        <StimulusRenderer
          stimulusType={question.stimulusType}
          stimulusMediaId={question.stimulusMediaId}
          structuredStimulus={question.structuredStimulus}
        />
      </div>
      <div
        className={
          visualChoices
            ? "grid min-w-0 gap-3 sm:grid-cols-2"
            : "min-w-0 space-y-2"
        }
      >
        {options.map((option) => {
          const labelId = `${groupId}-${option.id}-label`;
          const contentId = `${groupId}-${option.id}-content`;
          return (
            <div
              key={option.id}
              className={`relative min-w-0 rounded-lg border p-4 transition-colors ${option.selected ? "border-(--earist-primary) bg-(--earist-surface-light-red) text-(--earist-primary)" : "border-(--earist-border-gray) bg-white text-(--earist-body-text) hover:bg-(--earist-surface-gray)"}`}
            >
              <input
                type="radio"
                name={groupId}
                value={option.id}
                checked={option.selected}
                onChange={option.select}
                aria-labelledby={labelId}
                aria-describedby={contentId}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--earist-primary)"
              />
              {/* The radio covers the card. Retry buttons remain separate interactive controls. */}
              <div className="pointer-events-none relative z-20 min-w-0 space-y-3 [&_button]:pointer-events-auto">
                <div className="flex items-center justify-between gap-3">
                  <span
                    id={labelId}
                    className="break-words text-sm font-semibold"
                  >
                    {option.displayLabel}
                    {option.mediaId ? (
                      <span className="sr-only"> image choice</span>
                    ) : null}
                  </span>
                  {option.selected ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                      Selected
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 rounded-full border border-current"
                    />
                  )}
                </div>
                <div id={contentId} className="min-w-0 break-words text-sm">
                  <OptionContentRenderer
                    optionText={option.optionText}
                    optionTextEmphasis={option.optionTextEmphasis}
                    mediaId={option.mediaId}
                    alt={`${option.displayLabel} answer choice`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
