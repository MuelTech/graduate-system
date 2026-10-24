import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\s+/g, " ");
const admin = read(
  "src/components/admin/defense-scheduling/scheduled-defense-submission.tsx",
);
const student = read(
  "src/components/student/official-defense-application-record.tsx",
);
const proxy = read(
  "src/app/api/student-defense-applications/[scheduleId]/pdf/route.ts",
);

test("Admin selected schedule embeds submission context using the exact schedule ID", () => {
  assert.match(
    read(
      "src/components/admin/defense-scheduling/scheduled-defense-detail.tsx",
    ),
    /<ScheduledDefenseSubmission scheduleId=\{detail.scheduleId\}/,
  );
  assert.match(
    admin,
    /\/thesis\/defense\/schedules\/\$\{encodeURIComponent\(scheduleId\)\}\/submission/,
  );
  for (const label of [
    "Application Requirements",
    "Manuscript",
    "Thesis/Dissertation Title",
    "manuscriptTitle",
    "originalFilename",
    "data.stage",
  ])
    assert.ok(admin.includes(label));
  assert.ok(admin.includes("Adviser Certification"));
  assert.ok(!admin.includes("Defense Submission"));
  assert.ok(!admin.includes("Exact Manuscript"));
  assert.ok(!admin.includes("Adviser Certification · GS-017"));
});
test("manuscript and evidence viewers use authorized exact document IDs", () => {
  assert.match(admin, /thesis-document\/\$\{encodeURIComponent\(id\)\}\/file/);
  assert.match(admin, /viewDocument\(data.manuscript!.id\)/);
  assert.match(admin, /manuscriptIntegrityError.*role="alert"/);
  assert.ok(
    admin.includes("The scheduled manuscript could not be verified."),
  );
  assert.doesNotMatch(admin, /latest|newest|currentManuscript/);
});
test("only Proposal/Final render the exact GS-017 records supplied by the schedule service", () => {
  assert.match(admin, /data.stage === "PROPOSAL" \|\| data.stage === "FINAL"/);
  assert.match(admin, /exactRecords=\{\[data.certification.record\]\}/);
  const record = read(
    "src/components/shared/adviser-certification-records.tsx",
  );
  assert.match(record, /enabled: exactRecords === undefined/);
  assert.match(record, /const items = exactRecords \?\? records.data/);
  assert.match(record, /View Certification/);
  assert.match(record, /Download Certification/);
});
test("application requirements distinguish current, ambiguity and read-only history", () => {
  for (const label of [
    "Application Requirements",
    "Certificate of Registration (COR)",
    "Multiple current versions recorded — review required.",
    "View document history",
    "Previous:",
  ])
    assert.ok(admin.includes(label));
  assert.match(admin, /DEFENSE_REQUIREMENT_LABELS\[docType\]/);
  assert.match(admin, /docType === "COR"/);
  assert.match(
    read("src/components/admin/defense-applications/labels.ts"),
    /TITLE_PROPOSAL: "Title Defense Proposal Package"/,
  );
  assert.match(
    read("src/components/admin/defense-applications/labels.ts"),
    /RECEIPT: "Proof of Payment"/,
  );
  assert.match(admin, />\s*View\s*<\/Button>/);
  assert.match(admin, /viewDocument\(slot.current!.id\)/);
  assert.match(admin, /viewDocument\(doc.id\)/);
  for (const removed of [
    "Supporting Evidence",
    "Current:",
    "Replacement history",
    "Superseded:",
    "View historical evidence",
    "View evidence",
    "Document: ",
    "exact schedule-bound manuscript",
  ])
    assert.ok(!admin.includes(removed));
});
test("Student record lives only within an existing exact schedule summary", () => {
  const surface = read("src/components/student/defense-status-panel.tsx");
  assert.match(surface, /if \(!session\) return null/);
  assert.match(
    surface,
    /session.scheduleId && \([\s\S]*<StudentOfficialApplicationRecord scheduleId=\{session.scheduleId\}/,
  );
  assert.match(student, /session.user.role !== "student"\) return null/);
});
test("Student controls require backend-confirmed exact schedule availability", () => {
  assert.match(
    student,
    /\/thesis\/student\/defense\/\$\{encodeURIComponent\(scheduleId\)\}\/application/,
  );
  const gate = student.indexOf(
    "if (!record?.available || record.scheduleId !== scheduleId) return",
  );
  assert.ok(gate > -1 && gate < student.indexOf("View Application"));
  assert.match(student, /query.isError\) return/);
  assert.match(student, /Download Application/);
  assert.match(student, /downloadOfficialDefensePdf\(\s*`\$\{path\}\/pdf`/);
  assert.match(
    student,
    /student-defense-applications\/\$\{encodeURIComponent\(scheduleId\)\}\/pdf/,
  );
});
test("Student guidance explicitly removes any extra paper or upload step", () => {
  assert.ok(
    student.includes(
      "This is your official Defense Application. No additional submission is required unless instructed by the Graduate School.",
    ),
  );
  assert.ok(!student.includes("View Official Application"));
  assert.ok(!student.includes("Download Copy"));
  assert.ok(!student.includes("Official Defense Application"));
});
test("new surfaces introduce no upload, committee edit, replacement or scheduling mutations", () => {
  for (const source of [admin, student])
    assert.doesNotMatch(
      source,
      /type="file"|<input|method:\s*["'](?:POST|PUT|PATCH|DELETE)|apiClientRequest\([^;]*method:|onUpload|onDelete|onReplace|onReschedule|signatureData|storageKey|checksum|filePath/,
    );
});
test("query caches and preview states are scoped by authenticated identity and exact schedule", () => {
  for (const source of [admin, student]) {
    assert.match(source, /session.user.id.*session.user.role/);
    assert.match(source, /key=\{`\$\{viewerScope\}:\$\{scheduleId\}`\}/);
    assert.match(source, /queryKey: \[[^\]]*viewerScope, scheduleId\]/);
  }
});
test("Student inline proxy authenticates, enforces Student role, forwards exact ID without caching", () => {
  for (const text of [
    "await auth()",
    'session.user.role !== "student"',
    "encodeURIComponent(scheduleId)",
    'cache: "no-store"',
    '"private, no-store"',
    '"Content-Disposition": "inline"',
    '"X-Content-Type-Options": "nosniff"',
  ])
    assert.ok(proxy.includes(text));
  assert.match(proxy, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(
    proxy,
    /records\/application\/pdf|export async function (POST|PUT|PATCH|DELETE)/,
  );
});
