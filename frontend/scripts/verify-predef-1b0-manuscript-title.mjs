// Run: node --test scripts/verify-predef-1b0-manuscript-title.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createManuscriptSubmission,
  MANUSCRIPT_TITLE_MAX_LENGTH,
} from "../src/lib/manuscript-submission.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const file = new File(["dummy manuscript"], "manuscript.pdf", { type: "application/pdf" });

for (const title of ["", " \r\n\t "]) {
  test(`blank title ${JSON.stringify(title)} blocks multipart creation`, () => {
    assert.throws(() => createManuscriptSubmission(title, file), /Title is required/);
  });
}

test("title and exact file are paired in the same multipart body without rewriting academic content", async () => {
  const title = "Digital LEARNING: A Mixed-Methods Study\nAcross Graduate Schools";
  const form = createManuscriptSubmission(`  ${title}  `, file);
  assert.deepEqual([...form.keys()], ["manuscriptTitle", "document"]);
  assert.equal(form.get("manuscriptTitle"), title);
  assert.equal(form.get("document").name, "manuscript.pdf");
  assert.equal(await form.get("document").text(), "dummy manuscript");
});

test("file remains mandatory when title exists", () => {
  assert.throws(() => createManuscriptSubmission("Explicit Title", null), /file is required/);
});

test("long academic titles remain intact up to the bound; excess is rejected without truncation", () => {
  const title = "A".repeat(MANUSCRIPT_TITLE_MAX_LENGTH);
  assert.equal(createManuscriptSubmission(title, file).get("manuscriptTitle"), title);
  assert.throws(() => createManuscriptSubmission(`${title}B`, file), /2000 characters or fewer/);
});

test("Proposal and Final revisions can submit independent titles with independent files", () => {
  const first = createManuscriptSubmission("Proposal Title", file);
  const second = createManuscriptSubmission("Final Title", new File(["revision"], "final-v2.pdf"));
  assert.equal(first.get("manuscriptTitle"), "Proposal Title");
  assert.equal(first.get("document").name, "manuscript.pdf");
  assert.equal(second.get("manuscriptTitle"), "Final Title");
  assert.equal(second.get("document").name, "final-v2.pdf");
});

test("client and server agree on the bounded maximum", () => {
  assert.match(read("../backend/src/services/manuscript-title.rules.ts"), new RegExp(`MANUSCRIPT_TITLE_MAX_LENGTH = ${MANUSCRIPT_TITLE_MAX_LENGTH}`));
});

for (const stage of ["proposal", "final"]) {
  test(`${stage} submission captures a required title and sends it through the existing manuscript endpoint`, () => {
    const source = read(`src/components/student/${stage}-adviser-review-panel.tsx`);
    assert.match(source, /Thesis\/Dissertation Title/);
    assert.match(source, new RegExp(`htmlFor="${stage}-manuscript-title"`));
    assert.match(source, new RegExp(`id="${stage}-manuscript-title"[\\s\\S]{0,350}required`));
    assert.match(source, /value=\{manuscriptTitle\}/);
    assert.match(source, /maxLength=\{MANUSCRIPT_TITLE_MAX_LENGTH\}/);
    assert.match(source, /createManuscriptSubmission\(manuscriptTitle, file\)/);
    assert.match(source, new RegExp(`/thesis/${stage}-adviser-review/manuscript`));
    assert.match(source, /disabled=\{!file \|\| !manuscriptTitle\.trim\(\) \|\| submitManuscript\.isPending\}/);
    assert.match(source, /onSuccess:[\s\S]*?setManuscriptTitle\(""\)/);
    assert.match(source, /data\.manuscript\.manuscriptTitle/);
    assert.doesNotMatch(source, /manuscriptTitle[^\n]*officialTitle|setManuscriptTitle\(data/);
  });

  test(`${stage} loading, requested-changes, issued, and failure behaviors remain present`, () => {
    const source = read(`src/components/student/${stage}-adviser-review-panel.tsx`);
    assert.match(source, /if \(isLoading && !data\)/);
    assert.match(source, /status === "NONE" \|\| status === "CHANGES_REQUESTED"/);
    assert.match(source, /status === "ISSUED" && data\?\.certification/);
    assert.match(source, /Submission failed/);
    assert.match(source, /onError:[\s\S]*?setError/);
  });
}

test("Adviser action panel shows title and filename from the exact task manuscript", () => {
  const source = read("src/components/panelist/adviser-review-action-panel.tsx");
  assert.match(source, /task\.manuscript\?\.manuscriptTitle \|\| "Title not recorded for this manuscript\."/);
  assert.match(source, /task\.manuscript\?\.originalFilename/);
  assert.match(source, /const manuscriptId = task\?\.manuscript\?\.documentId/);
  assert.doesNotMatch(source, /task\.officialTitle|workingTitle/);
});

test("My Advisees review cards and detail rows display exact title/file metadata", () => {
  for (const path of ["src/components/panelist/my-advisees-workspace.tsx", "src/app/(portal)/panelist/advisees/[studentId]/page.tsx"]) {
    const source = read(path);
    assert.match(source, /label="Thesis\/Dissertation Title"[\s\S]*?task\.manuscriptTitle/);
    assert.match(source, /label="Manuscript file"[\s\S]*?task\.originalFilename/);
  }
});

test("Final Proposal-completion and STRIKE gates still protect the upload surface", () => {
  const source = read("src/components/student/final-adviser-review-panel.tsx");
  assert.match(source, /canUpload && !blockedByProposal && !blockedByStrike/);
});
