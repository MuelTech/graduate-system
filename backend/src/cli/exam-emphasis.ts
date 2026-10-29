import "dotenv/config";
import fsp from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { preflightExamPackage } from "../services/exam-content-package.service";
import {
  OLSAT_MANIFEST_SHA256,
  parseEmphasisSidecar,
  reconcileEmphasis,
  type EmphasisTransaction,
} from "../services/exam-emphasis.service";

export async function runExamEmphasisCli(argv: readonly string[]) {
  if (argv.length > 1 || argv.some((a) => a !== "--apply" && a !== "--dry-run"))
    throw new Error("Invalid arguments.");
  const root = path.resolve(__dirname, "../../exam-content/olsat");
  const sidecarPath = path.resolve(root, "../olsat-emphasis.json");
  const stat = await fsp.lstat(sidecarPath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size <= 0 ||
    stat.size > 1024 * 1024 ||
    path.relative(sidecarPath, await fsp.realpath(sidecarPath)) !== ""
  )
    throw new Error("Invalid sidecar file.");
  const bytes = await fsp.readFile(sidecarPath);
  if (bytes.length !== stat.size)
    throw new Error("Sidecar changed during reading.");
  const source = await preflightExamPackage(root);
  const manifestHash = createHash("sha256")
    .update(await fsp.readFile(path.join(root, "manifest.json")))
    .digest("hex");
  if (manifestHash !== OLSAT_MANIFEST_SHA256)
    throw new Error("Manifest identity mismatch.");
  const sidecar = parseEmphasisSidecar(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    source,
    manifestHash,
  );
  const [{ default: prisma }, { Prisma }] = await Promise.all([
    import("../config/database"),
    import("@prisma/client"),
  ]);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const adapter: EmphasisTransaction = {
          examContentImport: {
            findUnique: (args) =>
              tx.examContentImport.findUnique(
                args as Parameters<typeof tx.examContentImport.findUnique>[0],
              ) as Promise<{
                fingerprint: string;
                questionCount: number;
              } | null>,
          },
          examQuestion: {
            findMany: (args) =>
              tx.examQuestion.findMany(
                args as Parameters<typeof tx.examQuestion.findMany>[0],
              ) as unknown as ReturnType<
                EmphasisTransaction["examQuestion"]["findMany"]
              >,
            update: (args) => {
              const input = args as {
                where: { id: string };
                data: { questionTextEmphasis: unknown };
              };
              return tx.examQuestion.update({
                where: input.where,
                data: {
                  questionTextEmphasis:
                    input.data.questionTextEmphasis === null
                      ? Prisma.DbNull
                      : (input.data
                          .questionTextEmphasis as import("@prisma/client").Prisma.InputJsonValue),
                },
              });
            },
          },
          examOption: {
            update: (args) => {
              const input = args as {
                where: { id: string };
                data: { optionTextEmphasis: unknown };
              };
              return tx.examOption.update({
                where: input.where,
                data: {
                  optionTextEmphasis:
                    input.data.optionTextEmphasis === null
                      ? Prisma.DbNull
                      : (input.data
                          .optionTextEmphasis as import("@prisma/client").Prisma.InputJsonValue),
                },
              });
            },
          },
        };
        return reconcileEmphasis(
          adapter,
          sidecar,
          source,
          argv.includes("--apply"),
        );
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 60000 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module)
  runExamEmphasisCli(process.argv.slice(2))
    .then((result) =>
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
    )
    .catch(() => {
      process.stderr.write(
        `${JSON.stringify({ code: "EMPHASIS_NOT_APPLIED", error: "Verified sidecar unavailable, invalid, or mismatched; operation did not report success. No source content was inferred." })}\n`,
      );
      process.exitCode = 1;
    });
