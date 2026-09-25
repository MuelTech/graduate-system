/**
 * WP6 — verify Journey fixtures through the accepted WP5 Journey service.
 * Usage: npx ts-node prisma/verify-journey-fixtures.ts
 */
import prisma from "../src/config/database";
import { StudentThesisJourneyService } from "../src/services/student-thesis-journey.service";
import { journeyFixtureMeta } from "./journey-fixtures";

async function main() {
  const svc = new StudentThesisJourneyService();
  const rows: string[] = [];
  let failures = 0;

  for (const meta of journeyFixtureMeta()) {
    const user = await prisma.user.findUnique({
      where: { email: meta.email },
    });
    if (!user) {
      console.error(`MISSING fixture user ${meta.email}`);
      failures++;
      continue;
    }
    try {
      const journey = await svc.getJourney(user.id);
      const stepLine = journey.steps
        .map((s) => `${s.key}=${s.state}`)
        .join(" ");
      const line = `${meta.key.padEnd(28)} currentStep=${String(journey.currentStep).padEnd(16)} ${stepLine}`;
      rows.push(line);
      console.log(line);

      if (meta.key === "FINAL_PASSED" && journey.currentStep !== null) {
        console.error(`  FAIL ${meta.key}: expected currentStep null`);
        failures++;
      }
    } catch (e) {
      console.error(`FAIL ${meta.key}:`, e);
      failures++;
    }
  }

  // STRIKE policy variants for STRIKE_READY / STRIKE_ELIGIBLE (runtime only).
  process.env.STRIKE_BEFORE_FINAL_REQUIRED = "true";
  try {
    for (const key of ["STRIKE_READY", "STRIKE_ELIGIBLE"] as const) {
      const meta = journeyFixtureMeta().find((m) => m.key === key)!;
      const user = await prisma.user.findUnique({
        where: { email: meta.email },
      });
      if (!user) continue;
      const journey = await svc.getJourney(user.id);
      const strike = journey.steps.find((s) => s.key === "STRIKE");
      const final = journey.steps.find((s) => s.key === "FINAL_DEFENSE");
      console.log(
        `POLICY_ON ${key.padEnd(14)} STRIKE=${strike?.state} FINAL=${final?.state} currentStep=${journey.currentStep}`,
      );
    }
  } finally {
    delete process.env.STRIKE_BEFORE_FINAL_REQUIRED;
  }

  if (failures > 0) {
    console.error(`Journey fixture verification FAILED (${failures})`);
    process.exit(1);
  }
  console.log("Journey fixture verification OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
