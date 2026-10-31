import { SemanticText } from "./semantic-text";
import type { TextEmphasisSpan } from "../../lib/text-emphasis";
import { ExamMediaImage } from "./exam-media-image";

/** Rendering only: correctness and selection remain the caller's responsibility. */
export function OptionContentRenderer({
  optionText,
  optionTextEmphasis,
  mediaId,
  alt,
}: {
  optionText: string | null;
  optionTextEmphasis?: TextEmphasisSpan[] | null;
  mediaId: string | null;
  alt: string;
}) {
  if (mediaId && optionText === null)
    return <ExamMediaImage mediaId={mediaId} alt={alt} />;
  if (optionText !== null && !mediaId)
    return <SemanticText text={optionText} emphasis={optionTextEmphasis} />;
  return (
    <span role="alert" className="text-sm text-amber-900">
      Option content is unavailable.
    </span>
  );
}
