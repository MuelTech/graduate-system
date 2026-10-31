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
    // Canonical Q24/Q40 corrections are bound by exact manifest/package bytes.
    expect(
      calculateSha256(await readFile(path.join(root, "manifest.json"))),
    ).toBe("2cd14cd6578eafe14536db36833a07a085e7d7e091ed2f6d2a934f79b6f30c95");
    expect(validated.fingerprint).toBe(
      "01ad6b100f65e312387779852a352dcff97d5fd2a0b707ba1901dc2c8aeac343",
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
    const q40 = validated.questions.find((q) => q.sourceQuestionNumber === 40)!;
    expect(q40.input.questionText).toBe("Assume that —");
    expect(q40.input.structuredStimulus).toEqual({
      type: "LOGICAL_PREMISES",
      items: [
        "All As are Cs.",
        "Some Ds are Cs.",
        "No Bs are Cs.",
        "We know that —",
      ],
    });
    expect(
      q40.input.options.map((o) => [o.label, o.order, o.isCorrect]),
    ).toEqual([
      ["F", 0, false],
      ["G", 1, true],
      ["H", 2, false],
      ["J", 3, false],
      ["K", 4, false],
    ]);
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
