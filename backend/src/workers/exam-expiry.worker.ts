import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { ExamFinalizationRepository } from "../repositories/exam-finalization.repository";

/** Bounded examination task, deliberately separate from the email queue. */
export async function sweepExpiredExaminations() {
  const cutoff = new Date();
  const repo = new ExamFinalizationRepository();
  let after: string | undefined;
  let examined = 0, finalized = 0;
  // Page past failed records as well, so damaged evidence cannot starve others.
  while (true) {
    const candidates = await prisma.entranceExamApplication.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] }, finalizedAt: null,
        actualStartedAt: { not: null }, deadlineAt: { lte: cutoff },
        contentRevisionId: { not: null }, executionConfiguration: { not: Prisma.DbNull },
        ...(after ? { id: { gt: after } } : {}),
      },
      select: { id: true }, orderBy: { id: "asc" }, take: 100,
    });
    examined += candidates.length;
    for (const candidate of candidates) {
      try { if (await repo.expire(candidate.id)) finalized++; }
      catch (error) { console.error("[Exam expiry] Could not finalize application", candidate.id, error instanceof Error ? error.message : "Unknown failure"); }
    }
    if (candidates.length < 100) break;
    after = candidates[candidates.length - 1].id;
  }
  return { examined, finalized };
}

/** Immediate startup catch-up, then modest interval. DB locks own global safety. */
export function startExamExpiryWorker(
  sweep = sweepExpiredExaminations,
  intervalMs = 30_000,
) {
  let running = false, stopped = false;
  const run = async () => {
    if (running || stopped) return;
    running = true;
    try { await sweep(); }
    catch (error) { console.error("[Exam expiry] Sweep failed; a later interval will retry", error instanceof Error ? error.message : "Unknown failure"); }
    finally { running = false; }
  };
  void run();
  const interval = setInterval(() => { void run(); }, intervalMs);
  interval.unref();
  return { run, stop: () => { stopped = true; clearInterval(interval); } };
}
