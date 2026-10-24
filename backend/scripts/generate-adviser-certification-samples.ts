/** Development-only GS-017 samples. All names, dates, and signature strokes are fictitious. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderAdviserCertification } from "../src/documents/official-defense/adviser-certification/adviser-certification.renderer";
import type { AdviserCertificationRenderInput } from "../src/documents/official-defense/adviser-certification/adviser-certification.types";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--rasterize")) {
    throw new Error("Usage: npm run forms:sample:certification -- [--rasterize]");
  }
  const backend = path.resolve(__dirname, "..");
  const assets = path.join(backend, "assets", "official-forms");
  const output = path.join(backend, ".tmp", "official-form-samples");
  const proposal: AdviserCertificationRenderInput = {
    logos: {
      earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
    },
    stage: "proposal",
    manuscriptTitle: "Digital Learning Resources and Student Engagement in Graduate Education",
    studentName: "Alexandra M. Santos",
    programName: "Master of Arts in Education",
    issuedDay: "24", issuedMonthYear: "October 2026",
    adviserPrintedName: "Dr. Andrea V. Flores",
  };
  // A transparent, deliberately geometric zigzag demonstrates image containment.
  // This is a dummy image, not a person's signature or a retrieved production asset.
  const final: AdviserCertificationRenderInput = {
    ...proposal, stage: "final",
    manuscriptTitle: "A Framework for Accessible Digital Research Services in Graduate Schools",
    issuedDay: "30", issuedMonthYear: "November 2026",
    adviserSignature: {
      mimeType: "image/png",
      bytes: Uint8Array.from(Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAPAAAAA8CAYAAABYfzddAAAB+ElEQVR4nO3YS24CMRAFQA7B/a+aKAukCDHAePzpbldJbLKAtv1ezHC7AQAAAAAAAAAAAADQ7H6///y9Vs8BNJZXgSEhBYaklBcKlFeBIZH/pVVgSEaBIekj5PPA6RYAuz4+Km9f9i9vaVOemwL3kToEm5c27Zm9Gj71ghYoE4bCSpX24WgRJRY3QclQFFP2fN4tptRCB3gVCHsWR9nSVrh9Vx7KUSii79kutihu1tt35cF8+uyoe7aDbUr78GmRkTbh6Blz1nzffGak/drF1r89RC/wu8OZNdu3wVi9VzvZurQP3yw6yvPliq+qZ8KRNUCrv9WclWXO4SKG8szhjJytJSDRw/SuqFdeq2a/7S5SgVsOaMRsrSGJFqoeBYxQbsU9sLIkz+8doTBXQrIyWKtvyhElV9oPzmzKjFuu5f17zhVljuhlPSvCDV7Oqpuu5+GMmGn1LEdzVQ94xTWVuX1Hha73XKvm2K2sJLl9R4bvyvv1nKl1LxWVJi3haLmtRwax1z+U0XMoK2kKPDOUV2+93nMoKlNcvbmO/j4zoFe+DYyYQ1lJVd7VYW35NjByDkVluJ4/+KwM7tlnzrnTQYIC95/u/CyRZ4SuroY6SilezaG4lFcl2P9LqriQSJRncKCB4kJSiguJKS4AAAAAAAAAAAAA3Cr4BYBOH/x1dORkAAAAAElFTkSuQmCC", "base64",
      )),
    },
  };
  const long: AdviserCertificationRenderInput = {
    ...proposal,
    manuscriptTitle: "Development and Evaluation of an Accessible Digital Research Support Framework for Graduate Students: Institutional Readiness, Academic Collaboration, and Sustainable Knowledge Management in Public Higher Education Institutions",
    studentName: "Maria Alexandra Esperanza de los Santos-Villanueva",
    programName: "Doctor of Philosophy in Educational Management and Institutional Leadership",
    adviserPrintedName: "Dr. Maria Andrea Fernandez-Villanueva",
    issuedDay: "30", issuedMonthYear: "September 2026",
  };
  const blank: AdviserCertificationRenderInput = {
    ...proposal, manuscriptTitle: "", studentName: "", programName: "",
    issuedDay: "", issuedMonthYear: "", adviserPrintedName: "",
  };
  await mkdir(output, { recursive: true });
  for (const [name, input] of [
    ["adviser-certification-proposal", proposal],
    ["adviser-certification-final", final],
    ["adviser-certification-long", long],
    ["adviser-certification-blank", blank],
  ] as const) {
    const prefix = path.join(output, name);
    await writeFile(prefix + ".pdf", await renderAdviserCertification(input));
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
