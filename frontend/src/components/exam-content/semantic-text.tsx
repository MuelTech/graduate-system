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
        const text = segment.italic ? <em>{segment.text}</em> : segment.text;
        const content = segment.underline ? <u>{text}</u> : text;
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
