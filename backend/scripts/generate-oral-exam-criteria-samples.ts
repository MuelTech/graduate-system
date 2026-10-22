/** Development-only TEMPLATE-1 samples. No application bootstrap, environment file, DB, or HTTP. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderOralExamCriteria } from "../src/documents/official-defense/oral-exam-criteria/oral-exam-criteria.renderer";
import type { OralExamCriteriaRenderInput } from "../src/documents/official-defense/oral-exam-criteria/oral-exam-criteria.types";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--rasterize")) throw new Error("Usage: npm run forms:sample:criteria -- [--rasterize]");
  const backend = path.resolve(__dirname, "..");
  const output = path.join(backend, ".tmp", "official-form-samples");
  const assets = path.join(backend, "assets", "official-forms");
  const logos: OralExamCriteriaRenderInput["logos"] = {
    earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
    graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
  };
  const blank: OralExamCriteriaRenderInput = {
    logos,
    candidateName: "", course: "", date: "",
    groupI: [null, null, null, null, null], groupII: [null, null, null, null],
    groupIAverage: "", groupIIAverage: "", recommendations: "", rating: "", remarks: "",
    evaluatorPrintedName: "",
  };
  // All names and academic values below are fictitious, explicitly supplied layout examples.
  // Deliberately no calculated averages, interpreted remarks, verdicts, or real signatures.
  // X marks are unconfirmed dummy QA glyphs; the blank reference prescribes no selected-cell symbol.
  const filled: OralExamCriteriaRenderInput = {
    ...blank,
    candidateName: "Alexandra M. Santos",
    course: "MAEd",
    date: "22 October 2026",
    groupI: ["1.25", "1.50", "1.25", "1.50", "1.25"],
    groupII: ["1.25", "1.50", "1.25", "1.50"],
    groupIAverage: "1.35", groupIIAverage: "1.38",
    recommendations: "Clarify the sampling procedure and refine the discussion of findings.",
    rating: "Sample rating", remarks: "Sample remarks only",
    evaluatorPrintedName: "Dr. Jordan M. Reyes",
  };
  const long: OralExamCriteriaRenderInput = {
    ...filled,
    candidateName: "Maria Alexandra de los Santos-Villanueva",
    course: "PhD in Education - Educational Leadership",
    date: "30 September 2026",
    recommendations: "Clarify the sampling procedure and strengthen the discussion of educational implications. Review the alignment of conclusions with the research objectives.",
    rating: "Explicit sample rating supplied for layout review",
    remarks: "Sample remarks; no academic conclusion inferred",
    evaluatorPrintedName: "Dr. Maria Esperanza de la Cruz-Villanueva",
  };
  await mkdir(output, { recursive: true });
  for (const [name, input] of [
    ["oral-exam-criteria-blank", blank],
    ["oral-exam-criteria", filled],
    ["oral-exam-criteria-long", long],
  ] as const) {
    const prefix = path.join(output, name);
    await writeFile(`${prefix}.pdf`, await renderOralExamCriteria(input));
    console.log(`${prefix}.pdf`);
    if (args.includes("--rasterize")) {
      // Optional development QA only; pdf-lib is the sole production renderer.
      execFileSync(process.env.PDFTOPPM_PATH || "pdftoppm", [
        "-png", "-singlefile", "-r", "150", `${prefix}.pdf`, prefix,
      ], { stdio: "inherit" });
      console.log(`${prefix}.png`);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
