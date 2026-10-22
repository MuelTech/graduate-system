/** Development-only GS-006/GS-007 reconstruction samples. All identities are fictitious. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderDefenseApplication } from "../src/documents/official-defense/defense-application/defense-application.renderer";
import type { DefenseApplicationRenderInput } from "../src/documents/official-defense/defense-application/defense-application.types";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--rasterize")) throw new Error("Usage: npm run forms:sample:application -- [--rasterize]");
  const backend = path.resolve(__dirname, "..");
  const assets = path.join(backend, "assets", "official-forms");
  const output = path.join(backend, ".tmp", "official-form-samples");
  const logos = {
    earist: { mimeType: "image/jpeg" as const, bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
    graduateSchool: { mimeType: "image/jpeg" as const, bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
  };
  const blank: DefenseApplicationRenderInput = {
    variant: "masters", logos, applicationType: null, studentName: "", courseAndMajor: "", studentNumber: "",
    cellphoneNumber: "", applicantDateAndTime: "", amountPaid: "", officialReceiptNumber: "",
    dateOfApplication: "", personalGmail: "", defenseDate: "", defenseTime: "", defenseLink: "",
    committee: { adviserName: "", panelistNames: [], facilitatorName: "", rapporteurName: "" },
    deanName: "", vicePresidentName: "", presidentName: "",
  };
  const filled: DefenseApplicationRenderInput = {
    ...blank, applicationType: "proposal", studentName: "Alexandra M. Santos", courseAndMajor: "MAEd",
    studentNumber: "2026-00123", cellphoneNumber: "0917 000 0123", applicantDateAndTime: "22 Oct 2026, 9:00 AM",
    amountPaid: "900.00", officialReceiptNumber: "QA-OR-00123", dateOfApplication: "22 October 2026",
    personalGmail: "alex.qa@gmail.com", defenseDate: "30 October 2026", defenseTime: "10:00 AM", defenseLink: "GS Room 201",
    committee: {
      adviserName: "Dr. Andrea V. Flores",
      panelistNames: ["Dr. Jordan M. Reyes", "Dr. Camille R. Dizon", "Dr. Miguel A. Ramos", "Dr. Isabel P. Mendoza"],
      facilitatorName: "Prof. Sofia L. Castillo", rapporteurName: "Prof. Nico T. Bautista",
    },
    deanName: "Dr. Gabriel L. Cruz", vicePresidentName: "Dr. Elena M. Mercado", presidentName: "Dr. Samuel R. Villanueva",
  };
  const long: DefenseApplicationRenderInput = {
    ...filled, applicationType: "final", studentName: "Maria Alexandra de los Santos-Villanueva",
    courseAndMajor: "Master of Arts in Education - Educational Management",
    studentNumber: "GRAD-2026-000123456", cellphoneNumber: "+63 917 000 0123",
    applicantDateAndTime: "30 September 2026, 10:00 AM", amountPaid: "PHP 900.00 (display only)",
    officialReceiptNumber: "QA-OR-2026-00001234567890", dateOfApplication: "30 September 2026",
    personalGmail: "maria.villanueva.qa@gmail.com", defenseDate: "30 September 2026", defenseTime: "10:00-11:30 AM",
    defenseLink: "meet.test/qa",
    committee: {
      adviserName: "Dr. Maria Andrea Fernandez-Villanueva",
      panelistNames: ["Dr. Maria Esperanza de la Cruz-Villanueva", "Dr. Juan Miguel de los Santos-Mendoza",
        "Dr. Alexandra Ysabel Santiago-Rodriguez", "Dr. Jose Antonio Garcia-de la Fuente"],
      facilitatorName: "Prof. Maria Consuelo Fernandez-Ramos", rapporteurName: "Prof. Christopher Emmanuel del Rosario",
    },
    deanName: "Dr. Jose Emmanuel de los Santos-Cruz",
    vicePresidentName: "Dr. Maria Alexandra Fernandez-Villanueva", presidentName: "Dr. Juan Miguel Santiago-Rodriguez",
  };
  await mkdir(output, { recursive: true });
  for (const variant of ["masters", "doctoral"] as const) {
    for (const [suffix, example] of [["-blank", blank], ["", filled], ["-long", long]] as const) {
      const input: DefenseApplicationRenderInput = variant === "masters" ? example : {
        ...example, variant: "doctoral", courseAndMajor: suffix === "-blank" ? "" : suffix === "-long"
          ? "Doctor of Education - Educational Leadership and Management" : "EdD",
        committee: {
          panelistNames: example.committee.panelistNames,
          facilitatorName: example.committee.facilitatorName, rapporteurName: example.committee.rapporteurName,
        },
      };
      // All six physical slots exercised only by the doctoral stress sample; unused filled slots remain blank.
      const sample: DefenseApplicationRenderInput = variant === "doctoral" && suffix === "-long" ? {
        ...input, variant: "doctoral",
        committee: {
          facilitatorName: input.committee.facilitatorName, rapporteurName: input.committee.rapporteurName,
          panelistNames: [...input.committee.panelistNames, "Dr. Rafael Guillermo Navarro-Santiago", "Dr. Patricia Beatriz Mendoza-Fernandez"] },
      } : input;
      const prefix = path.join(output, "defense-application-" + (variant === "masters" ? "gs006" : "gs007") + suffix);
      await writeFile(prefix + ".pdf", await renderDefenseApplication(sample));
      console.log(prefix + ".pdf");
      if (args.includes("--rasterize")) {
        execFileSync(process.env.PDFTOPPM_PATH || "pdftoppm", ["-png", "-singlefile", "-r", "150", prefix + ".pdf", prefix], { stdio: "inherit" });
        console.log(prefix + ".png");
      }
    }
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
