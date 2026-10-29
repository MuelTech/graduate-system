import { semanticTextSegments } from "../../lib/text-emphasis";

/** Only controlled React elements; strings are escaped by React. */
export function SemanticText({
  text,
  emphasis,
}: {
  text: string;
  emphasis?: unknown;
}) {
  return (
    <span className="whitespace-pre-wrap">
      {semanticTextSegments(text, emphasis).map((segment) => {
        const content = segment.underline ? (
          <u>{segment.text}</u>
        ) : (
          segment.text
        );
        return segment.bold ? (
          <strong key={segment.start} className="font-bold">
            {content}
          </strong>
        ) : (
          <span key={segment.start}>{content}</span>
        );
      })}
    </span>
  );
}
