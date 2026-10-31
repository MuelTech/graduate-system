import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { preflightExamPackage } from "../../../src/services/exam-content-package.service";
import {
  parseEmphasisSidecar,
  textSha256,
} from "../../../src/services/exam-emphasis.service";
import { structuredItemText } from "../../../src/shared/text-emphasis";
import { calculateSha256 } from "../../../src/utils/checksum";

// Literal owner-authorized map, not a rule for recurring words or unlisted items.
const italic = new Map<number, string>([
  [1, "best"],
  [6, "best"],
  [7, "same"],
  [11, "not"],
  [15, "best"],
  [18, "best"],
  [25, "most clearly"],
  [26, "same"],
  [27, "best"],
  [42, "same"],
  [45, "most clearly"],
  [49, "same"],
  [51, "same"],
  [55, "best"],
  [61, "not"],
  [62, "best"],
  [64, "same"],
  [72, "best"],
]);
const underline = new Map<number, string[]>([
  [6, ["first", "begin"]],
  [18, ["last", "begin"]],
  [27, ["first", "begin"]],
  [62, ["last", "begin"]],
]);
const bold = new Map<number, string[]>([
  [5, ["First", "original", "only"]],
  [10, ["confinement"]],
  [20, ["Increase", "reveal", "decrease"]],
  [28, ["discord"]],
  [33, ["Possible", "maybe", "probable"]],
  [35, ["moderate"]],
  [50, ["Electricity", "light bulb"]],
  [57, ["scarcity"]],
  [
    58,
    [
      "tana dona meka",
      "very cold water",
      "tana neta",
      "hot water",
      "dona bela",
      "very good",
      "cold",
    ],
  ],
]);
const optionSubjects = new Map([
  ["F", "Dick"],
  ["G", "Paul"],
  ["H", "Paul"],
  ["J", "Paul"],
  ["K", "Dick"],
]);
const structuredWords = new Map([
  [25, ["peaceful", "serene", "tranquil"]],
  [45, ["forward", "sideways", "down"]],
]);
const questionNumbers = [
  1, 5, 6, 7, 10, 11, 15, 18, 20, 24, 25, 26, 27, 28, 33, 35, 42, 45, 49, 50,
  51, 55, 57, 58, 61, 62, 64, 72,
];

describe("read-only real owner-verified OLSAT typography map", () => {
  it("binds exactly the authorized 38 targets and 59 spans to the protected corrected package", async () => {
    const root = path.resolve("exam-content/olsat");
    const sidecarPath = path.resolve(root, "../olsat-emphasis.json");
    expect((await stat(sidecarPath)).isFile()).toBe(true);
    const source = await preflightExamPackage(root);
    const manifestSha = calculateSha256(
      await readFile(path.join(root, "manifest.json")),
    );
    expect(manifestSha).toBe(
      "6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6",
    );
    expect(source.fingerprint).toBe(
      "8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738",
    );
    const raw = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readFile(sidecarPath),
      ),
    );
    const sidecar = parseEmphasisSidecar(raw, source, manifestSha);
    expect(sidecar).toEqual(raw);
    expect(sidecar.schemaVersion).toBe(2);
    expect(sidecar.verification).toEqual({
      status: "VERIFIED",
      verifiedBy: "PROJECT_OWNER_APPROVED_PHYSICAL_SOURCE_MAP",
      verifiedAt: "2026-10-31T09:39:09Z",
    });
    expect(sidecar.annotations).toHaveLength(38);
    expect([
      ...new Set(sidecar.annotations.map((a) => a.sourceQuestionNumber)),
    ]).toEqual(questionNumbers);
    expect(questionNumbers).toHaveLength(28);
    expect(sidecar.annotations.some((a) => a.sourceQuestionNumber === 67)).toBe(
      false,
    );
    const spans = sidecar.annotations.flatMap((a) => a.spans ?? []);
    expect(spans).toHaveLength(59);
    expect(
      Object.fromEntries(
        ["BOLD", "UNDERLINE", "ITALIC"].map((style) => [
          style,
          spans.filter((s) => s.style === style).length,
        ]),
      ),
    ).toEqual({ BOLD: 33, UNDERLINE: 8, ITALIC: 18 });
    expect(
      Object.fromEntries(
        ["questionText", "optionText", "structuredItem"].map((field) => [
          field,
          sidecar.annotations.filter((a) => a.target.field === field).length,
        ]),
      ),
    ).toEqual({ questionText: 27, optionText: 5, structuredItem: 6 });

    const identities = new Set<string>();
    for (const annotation of sidecar.annotations) {
      const n = annotation.sourceQuestionNumber;
      const q = source.questions.find(
        (q) => q.sourceQuestionNumber === n,
      )!.input;
      const identity = `${n}:${JSON.stringify(annotation.target)}`;
      expect(identities.has(identity)).toBe(false);
      identities.add(identity);
      let text: string;
      let expected: { phrase: string; style: string }[];
      const target = annotation.target;
      if (target.field === "questionText") {
        text = q.questionText;
        expected = [
          ...(italic.has(n)
            ? [{ phrase: italic.get(n)!, style: "ITALIC" }]
            : []),
          ...(underline.get(n) ?? []).map((phrase) => ({
            phrase,
            style: "UNDERLINE",
          })),
          ...(bold.get(n) ?? []).map((phrase) => ({ phrase, style: "BOLD" })),
        ];
      } else if (target.field === "optionText") {
        expect(n).toBe(24);
        const matches = q.options.filter(
          (o) => o.label === target.label && o.order === target.order,
        );
        expect(matches).toHaveLength(1);
        text = matches[0].optionText!;
        expect(text.startsWith(`${optionSubjects.get(target.label)} `)).toBe(
          true,
        );
        expected = [
          { phrase: optionSubjects.get(target.label)!, style: "BOLD" },
        ];
        if (target.label === "J")
          expect(text).toBe("Paul is younger than Dick and John");
      } else {
        expect(q.stimulusType).toBe("STRUCTURED");
        expect(q.structuredStimulus?.type).toBe("WORD_SERIES");
        expect([0, 1, 2]).toContain(target.index);
        text = structuredItemText(q.structuredStimulus, target.index);
        expect(text).toBe(structuredWords.get(n)?.[target.index]);
        expect(text).not.toBe("?");
        expected = [
          { phrase: structuredWords.get(n)![target.index], style: "BOLD" },
        ];
      }
      expect(annotation.textSha256).toBe(textSha256(text));
      expect(annotation.spans).toHaveLength(expected.length);
      const observed = annotation.spans!.map((span) => ({
        phrase: text.slice(span.start, span.end),
        style: span.style,
      }));
      const byPhrase = (
        a: { phrase: string; style: string },
        b: { phrase: string; style: string },
      ) => a.phrase.localeCompare(b.phrase) || a.style.localeCompare(b.style);
      expect([...observed].sort(byPhrase)).toEqual(
        [...expected].sort(byPhrase),
      );
      for (const span of annotation.spans!) {
        const phrase = text.slice(span.start, span.end);
        if (n === 58 && phrase === "cold") {
          const clause = "Which word means cold?";
          expect(text.endsWith(clause)).toBe(true);
          expect(span.start).toBe(
            text.length - clause.length + clause.indexOf("cold"),
          );
          expect(span.start).toBe(text.lastIndexOf("cold"));
        } else {
          expect(text.indexOf(phrase)).toBe(span.start);
          expect(text.indexOf(phrase, span.start + 1)).toBe(-1);
        }
        if (target.field === "structuredItem")
          expect([span.start, span.end]).toEqual([0, text.length]);
      }
    }
    const forQuestion = (n: number) =>
      sidecar.annotations.filter((a) => a.sourceQuestionNumber === n);
    expect(forQuestion(24).map((a) => a.target)).toEqual(
      source.questions
        .find((q) => q.sourceQuestionNumber === 24)!
        .input.options.map((o) => ({
          field: "optionText",
          label: o.label,
          order: o.order,
        })),
    );
    for (const n of [25, 45]) {
      expect(forQuestion(n).map((a) => a.target)).toEqual([
        { field: "questionText" },
        ...[0, 1, 2].map((index) => ({ field: "structuredItem", index })),
      ]);
      expect(forQuestion(n)[0].spans).toHaveLength(1);
      expect(forQuestion(n)[0].spans![0].style).toBe("ITALIC");
    }
    const q58 = forQuestion(58);
    expect(q58).toHaveLength(1);
    expect(q58[0].spans).toHaveLength(7);
    expect(q58[0].spans!.every((s) => s.style === "BOLD")).toBe(true);
    const rank = { questionText: 0, optionText: 1, structuredItem: 2 };
    expect(sidecar.annotations).toEqual(
      [...sidecar.annotations].sort(
        (a, b) =>
          a.sourceQuestionNumber - b.sourceQuestionNumber ||
          rank[a.target.field] - rank[b.target.field] ||
          (a.target.field === "optionText"
            ? a.target.order
            : a.target.field === "structuredItem"
              ? a.target.index
              : 0) -
            (b.target.field === "optionText"
              ? b.target.order
              : b.target.field === "structuredItem"
                ? b.target.index
                : 0),
      ),
    );
  });
});
