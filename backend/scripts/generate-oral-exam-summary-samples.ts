/** Development-only GS-011 samples. No application bootstrap, DB, or signature retrieval. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderOralExamSummary } from "../src/documents/official-defense/oral-exam-summary/oral-exam-summary.renderer";
import type { OralExamSummaryRenderInput } from "../src/documents/official-defense/oral-exam-summary/oral-exam-summary.types";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--rasterize")) throw new Error("Usage: npm run forms:sample:summary -- [--rasterize]");
  const backend = path.resolve(__dirname, "..");
  const assets = path.join(backend, "assets", "official-forms");
  const output = path.join(backend, ".tmp", "official-form-samples");
  const blank: OralExamSummaryRenderInput = {
    logos: {
      earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
    },
    stage: "proposal",
    candidateName: "", course: "", date: "", studentNumber: "", examiners: [],
    submittedBy: { chairmanName: "", memberNames: [] }, adviserName: "", deanName: "",
  };
  // Fictitious names and independently supplied values. No averages or identities are derived.
  const filled: OralExamSummaryRenderInput = {
    ...blank,
    candidateName: "Alexandra M. Santos", course: "MAEd", date: "22 October 2026", studentNumber: "2026-00123",
    examiners: [
      { examinerName: "Dr. Jordan M. Reyes", groupARating: "1.25", groupBRating: "1.50", average: "1.38" },
      { examinerName: "Dr. Camille R. Dizon", groupARating: "1.50", groupBRating: "1.25", average: "1.38" },
      { examinerName: "Dr. Miguel A. Ramos", groupARating: "1.25", groupBRating: "1.25", average: "1.25" },
      { examinerName: "Dr. Isabel P. Mendoza", groupARating: "1.50", groupBRating: "1.50", average: "1.50" },
      { examinerName: "Dr. Rafael C. Navarro", groupARating: "1.25", groupBRating: "1.50", average: "1.38" },
    ],
    submittedBy: {
      chairmanName: "Dr. Jordan M. Reyes",
      memberNames: ["Dr. Camille R. Dizon", "Dr. Miguel A. Ramos", "Dr. Isabel P. Mendoza", "Dr. Rafael C. Navarro"],
    },
    adviserName: "Dr. Andrea V. Flores", deanName: "Dr. Gabriel L. Cruz",
  };
  // Stage layouts: Title has no Adviser seat; Proposal/Final retain the block.
  const title: OralExamSummaryRenderInput = { ...filled, stage: "title", adviserName: "" };
  const final: OralExamSummaryRenderInput = { ...filled, stage: "final" };
  const longNames = [
    "Dr. Maria Esperanza de la Cruz-Villanueva", "Dr. Juan Miguel de los Santos-Mendoza",
    "Dr. Alexandra Ysabel Santiago-Rodriguez", "Dr. Jose Antonio Garcia-de la Fuente",
    "Dr. Maria Consuelo Fernandez-Ramos", "Dr. Christopher Emmanuel del Rosario",
  ];
  const long: OralExamSummaryRenderInput = {
    ...filled,
    candidateName: "Maria Alexandra de los Santos-Villanueva",
    course: "PhD in Educational Leadership", date: "30 September 2026", studentNumber: "GRAD-2026-000123456",
    examiners: longNames.map(examinerName => ({ examinerName, groupARating: "1.25", groupBRating: "1.50", average: "1.38" })),
    submittedBy: { chairmanName: longNames[0], memberNames: longNames.slice(1) },
    adviserName: "Dr. Maria Andrea Fernandez-Villanueva", deanName: "Dr. Jose Emmanuel de los Santos-Cruz",
  };
  await mkdir(output, { recursive: true });
  for (const [name, input] of [
    ["oral-exam-summary-blank", blank],
    ["oral-exam-summary-title", title],
    ["oral-exam-summary", filled],
    ["oral-exam-summary-final", final],
    ["oral-exam-summary-long", long],
  ] as const) {
    const prefix = path.join(output, name);
    await writeFile(prefix + ".pdf", await renderOralExamSummary(input));
    console.log(prefix + ".pdf");
    if (args.includes("--rasterize")) {
      execFileSync(process.env.PDFTOPPM_PATH || "pdftoppm", ["-png", "-singlefile", "-r", "150", prefix + ".pdf", prefix], { stdio: "inherit" });
      console.log(prefix + ".png");
    }
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
