import { ExamMediaImage } from "./exam-media-image";

/** Rendering only: correctness and selection remain the caller's responsibility. */
export function OptionContentRenderer({
  optionText,
  mediaId,
  alt,
}: {
  optionText: string | null;
  mediaId: string | null;
  alt: string;
}) {
  if (mediaId && optionText === null)
    return <ExamMediaImage mediaId={mediaId} alt={alt} />;
  if (optionText !== null && !mediaId)
    return <span className="whitespace-pre-wrap">{optionText}</span>;
  return (
    <span role="alert" className="text-sm text-amber-900">
      Option content is unavailable.
    </span>
  );
}
