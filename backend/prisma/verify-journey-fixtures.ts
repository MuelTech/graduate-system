/**
 * WP6 — authoritative Journey fixture verification.
 * Asserts expected states via StudentThesisJourneyService (WP5).
 * Exits non-zero on any mismatch.
 *
 * Usage: npx ts-node prisma/verify-journey-fixtures.ts
 */
import prisma from "../src/config/database";
import { StudentThesisJourneyService } from "../src/services/student-thesis-journey.service";
import {
  JOURNEY_FIXTURE_EXPECTATIONS,
  JOURNEY_FIXTURE_KEYS,
  STRIKE_POLICY_ON_EXPECTATIONS,
  type JourneyFixtureKey,
  type StepKey,
  type StepState,
} from "../tests/fixtures/journey-fixture-expectations";
import { journeyFixtureMeta } from "./journey-fixtures";

const STEP_KEYS: StepKey[] = [
  "TITLE_DEFENSE",
  "ADVISER_REQUEST",
  "PROPOSAL_DEFENSE",
  "STRIKE",
  "FINAL_DEFENSE",
];

function checkStep(
  label: string,
  key: StepKey,
  expected: StepState,
  actual: StepState | undefined,
  failures: number,
): number {
  if (actual !== expected) {
    console.error(
      `  FAIL ${label}.${key}: expected=${expected} actual=${actual}`,
    );
    return failures + 1;
  }
  return failures;
}

async function verifyIntegrity(
  scenario: JourneyFixtureKey,
  userId: string,
  studentId: string,
  failures: number,
): Promise<number> {
  let f = failures;
  const users = await prisma.user.count({ where: { email: { startsWith: "journey-" }, id: userId } });
  if (users !== 1) {
    console.error(`  FAIL ${scenario}: fixture user count=${users}`);
    f++;
  }

  const theses = await prisma.thesisRecord.findMany({
    where: { studentId },
  });
  const needsThesis = scenario !== "TITLE_READY";
  if (needsThesis && theses.length !== 1) {
    console.error(`  FAIL ${scenario}: expected 1 ThesisRecord, got ${theses.length}`);
    f++;
  }
  if (!needsThesis && theses.length !== 0) {
    console.error(`  FAIL ${scenario}: expected 0 ThesisRecord, got ${theses.length}`);
    f++;
  }

  const thesis = theses[0] ?? null;

  if (thesis) {
    const titleConclusions = await prisma.defenseConclusion.findMany({
      where: {
        thesisId: thesis.id,
        schedule: { defenseType: "TITLE_DEFENSE" },
        outcome: "PASSED",
      },
      include: { selectedTitle: true },
    });
    const titlePassedExpected = scenario !== "TITLE_READY" && scenario !== "TITLE_PENDING";
    if (titlePassedExpected) {
      if (titleConclusions.length !== 1) {
        console.error(
          `  FAIL ${scenario}: expected 1 Title PASSED conclusion, got ${titleConclusions.length}`,
        );
        f++;
      } else {
        const c = titleConclusions[0];
        if (!c.selectedTitleId || c.selectedTitle?.thesisId !== thesis.id) {
          console.error(
            `  FAIL ${scenario}: selectedTitleId not on same ThesisRecord`,
          );
          f++;
        }
      }

      // Adviser request source schedule integrity
      const requests = await prisma.adviserRequest.findMany({
        where: { studentId },
      });
      for (const r of requests) {
        if (!r.sourceDefenseScheduleId) {
          console.error(`  FAIL ${scenario}: request missing sourceDefenseScheduleId`);
          f++;
          continue;
        }
        const schedule = await prisma.defenseSchedule.findUnique({
          where: { id: r.sourceDefenseScheduleId },
          include: { panelAssignments: true },
        });
        if (!schedule || schedule.thesisId !== thesis.id) {
          console.error(`  FAIL ${scenario}: source schedule not on fixture thesis`);
          f++;
          continue;
        }
        const seat = schedule.panelAssignments.find(
          (p) => p.userId === r.requestedAdviserId,
        );
        if (!seat || (seat.role !== "CHAIRMAN" && seat.role !== "PANELIST")) {
          console.error(
            `  FAIL ${scenario}: requested adviser not CHAIRMAN/PANELIST on source schedule`,
          );
          f++;
        }
      }

      const activeCount = await prisma.adviserAssignment.count({
        where: { studentId, isActive: true },
      });
      const expectsActive = [
        "ADVISER_APPROVED",
        "PROPOSAL_READY",
        "PROPOSAL_PASSED",
        "STRIKE_READY",
        "STRIKE_ELIGIBLE",
        "FINAL_READY",
        "FINAL_PASSED",
      ].includes(scenario);
      const expectsZero = [
        "ADVISER_PENDING",
        "ADVISER_CONFORMED_WAITING_DEAN",
        "TITLE_PASSED_NO_ADVISER",
      ].includes(scenario);
      if (expectsActive && activeCount !== 1) {
        console.error(
          `  FAIL ${scenario}: expected 1 active AdviserAssignment, got ${activeCount}`,
        );
        f++;
      }
      if (expectsZero && activeCount !== 0) {
        console.error(
          `  FAIL ${scenario}: expected 0 active AdviserAssignment, got ${activeCount}`,
        );
        f++;
      }

      const proposalPassedExpected = [
        "PROPOSAL_PASSED",
        "STRIKE_READY",
        "STRIKE_ELIGIBLE",
        "FINAL_READY",
        "FINAL_PASSED",
      ].includes(scenario);
      const proposalPassedCount = await prisma.defenseConclusion.count({
        where: {
          thesisId: thesis.id,
          schedule: { defenseType: "PROPOSAL_DEFENSE" },
          outcome: "PASSED",
        },
      });
      if (proposalPassedExpected && proposalPassedCount !== 1) {
        console.error(
          `  FAIL ${scenario}: expected 1 Proposal PASSED conclusion, got ${proposalPassedCount}`,
        );
        f++;
      }
      if (!proposalPassedExpected && proposalPassedCount !== 0) {
        console.error(
          `  FAIL ${scenario}: expected 0 Proposal PASSED conclusion, got ${proposalPassedCount}`,
        );
        f++;
      }

      const finalPassedCount = await prisma.defenseConclusion.count({
        where: {
          thesisId: thesis.id,
          schedule: { defenseType: "FINAL_DEFENSE" },
          outcome: "PASSED",
        },
      });
      const finalExpected = scenario === "FINAL_PASSED";
      if (finalExpected && finalPassedCount !== 1) {
        console.error(
          `  FAIL ${scenario}: expected 1 Final PASSED conclusion, got ${finalPassedCount}`,
        );
        f++;
      }
      if (!finalExpected && finalPassedCount !== 0) {
        console.error(
          `  FAIL ${scenario}: expected 0 Final PASSED conclusion, got ${finalPassedCount}`,
        );
        f++;
      }

      const eligibleCount = await prisma.plagiarismResult.count({
        where: { thesisId: thesis.id, isEligible: true },
      });
      if (scenario === "STRIKE_READY" && eligibleCount !== 0) {
        console.error(
          `  FAIL ${scenario}: expected 0 eligible PlagiarismResult, got ${eligibleCount}`,
        );
        f++;
      }
      if (scenario === "STRIKE_ELIGIBLE" && eligibleCount < 1) {
        console.error(
          `  FAIL ${scenario}: expected eligible PlagiarismResult, got ${eligibleCount}`,
        );
        f++;
      }
    }
  }

  return f;
}

async function main() {
  const svc = new StudentThesisJourneyService();
  let failures = 0;
  const metaByEmail = new Map(
    journeyFixtureMeta().map((m) => [m.email, m.key as JourneyFixtureKey]),
  );

  for (const key of JOURNEY_FIXTURE_KEYS) {
    const meta = journeyFixtureMeta().find((m) => m.key === key)!;
    const expected = JOURNEY_FIXTURE_EXPECTATIONS[key];
    const user = await prisma.user.findUnique({ where: { email: meta.email } });
    if (!user) {
      console.error(`FAIL ${key}: missing user ${meta.email}`);
      failures++;
      continue;
    }

    console.log(`\n${key} (${meta.email})`);
    const journey = await svc.getJourney(user.id);

    if (journey.currentStep !== expected.currentStep) {
      console.error(
        `  FAIL currentStep: expected=${expected.currentStep} actual=${journey.currentStep}`,
      );
      failures++;
    }

    for (const stepKey of STEP_KEYS) {
      const actual = journey.steps.find((s) => s.key === stepKey)?.state;
      failures = checkStep(
        key,
        stepKey,
        expected.steps[stepKey],
        actual,
        failures,
      );
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
    });
    if (!student) {
      console.error(`  FAIL ${key}: missing student profile`);
      failures++;
      continue;
    }
    failures = await verifyIntegrity(key, user.id, student.id, failures);
    void metaByEmail;
  }

  // Policy ON assertions (runtime only — do not persist).
  process.env.STRIKE_BEFORE_FINAL_REQUIRED = "true";
  try {
    for (const key of ["STRIKE_READY", "STRIKE_ELIGIBLE"] as const) {
      const meta = journeyFixtureMeta().find((m) => m.key === key)!;
      const user = await prisma.user.findUnique({ where: { email: meta.email } });
      if (!user) continue;
      const expected = STRIKE_POLICY_ON_EXPECTATIONS[key];
      const journey = await svc.getJourney(user.id);
      console.log(`\nPOLICY_ON ${key}`);
      if (journey.currentStep !== expected.currentStep) {
        console.error(
          `  FAIL policyOn currentStep: expected=${expected.currentStep} actual=${journey.currentStep}`,
        );
        failures++;
      }
      for (const [stepKey, state] of Object.entries(expected.steps) as Array<
        [StepKey, StepState]
      >) {
        const actual = journey.steps.find((s) => s.key === stepKey)?.state;
        failures = checkStep(
          `POLICY_ON.${key}`,
          stepKey,
          state,
          actual,
          failures,
        );
      }
    }
  } finally {
    delete process.env.STRIKE_BEFORE_FINAL_REQUIRED;
  }

  if (failures > 0) {
    console.error(`\nJourney fixture verification FAILED (${failures} mismatches)`);
    process.exit(1);
  }
  console.log("\nJourney fixture verification OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
