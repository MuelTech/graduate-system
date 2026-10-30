import type { ExamStimulusType, StructuredStimulus } from "@/types";
import {
  readStructuredStimulus,
  STRUCTURED_LABELS,
} from "../../lib/exam-content";
import { SemanticText } from "./semantic-text";
import { validateStructuredStimulusEmphasis } from "../../lib/text-emphasis";
import { ExamMediaImage } from "./exam-media-image";

export function StructuredStimulusRenderer({
  stimulus,
  emphasis,
}: {
  stimulus: unknown;
  emphasis?: unknown;
}) {
  const content = readStructuredStimulus(stimulus);
  if (!content)
    return (
      <p
        role="alert"
        className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      >
        This structured content is unsupported or malformed.
      </p>
    );
  let marks;
  try {
    marks = validateStructuredStimulusEmphasis(content, emphasis);
  } catch {
    marks = null;
  }
  const itemText = (item: string | number, index: number) =>
    typeof item === "string" && content.type !== "NUMBER_SEQUENCE" ? (
      <SemanticText
        text={item}
        emphasis={marks?.find((entry) => entry.index === index)?.spans}
      />
    ) : (
      String(item)
    );
  const label = STRUCTURED_LABELS[content.type];
  if ("rows" in content || "groups" in content) {
    const rows = "rows" in content ? content.rows : content.groups;
    return (
      <div className="overflow-x-auto">
        <table aria-label={label} className="border-collapse text-sm">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="min-w-16 whitespace-pre-wrap border border-gray-300 px-4 py-3 text-center"
                  >
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (content.type === "LOGICAL_PREMISES")
    return (
      <ol
        aria-label={label}
        className="list-inside list-decimal space-y-2 text-sm"
      >
        {content.items.map((item, index) => (
          <li key={index} className="whitespace-pre-wrap">
            {itemText(item, index)}
          </li>
        ))}
      </ol>
    );
  return (
    <ol aria-label={label} className="flex list-none flex-wrap gap-2">
      {content.items.map((item, index) => (
        <li
          key={index}
          className={`whitespace-pre-wrap rounded border px-3 py-2 text-sm ${content.type === "WORD_BANK" ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`}
        >
          {itemText(item, index)}
        </li>
      ))}
    </ol>
  );
}

export function StimulusRenderer({
  stimulusType,
  stimulusMediaId,
  structuredStimulus,
  structuredStimulusEmphasis,
}: {
  stimulusType: ExamStimulusType;
  stimulusMediaId: string | null;
  structuredStimulus: StructuredStimulus | null;
  structuredStimulusEmphasis?: unknown;
}) {
  if (stimulusType === "NONE") return null;
  if (stimulusType === "STRUCTURED")
    return (
      <StructuredStimulusRenderer
        stimulus={structuredStimulus}
        emphasis={structuredStimulusEmphasis}
      />
    );
  if (stimulusType === "IMAGE" && stimulusMediaId)
    return <ExamMediaImage mediaId={stimulusMediaId} alt="Question stimulus" />;
  return (
    <p role="alert" className="text-sm text-amber-900">
      Stimulus content is unavailable.
    </p>
  );
}
