/** Matches the server's bounded title policy, measured in UTF-16 code units. */
export const MANUSCRIPT_TITLE_MAX_LENGTH = 2000;

/** Title and file travel in one multipart submission for this manuscript version. */
export function createManuscriptSubmission(title: string, file: File | null): FormData {
  const manuscriptTitle = title.trim();
  if (!manuscriptTitle) throw new Error("Thesis/Dissertation Title is required.");
  if (manuscriptTitle.length > MANUSCRIPT_TITLE_MAX_LENGTH) {
    throw new Error(`Thesis/Dissertation Title must be ${MANUSCRIPT_TITLE_MAX_LENGTH} characters or fewer.`);
  }
  if (!file) throw new Error("Manuscript file is required.");
  const formData = new FormData();
  formData.append("manuscriptTitle", manuscriptTitle);
  formData.append("document", file);
  return formData;
}
