/**
 * WP6 — mutation → reseed → restored-state proof.
 * Mutates fixture-owned data only, reseeds, asserts canonical state returns.
 *
 * Usage: npx ts-node prisma/verify-journey-reset.ts
 */
import prisma from "../src/config/database";
import { StudentThesisJourneyService } from "../src/services/student-thesis-journey.service";
import {
  JOURNEY_FIXTURE_EXPECTATIONS,
  type JourneyFixtureKey,
} from "../src/services/journey-fixture-expectations";
import {
  journeyFixtureMeta,
  seedStudentThesisJourneyFixtures,
} from "./journey-fixtures";

const PASSWORD_HASH_PLACEHOLDER = "reset-check";

async function journeyOf(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const svc = new StudentThesisJourneyService();
  return svc.getJourney(user.id);
}

function assertState(
  label: string,
  key: JourneyFixtureKey,
  journey: Awaited<ReturnType<typeof journeyOf>>,
  failures: number,
): number {
  const expected = JOURNEY_FIXTURE_EXPECTATIONS[key];
  let f = failures;
  if (journey.currentStep !== expected.currentStep) {
    console.error(
      `  FAIL ${label}: currentStep expected=${expected.currentStep} actual=${journey.currentStep}`,
    );
    f++;
  }
  for (const [step, state] of Object.entries(expected.steps) as Array<
    [string, string]
  >) {
    const actual = journey.steps.find((s) => s.key === step)?.state;
    if (actual !== state) {
      console.error(
        `  FAIL ${label}.${step}: expected=${state} actual=${actual}`,
      );
      f++;
    }
  }
  return f;
}

async function main() {
  let failures = 0;
  const meta = journeyFixtureMeta();

  // ── A. PROPOSAL_READY gets an unwanted Proposal PASSED ──────────
  console.log("A) PROPOSAL_READY mutation → reseed");
  const proposalUser = await prisma.user.findUniqueOrThrow({
    where: { email: "journey-proposal-ready@earist.edu.ph" },
  });
  const proposalStudent = await prisma.student.findUniqueOrThrow({
    where: { userId: proposalUser.id },
  });
  const proposalThesis = await prisma.thesisRecord.findFirstOrThrow({
    where: { studentId: proposalStudent.id },
  });
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@earist.edu.ph" },
  });
  const junkSchedule = await prisma.defenseSchedule.create({
    data: {
      thesisId: proposalThesis.id,
      defenseDate: new Date(),
      defenseTime: new Date("1970-01-01T10:00:00.000Z"),
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "CONCLUDED",
      setById: admin.id,
    },
  });
  await prisma.defenseConclusion.create({
    data: {
      scheduleId: junkSchedule.id,
      thesisId: proposalThesis.id,
      outcome: "PASSED",
      concludedById: admin.id,
    },
  });
  let mutated = await journeyOf("journey-proposal-ready@earist.edu.ph");
  console.log(
    `  after mutation currentStep=${mutated.currentStep} proposal=${mutated.steps.find((s) => s.key === "PROPOSAL_DEFENSE")?.state}`,
  );

  // ── B. FINAL_READY gets an unwanted Final PASSED ────────────────
  console.log("B) FINAL_READY mutation → reseed");
  const finalUser = await prisma.user.findUniqueOrThrow({
    where: { email: "journey-final-ready@earist.edu.ph" },
  });
  const finalStudent = await prisma.student.findUniqueOrThrow({
    where: { userId: finalUser.id },
  });
  const finalThesis = await prisma.thesisRecord.findFirstOrThrow({
    where: { studentId: finalStudent.id },
  });
  const junkFinal = await prisma.defenseSchedule.create({
    data: {
      thesisId: finalThesis.id,
      defenseDate: new Date(),
      defenseTime: new Date("1970-01-01T10:00:00.000Z"),
      defenseType: "FINAL_DEFENSE",
      sessionStatus: "CONCLUDED",
      setById: admin.id,
    },
  });
  await prisma.defenseConclusion.create({
    data: {
      scheduleId: junkFinal.id,
      thesisId: finalThesis.id,
      outcome: "PASSED",
      concludedById: admin.id,
    },
  });
  mutated = await journeyOf("journey-final-ready@earist.edu.ph");
  console.log(
    `  after mutation currentStep=${mutated.currentStep} final=${mutated.steps.find((s) => s.key === "FINAL_DEFENSE")?.state}`,
  );

  // ── C. TITLE_READY gets a fixture-owned thesis graph ────────────
  console.log("C) TITLE_READY mutation → reseed");
  const titleUser = await prisma.user.findUniqueOrThrow({
    where: { email: "journey-title-ready@earist.edu.ph" },
  });
  const titleStudent = await prisma.student.findUniqueOrThrow({
    where: { userId: titleUser.id },
  });
  const junkThesis = await prisma.thesisRecord.create({
    data: { studentId: titleStudent.id, stage: "TITLE", status: "PENDING" },
  });
  await prisma.defenseSchedule.create({
    data: {
      thesisId: junkThesis.id,
      defenseDate: new Date(),
      defenseTime: new Date("1970-01-01T10:00:00.000Z"),
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "CONCLUDED",
      setById: admin.id,
    },
  });
  mutated = await journeyOf("journey-title-ready@earist.edu.ph");
  console.log(
    `  after mutation currentStep=${mutated.currentStep} title=${mutated.steps.find((s) => s.key === "TITLE_DEFENSE")?.state}`,
  );

  // ── D. ResearchVariableForm + ResearchVarSignature (RESTRICT) ───
  console.log("D) ResearchVariableForm + signature mutation → reseed");
  const varThesis = await prisma.thesisRecord.findFirstOrThrow({
    where: { studentId: proposalStudent.id },
  });
  const varForm = await prisma.researchVariableForm.create({
    data: {
      thesisId: varThesis.id,
      variableContent: "WP6 FK fixture variable",
      status: "PENDING",
    },
  });
  await prisma.researchVarSignature.create({
    data: {
      varFormId: varForm.id,
      userId: admin.id,
      isSigned: true,
      signedAt: new Date(),
    },
  });

  // ── E. ManuscriptSubmission + ManuscriptDistribution (RESTRICT) ─
  console.log("E) ManuscriptSubmission + distribution mutation → reseed");
  const msThesis = await prisma.thesisRecord.findFirstOrThrow({
    where: { studentId: finalStudent.id },
  });
  const submission = await prisma.manuscriptSubmission.create({
    data: {
      thesisId: msThesis.id,
      submissionDate: new Date(),
      numberOfCopies: 2,
    },
  });
  await prisma.manuscriptDistribution.create({
    data: {
      submissionId: submission.id,
      recipient: "ADVISER",
      recipientName: "WP6 FK Fixture",
    },
  });

  // ── F. ThesisRecord.assignmentId linked to active AdviserAssignment ─
  console.log("F) assignmentId link mutation → reseed");
  const approvedUser = await prisma.user.findUniqueOrThrow({
    where: { email: "journey-adviser-approved@earist.edu.ph" },
  });
  const approvedStudent = await prisma.student.findUniqueOrThrow({
    where: { userId: approvedUser.id },
  });
  const approvedAssignment = await prisma.adviserAssignment.findFirstOrThrow({
    where: { studentId: approvedStudent.id, isActive: true },
  });
  await prisma.thesisRecord.updateMany({
    where: { studentId: approvedStudent.id },
    data: { assignmentId: approvedAssignment.id },
  });

  // ── Reseed and assert restoration ───────────────────────────────
  console.log("\nReseeding journey fixtures...");
  const passwordHash =
    (await prisma.user.findFirst({ where: { email: "admin@earist.edu.ph" } }))
      ?.passwordHash ?? PASSWORD_HASH_PLACEHOLDER;
  await seedStudentThesisJourneyFixtures(prisma, passwordHash);

  for (const key of [
    "TITLE_READY",
    "PROPOSAL_READY",
    "FINAL_READY",
    "ADVISER_APPROVED",
  ] as JourneyFixtureKey[]) {
    const email = meta.find((m) => m.key === key)!.email;
    const journey = await journeyOf(email);
    console.log(
      `  restored ${key}: currentStep=${journey.currentStep}`,
    );
    failures = assertState(`restored ${key}`, key, journey, failures);
  }

  if (failures > 0) {
    console.error(`\nJourney reset verification FAILED (${failures})`);
    process.exit(1);
  }
  console.log("\nJourney reset verification OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
