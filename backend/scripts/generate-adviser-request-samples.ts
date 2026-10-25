/** Development-only GS-020 samples. Every name, date, and signature is fictitious. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderAdviserRequest } from "../src/documents/official-defense/adviser-request/adviser-request.renderer";
import type { AdviserRequestRenderInput } from "../src/documents/official-defense/adviser-request/adviser-request.types";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--rasterize")) {
    throw new Error("Usage: npm run forms:sample:adviser-request -- [--rasterize]");
  }
  const backend = path.resolve(__dirname, "..");
  const assets = path.join(backend, "assets", "official-forms");
  const output = path.join(backend, ".tmp", "official-form-samples");
  const normal: AdviserRequestRenderInput = {
    logos: {
      earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
    },
    requestDate: "October 25, 2026",
    requestedAdviserName: "Dr. Andrea V. Flores",
    reason: "her expertise in educational technology and experience in guiding graduate research will support the development of my study.",
    studentName: "Alexandra M. Santos",
    studentNumber: "2026-00123",
    programName: "Master of Arts in Education",
  };
  const long: AdviserRequestRenderInput = {
    ...normal,
    requestDate: "September 30, 2026",
    requestedAdviserName: "Dr. Maria Andrea Fernandez-Villanueva",
    studentName: "Maria Alexandra Esperanza de los Santos-Villanueva",
    studentNumber: "GS-2026-001234567890",
    programName: "Doctor of Philosophy in Educational Management and Institutional Leadership",
    reason: "her experience in educational management, accessible digital research services, and institutional leadership will help me develop a rigorous framework. Her guidance in research design, analysis, and ethical practice will strengthen the quality and relevance of my dissertation in public higher education.",
  };
  // Reuse the accepted GS-017 dummy: transparent geometric zigzags, never a real signature.
  const signed: AdviserRequestRenderInput = {
    ...normal,
    studentSignature: {
      mimeType: "image/png",
      bytes: Uint8Array.from(Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAPAAAAA8CAYAAABYfzddAAAB+ElEQVR4nO3YS24CMRAFQA7B/a+aKAukCDHAePzpbldJbLKAtv1ezHC7AQAAAAAAAAAAAADQ7H6///y9Vs8BNJZXgSEhBYaklBcKlFeBIZH/pVVgSEaBIekj5PPA6RYAuz4+Km9f9i9vaVOemwL3kToEm5c27Zm9Gj71ghYoE4bCSpX24WgRJRY3QclQFFP2fN4tptRCB3gVCHsWR9nSVrh9Vx7KUSii79kutihu1tt35cF8+uyoe7aDbUr78GmRkTbh6Blz1nzffGak/drF1r89RC/wu8OZNdu3wVi9VzvZurQP3yw6yvPliq+qZ8KRNUCrv9WclWXO4SKG8szhjJytJSDRw/SuqFdeq2a/7S5SgVsOaMRsrSGJFqoeBYxQbsU9sLIkz+8doTBXQrIyWKtvyhElV9oPzmzKjFuu5f17zhVljuhlPSvCDV7Oqpuu5+GMmGn1LEdzVQ94xTWVuX1Hha73XKvm2K2sJLl9R4bvyvv1nKl1LxWVJi3haLmtRwax1z+U0XMoK2kKPDOUV2+93nMoKlNcvbmO/j4zoFe+DYyYQ1lJVd7VYW35NjByDkVluJ4/+KwM7tlnzrnTQYIC95/u/CyRZ4SuroY6SilezaG4lFcl2P9LqriQSJRncKCB4kJSiguJKS4AAAAAAAAAAAAA3Cr4BYBOH/x1dORkAAAAAElFTkSuQmCC", "base64",
      )),
    },
  };
  const blank: AdviserRequestRenderInput = {
    ...normal, requestDate: "", requestedAdviserName: "", reason: "",
    studentName: "", studentNumber: "", programName: "",
  };
  await mkdir(output, { recursive: true });
  for (const [name, input] of [
    ["adviser-request-normal", normal], ["adviser-request-long", long],
    ["adviser-request-signed", signed], ["adviser-request-blank", blank],
  ] as const) {
    const prefix = path.join(output, name);
    await writeFile(prefix + ".pdf", await renderAdviserRequest(input));
    console.log(prefix + ".pdf");
    if (args.includes("--rasterize")) {
      execFileSync(process.env.PDFTOPPM_PATH || "pdftoppm", [
        "-png", "-singlefile", "-r", "150", prefix + ".pdf", prefix,
      ], { stdio: "inherit" });
      console.log(prefix + ".png");
    }
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
