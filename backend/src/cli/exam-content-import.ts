import "dotenv/config";
import path from "path";
import { preflightExamPackage } from "../services/exam-content-package.service";
import { ExamContentImportError } from "../interfaces/exam-content-import.interfaces";
import type { ExamImportSummary } from "../interfaces/exam-content-import.interfaces";

export function parseExamImportArgs(argv: readonly string[]): { apply: boolean } {
  if (argv.some(arg => arg !== "--apply" && arg !== "--dry-run") ||
      new Set(argv).size !== argv.length || (argv.includes("--apply") && argv.includes("--dry-run"))) {
    throw new ExamContentImportError("INVALID_PACKAGE", "Use no arguments or --dry-run for preflight; --apply explicitly imports the fixed source package.");
  }
  return { apply: argv.includes("--apply") };
}

export async function runExamContentImportCli(argv: readonly string[]): Promise<ExamImportSummary> {
  const { apply } = parseExamImportArgs(argv);
  const root = path.resolve(__dirname, "../../exam-content/olsat");
  if (!apply) {
    // No database module, private provider or importer is loaded by preflight.
    const prepared = await preflightExamPackage(root);
    return { ...prepared.counts, status: "PREFLIGHT_OK", questionsImported: 0, mediaObjectsCreated: 0 };
  }
  const [{ ExamContentImporter }, { ExamContentImportRepository }, { ExamMediaService }, { default: prisma }] = await Promise.all([
    import("../services/exam-content-import.service"),
    import("../repositories/exam-content-import.repository"),
    import("../services/exam-media.service"),
    import("../config/database"),
  ]);
  try { return await new ExamContentImporter(new ExamContentImportRepository(), new ExamMediaService()).importPackage(root); }
  finally { await prisma.$disconnect(); }
}

if (require.main === module) {
  runExamContentImportCli(process.argv.slice(2)).then(result => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error: unknown) => {
    const safe = error instanceof ExamContentImportError
      ? { code: error.code, error: error.message, ...(error.cleanup ? { cleanup: error.cleanup } : {}) }
      : { code: "IMPORT_FAILED", error: "Exam content operation failed; no success was reported." };
    process.stderr.write(`${JSON.stringify(safe)}\n`);
    process.exitCode = 1;
  });
}
