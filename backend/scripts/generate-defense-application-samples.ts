/** Development-only GS-006/GS-007 stage-capacity samples. All identities are fictitious. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderDefenseApplication } from "../src/documents/official-defense/defense-application/defense-application.renderer";
import type {
  DefenseApplicationRenderInput,
  DefenseApplicationType,
} from "../src/documents/official-defense/defense-application/defense-application.types";

type Variant = "masters" | "doctoral";
type SampleKind = "blank" | "normal" | "long";

const NORMAL_FACILITATOR = "Prof. Sofia L. Castillo";
const NORMAL_RAPPORTEUR = "Prof. Nico T. Bautista";
const LONG_FACILITATOR = "Prof. Maria Consuelo Fernandez-Ramos";
const LONG_RAPPORTEUR = "Prof. Christopher Emmanuel del Rosario";
const NORMAL_ADVISER = "Dr. Andrea V. Flores";
const LONG_ADVISER = "Dr. Maria Andrea Fernandez-Villanueva";

/** The first printed Panelist name may later be supplied from the Chairman assignment. */
const MASTERS_PANELISTS = [
  "Dr. Jordan M. Reyes",
  "Dr. Camille R. Dizon",
  "Dr. Miguel A. Ramos",
  "Dr. Isabel P. Mendoza",
  "Dr. Rafael C. Navarro",
];
const DOCTORAL_PANELISTS = [
  ...MASTERS_PANELISTS,
  "Dr. Patricia Beatriz Mendoza-Fernandez",
];
const LONG_PANELISTS = [
  "Dr. Maria Esperanza de la Cruz-Villanueva",
  "Dr. Juan Miguel de los Santos-Mendoza",
  "Dr. Alexandra Ysabel Santiago-Rodriguez",
  "Dr. Jose Antonio Garcia-de la Fuente",
  "Dr. Rafael Guillermo Navarro-Santiago",
  "Dr. Patricia Beatriz Mendoza-Fernandez",
];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--rasterize")) {
    throw new Error(
      "Usage: npm run forms:sample:application -- [--rasterize]",
    );
  }
  const backend = path.resolve(__dirname, "..");
  const assets = path.join(backend, "assets", "official-forms");
  const output = path.join(backend, ".tmp", "official-form-samples");
  const logos: DefenseApplicationRenderInput["logos"] = {
    earist: {
      mimeType: "image/jpeg",
      bytes: await readFile(path.join(assets, "earist-logo.jpg")),
    },
    graduateSchool: {
      mimeType: "image/jpeg",
      bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")),
    },
  };

  const identity = (variant: Variant, kind: SampleKind) => {
    if (kind === "blank") {
      return {
        studentName: "",
        courseAndMajor: "",
        studentNumber: "",
        cellphoneNumber: "",
        applicantDateAndTime: "",
        amountPaid: "",
        officialReceiptNumber: "",
        dateOfApplication: "",
        personalGmail: "",
        defenseDate: "",
        defenseTime: "",
        defenseLink: "",
        deanName: "",
        vicePresidentName: "",
        presidentName: "",
      } as const;
    }
    if (kind === "long") {
      return {
        studentName: "Maria Alexandra de los Santos-Villanueva",
        courseAndMajor:
          variant === "masters"
            ? "Master of Arts in Education - Educational Management"
            : "Doctor of Education - Educational Leadership and Management",
        studentNumber: "GRAD-2026-000123456",
        cellphoneNumber: "+63 917 000 0123",
        applicantDateAndTime: "30 September 2026, 10:00 AM",
        amountPaid: "PHP 900.00 (display only)",
        officialReceiptNumber: "QA-OR-2026-00001234567890",
        dateOfApplication: "30 September 2026",
        personalGmail: "maria.villanueva.qa@gmail.com",
        defenseDate: "30 September 2026",
        defenseTime: "10:00-11:30 AM",
        defenseLink: "meet.test/qa",
        deanName: "Dr. Jose Emmanuel de los Santos-Cruz",
        vicePresidentName: "Dr. Maria Alexandra Fernandez-Villanueva",
        presidentName: "Dr. Juan Miguel Santiago-Rodriguez",
      } as const;
    }
    return {
      studentName: "Alexandra M. Santos",
      courseAndMajor: variant === "masters" ? "MAEd" : "EdD",
      studentNumber: "2026-00123",
      cellphoneNumber: "0917 000 0123",
      applicantDateAndTime: "22 Oct 2026, 9:00 AM",
      amountPaid: "900.00",
      officialReceiptNumber: "QA-OR-00123",
      dateOfApplication: "22 October 2026",
      personalGmail: "alex.qa@gmail.com",
      defenseDate: "30 October 2026",
      defenseTime: "10:00 AM",
      defenseLink: "GS Room 201",
      deanName: "Dr. Gabriel L. Cruz",
      vicePresidentName: "Dr. Elena M. Mercado",
      presidentName: "Dr. Samuel R. Villanueva",
    } as const;
  };

  const application = (
    variant: Variant,
    applicationType: DefenseApplicationType,
    kind: SampleKind,
    adviserName: string,
    panelistNames: string[],
  ): DefenseApplicationRenderInput => ({
    variant,
    logos,
    applicationType,
    ...identity(variant, kind),
    committee: {
      ...(adviserName ? { adviserName } : {}),
      panelistNames,
      facilitatorName:
        kind === "blank"
          ? ""
          : kind === "long"
            ? LONG_FACILITATOR
            : NORMAL_FACILITATOR,
      rapporteurName:
        kind === "blank"
          ? ""
          : kind === "long"
            ? LONG_RAPPORTEUR
            : NORMAL_RAPPORTEUR,
    },
  });

  const samples: Array<{ name: string; input: DefenseApplicationRenderInput }> = [
    {
      name: "defense-application-gs006-blank",
      input: application("masters", null, "blank", "", []),
    },
    {
      name: "defense-application-gs006-title",
      input: application("masters", "title", "normal", "", MASTERS_PANELISTS),
    },
    {
      name: "defense-application-gs006-title-long",
      input: application(
        "masters",
        "title",
        "long",
        "",
        LONG_PANELISTS.slice(0, 5),
      ),
    },
    {
      name: "defense-application-gs006-proposal",
      input: application(
        "masters",
        "proposal",
        "normal",
        NORMAL_ADVISER,
        MASTERS_PANELISTS.slice(0, 4),
      ),
    },
    {
      name: "defense-application-gs006-final-long",
      input: application(
        "masters",
        "final",
        "long",
        LONG_ADVISER,
        LONG_PANELISTS.slice(0, 4),
      ),
    },
    {
      name: "defense-application-gs007-blank",
      input: application("doctoral", null, "blank", "", []),
    },
    {
      name: "defense-application-gs007-title",
      input: application(
        "doctoral",
        "title",
        "normal",
        "",
        DOCTORAL_PANELISTS,
      ),
    },
    {
      name: "defense-application-gs007-title-long",
      input: application("doctoral", "title", "long", "", LONG_PANELISTS),
    },
    {
      name: "defense-application-gs007-proposal",
      input: application(
        "doctoral",
        "proposal",
        "normal",
        NORMAL_ADVISER,
        DOCTORAL_PANELISTS.slice(0, 5),
      ),
    },
    {
      name: "defense-application-gs007-final-long",
      input: application(
        "doctoral",
        "final",
        "long",
        LONG_ADVISER,
        LONG_PANELISTS.slice(0, 5),
      ),
    },
  ];

  await mkdir(output, { recursive: true });
  for (const sample of samples) {
    const prefix = path.join(output, sample.name);
    await writeFile(
      prefix + ".pdf",
      await renderDefenseApplication(sample.input),
    );
    console.log(prefix + ".pdf");
    if (args.includes("--rasterize")) {
      execFileSync(
        process.env.PDFTOPPM_PATH || "pdftoppm",
        ["-png", "-singlefile", "-r", "150", prefix + ".pdf", prefix],
        { stdio: "inherit" },
      );
      console.log(prefix + ".png");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
