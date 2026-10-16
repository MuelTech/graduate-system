"use client";

/**
 * CDW-4 FIX — institutional Individual Evaluation matrix.
 *
 * Mirrors the supplied EARIST Individual Evaluation form: Group I (5 criteria)
 * and Group II (4 criteria), each rated on the fixed six-level matrix. NOTE: the
 * matrix jumps from 2.00 straight to 2.50 (there is no intermediate quarter step)
 * and it must not be normalized into a uniform 0.25 grid.
 *
 * Radio-cell selection: the whole cell is the hit target, each row allows exactly
 * one rating, and every cell has an accessible name that includes the criterion
 * and the rating (value + code + label).
 */

export interface InstitutionalRatingLevel {
  value: number;
  code: "E" | "HS" | "VS" | "S" | "BS" | "F";
  label: string;
}

export const INSTITUTIONAL_RATING_LEVELS: readonly InstitutionalRatingLevel[] = [
  { value: 1, code: "E", label: "Excellent" },
  { value: 1.25, code: "HS", label: "Highly Satisfactory" },
  { value: 1.5, code: "VS", label: "Very Satisfactory" },
  { value: 1.75, code: "S", label: "Satisfactory" },
  { value: 2, code: "BS", label: "Below Satisfactory" },
  { value: 2.5, code: "F", label: "Fail" },
] as const;

export const INSTITUTIONAL_GROUP_I = [
  { key: "timelinessRelevance", label: "Timeliness and relevance of study to educational goals" },
  { key: "organization", label: "Organization" },
  { key: "depthComprehensiveness", label: "Depth or Comprehensiveness of treatment" },
  { key: "relevanceConclusions", label: "Relevance of conclusions and recommendations" },
  { key: "evidenceOriginalThinking", label: "Evidence of original thinking" },
] as const;

export const INSTITUTIONAL_GROUP_II = [
  { key: "presentation", label: "Presentation" },
  { key: "masterySubject", label: "Mastery of Subject Matter" },
  { key: "communicationSkill", label: "Communication Skill" },
  { key: "attitude", label: "Attitude (Receptive to suggestions)" },
] as const;

export const INSTITUTIONAL_ALL_CRITERIA = [
  ...INSTITUTIONAL_GROUP_I,
  ...INSTITUTIONAL_GROUP_II,
] as const;

export type InstitutionalCriterionKey =
  (typeof INSTITUTIONAL_ALL_CRITERIA)[number]["key"];

/** Always-visible legend so faculty never have to memorize the abbreviations. */
export function InstitutionalLegend() {
  return (
    <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
      <p className="mb-1.5 text-[13px] font-semibold tracking-wide text-(--earist-secondary) uppercase">
        Legend
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-(--earist-body-text) sm:grid-cols-3">
        {INSTITUTIONAL_RATING_LEVELS.map((level) => (
          <li key={level.value} className="flex items-baseline gap-1.5">
            <span className="font-semibold text-(--earist-primary)">{level.code}</span>
            <span>{level.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatrixGroup({
  title,
  criteria,
  values,
  onChange,
  disabled,
}: {
  title: string;
  criteria: readonly { key: string; label: string }[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-base font-semibold text-(--earist-primary)">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-(--earist-border-gray) text-(--earist-body-text)">
              <th scope="col" className="py-2 pr-3 text-[13px] font-semibold">
                Criteria
              </th>
              {INSTITUTIONAL_RATING_LEVELS.map((level) => (
                <th
                  key={level.value}
                  scope="col"
                  className="px-1 py-1.5 text-center text-[13px] font-semibold"
                >
                  <span className="block leading-tight">{level.value.toFixed(2)}</span>
                  <span className="block text-[13px] leading-tight font-normal">
                    {level.code}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion.key} className="border-b border-(--earist-border-gray)">
                <th
                  scope="row"
                  className="py-2 pr-3 text-left text-[14px] font-medium text-(--earist-body)"
                >
                  {criterion.label}
                </th>
                {INSTITUTIONAL_RATING_LEVELS.map((level) => {
                  const selected = values[criterion.key] === String(level.value);
                  return (
                    <td key={level.value} className="p-0 text-center align-middle">
                      <label className="flex h-11 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-(--earist-surface-gray)">
                        <input
                          type="radio"
                          name={`criterion-${criterion.key}`}
                          value={String(level.value)}
                          checked={selected}
                          disabled={disabled}
                          onChange={() => onChange(criterion.key, String(level.value))}
                          className="sr-only"
                          aria-label={`${criterion.label} — ${level.value.toFixed(2)} ${level.code} ${level.label}`}
                        />
                        <span
                          aria-hidden="true"
                          className={
                            "flex size-6 items-center justify-center rounded-full border-2 transition-colors " +
                            (selected
                              ? "border-(--earist-primary) bg-(--earist-primary)"
                              : "border-(--earist-border-gray) bg-white") +
                            " peer-focus-visible:ring-2 peer-focus-visible:ring-(--earist-primary)/40"
                          }
                        >
                          {selected && <span className="size-2.5 rounded-full bg-white" />}
                        </span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function InstitutionalEvaluationMatrix({
  values,
  onChange,
  disabled = false,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      <MatrixGroup
        title="Group I"
        criteria={INSTITUTIONAL_GROUP_I}
        values={values}
        onChange={onChange}
        disabled={disabled}
      />
      <MatrixGroup
        title="Group II"
        criteria={INSTITUTIONAL_GROUP_II}
        values={values}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
