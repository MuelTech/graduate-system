import { readFile, readdir } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { preflightExamPackage } from "../../../src/services/exam-content-package.service";
import { calculateSha256 } from "../../../src/utils/checksum";

describe("read-only committed verified source package", () => {
  it("validates all 72 verified questions and 108 actual images without source mutation", async () => {
    const root = path.resolve("exam-content/olsat");
    async function snapshot(): Promise<Record<string, string>> {
      const files = await readdir(root, {
        recursive: true,
        withFileTypes: true,
      });
      const result: Record<string, string> = {};
      for (const file of files)
        if (file.isFile()) {
          const full = path.join(file.parentPath, file.name);
          result[path.relative(root, full)] = calculateSha256(
            await readFile(full),
          );
        }
      return result;
    }
    const before = await snapshot();
    const validated = await preflightExamPackage(root);
    // Corrected canonical identity survives removal of the superseded reconciler/helper.
    expect(
      calculateSha256(await readFile(path.join(root, "manifest.json"))),
    ).toBe("6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6");
    expect(validated.fingerprint).toBe(
      "8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738",
    );
    const q24 = validated.questions.find((q) => q.sourceQuestionNumber === 24)!;
    expect(q24.input.options.map((option) => option.label)).toEqual([
      "F",
      "G",
      "H",
      "J",
      "K",
    ]);
    expect(q24.input.options[3]).toMatchObject({
      label: "J",
      order: 3,
      optionText: "Paul is younger than Dick and John",
      isCorrect: false,
    });
    expect(q24.input.options.find((option) => option.isCorrect)?.label).toBe(
      "F",
    );
    expect(validated.counts).toEqual({
      questionsValidated: 72,
      textOnlyQuestions: 25,
      structuredStimulusQuestions: 29,
      imageStimulusQuestions: 18,
      visualOptions: 90,
      assets: 108,
      sourceFiles: 109,
      questionTypes: {
        TEXT_MULTIPLE_CHOICE: 25,
        STRUCTURED_STIMULUS_TEXT_CHOICES: 29,
        VISUAL_STIMULUS_VISUAL_CHOICES: 18,
      },
      stimulusTypes: { NONE: 25, IMAGE: 18, STRUCTURED: 29 },
      structuredSubtypes: {
        MATRIX: 12,
        WORD_BANK: 4,
        NUMBER_SEQUENCE: 4,
        ALPHANUMERIC_SEQUENCE: 1,
        WORD_SERIES: 2,
        GROUPED_NUMBER_ROWS: 4,
        LETTER_SEQUENCE: 1,
        LOGICAL_PREMISES: 1,
      },
    });
    expect(validated.questions.map((q) => q.sourceQuestionNumber)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1),
    );
    expect(
      validated.questions.every(
        (q) => q.input.options.filter((opt) => opt.isCorrect).length === 1,
      ),
    ).toBe(true);
    expect(await snapshot()).toEqual(before);
  });
});
