import "dotenv/config";
import path from "path";
import { readFile } from "fs/promises";
import { preflightExamPackage } from "../services/exam-content-package.service";
import { parseExamImportArgs } from "./exam-content-import";
import { verifyQ24Source } from "../services/exam-q24-correction.service";

export async function runQ24CorrectionCli(argv: readonly string[]) {
  const { apply } = parseExamImportArgs(argv);
  const root = path.resolve(__dirname, "../../exam-content/olsat");
  const source = await preflightExamPackage(root);
  verifyQ24Source(await readFile(path.join(root, "manifest.json")), source);
  const [{ ExamQ24CorrectionRepository }, { default: prisma }] =
    await Promise.all([
      import("../repositories/exam-q24-correction.repository"),
      import("../config/database"),
    ]);
  try {
    return await new ExamQ24CorrectionRepository().reconcile(source, apply);
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module)
  runQ24CorrectionCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch(() => {
      process.stderr.write(
        `${JSON.stringify({ code: "Q24_NOT_RECONCILED", error: "Q24 correction did not report success. Review source/import state; no partial repair or automatic retry was attempted." })}\n`,
      );
      process.exitCode = 1;
    });
