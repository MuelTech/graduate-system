import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { EXAM_PNG } from "./exam-images";

export function syntheticExamManifest() {
  return {
    packageName: "Synthetic package",
    scope: { actualQuestionRange: [1, 3] },
    rules: {},
    questions: [
      { questionNumber: 1, questionText: "Choose a synthetic word.", questionType: "TEXT_MULTIPLE_CHOICE", stimulus: null,
        options: [{ label: "F", text: "First", image: null }, { label: "K", text: "Second", image: null }], correctAnswer: "K", verificationStatus: "VERIFIED" },
      { questionNumber: 2, questionText: "Complete this synthetic matrix.", questionType: "STRUCTURED_STIMULUS_TEXT_CHOICES", stimulus: { type: "MATRIX", rows: [[1, "1/2"], [2, "?"]] },
        options: [{ label: "A", text: "One", image: null }, { label: "B", text: "Two", image: null }], correctAnswer: "A", verificationStatus: "VERIFIED" },
      { questionNumber: 3, questionText: "Choose a synthetic image.", questionType: "VISUAL_STIMULUS_VISUAL_CHOICES", stimulus: { type: "IMAGE", image: "assets/q003/stimulus.png" },
        options: ["F", "G", "H", "J", "K"].map(label => ({ label, text: null, image: `assets/q003/option_${label}.png` })), correctAnswer: "J", verificationStatus: "VERIFIED" },
    ],
  };
}

export async function writeSyntheticManifest(root: string, manifest: unknown): Promise<void> {
  await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
}

export async function createSyntheticExamPackage(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "exam-importer-"));
  await mkdir(path.join(root, "assets", "q003"), { recursive: true });
  await writeSyntheticManifest(root, syntheticExamManifest());
  for (const name of ["stimulus", ...["F", "G", "H", "J", "K"].map(label => `option_${label}`)]) {
    await writeFile(path.join(root, "assets", "q003", `${name}.png`), EXAM_PNG);
  }
  return root;
}

export async function removeSyntheticExamPackage(root: string): Promise<void> {
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("exam-importer-")) throw new Error("Unsafe synthetic package cleanup target.");
  await rm(resolved, { recursive: true, force: true });
}
