/**
 * WP6 — deterministic, idempotent, RESETTABLE Student Thesis Journey fixtures.
 *
 * Each scenario has its own Student. Re-running seed restores the named state
 * even after manual QA mutated that fixture's workflow graph.
 *
 * Login: password123 (existing seed convention).
 * Emails: journey-<scenario>@earist.edu.ph
 */
import type { PrismaClient } from "@prisma/client";

type Prisma = PrismaClient;

const DEFAULT_TITLE = "Digital Inclusion Practices in Graduate Education";

export type JourneyScenarioKey =
  | "TITLE_READY"
  | "TITLE_PENDING"
  | "TITLE_PASSED_NO_ADVISER"
  | "ADVISER_PENDING"
  | "ADVISER_CONFORMED_WAITING_DEAN"
  | "ADVISER_APPROVED"
  | "PROPOSAL_READY"
  | "PROPOSAL_PASSED"
  | "STRIKE_READY"
  | "STRIKE_ELIGIBLE"
  | "FINAL_READY"
  | "FINAL_PASSED";

export interface JourneyFixtureHandle {
  scenario: JourneyScenarioKey;
  email: string;
  userId: string;
  studentId: string;
  thesisId: string | null;
}

const SCENARIOS: Array<{
  key: JourneyScenarioKey;
  email: string;
  first: string;
  last: string;
  studentNumber: string;
}> = [
  { key: "TITLE_READY", email: "journey-title-ready@earist.edu.ph", first: "Journey", last: "TitleReady", studentNumber: "2026-9001" },
  { key: "TITLE_PENDING", email: "journey-title-pending@earist.edu.ph", first: "Journey", last: "TitlePending", studentNumber: "2026-9002" },
  { key: "TITLE_PASSED_NO_ADVISER", email: "journey-title-passed@earist.edu.ph", first: "Journey", last: "TitlePassed", studentNumber: "2026-9003" },
  { key: "ADVISER_PENDING", email: "journey-adviser-pending@earist.edu.ph", first: "Journey", last: "AdviserPending", studentNumber: "2026-9004" },
  { key: "ADVISER_CONFORMED_WAITING_DEAN", email: "journey-adviser-dean@earist.edu.ph", first: "Journey", last: "AdviserDean", studentNumber: "2026-9005" },
  { key: "ADVISER_APPROVED", email: "journey-adviser-approved@earist.edu.ph", first: "Journey", last: "AdviserApproved", studentNumber: "2026-9006" },
  { key: "PROPOSAL_READY", email: "journey-proposal-ready@earist.edu.ph", first: "Journey", last: "ProposalReady", studentNumber: "2026-9007" },
  { key: "PROPOSAL_PASSED", email: "journey-proposal-passed@earist.edu.ph", first: "Journey", last: "ProposalPassed", studentNumber: "2026-9008" },
  { key: "STRIKE_READY", email: "journey-strike-ready@earist.edu.ph", first: "Journey", last: "StrikeReady", studentNumber: "2026-9009" },
  { key: "STRIKE_ELIGIBLE", email: "journey-strike-eligible@earist.edu.ph", first: "Journey", last: "StrikeEligible", studentNumber: "2026-9010" },
  { key: "FINAL_READY", email: "journey-final-ready@earist.edu.ph", first: "Journey", last: "FinalReady", studentNumber: "2026-9011" },
  { key: "FINAL_PASSED", email: "journey-final-passed@earist.edu.ph", first: "Journey", last: "FinalPassed", studentNumber: "2026-9012" },
];

/** Delete DefenseSchedule dependents in FK-safe order, then the schedules. */
async function clearDefenseSchedulesForThesis(prisma: Prisma, thesisId: string) {
  const schedules = await prisma.defenseSchedule.findMany({
    where: { thesisId },
    select: { id: true },
  });
  const scheduleIds = schedules.map((s) => s.id);
  if (scheduleIds.length === 0) return;

  // Null out GS-020 references first.
  await prisma.adviserRequest.updateMany({
    where: { sourceDefenseScheduleId: { in: scheduleIds } },
    data: { sourceDefenseScheduleId: null },
  });

  const rapReports = await prisma.rapReport.findMany({
    where: { scheduleId: { in: scheduleIds } },
    select: { id: true },
  });
  const rapIds = rapReports.map((r) => r.id);
  if (rapIds.length > 0) {
    await prisma.rapReportSignature.deleteMany({ where: { rapId: { in: rapIds } } });
    await prisma.rapReport.deleteMany({ where: { id: { in: rapIds } } });
  }

  await prisma.oralExamScore.deleteMany({
    where: { scheduleId: { in: scheduleIds } },
  });
  await prisma.oralExamSummary.deleteMany({
    where: { scheduleId: { in: scheduleIds } },
  });
  await prisma.acknowledgementReceipt.deleteMany({
    where: { scheduleId: { in: scheduleIds } },
  });
  await prisma.defenseConclusion.deleteMany({
    where: { scheduleId: { in: scheduleIds } },
  });
  await prisma.panelAssignment.deleteMany({
    where: { scheduleId: { in: scheduleIds } },
  });
  await prisma.defenseSchedule.deleteMany({
    where: { id: { in: scheduleIds } },
  });
}

/** Full fixture-owned ThesisRecord graph reset (FK-safe child-first order). */
async function clearThesisGraph(prisma: Prisma, thesisId: string) {
  await clearDefenseSchedulesForThesis(prisma, thesisId);

  // ResearchVariableForm children (RESTRICT): signatures first.
  const varForms = await prisma.researchVariableForm.findMany({
    where: { thesisId },
    select: { id: true },
  });
  const varFormIds = varForms.map((f) => f.id);
  if (varFormIds.length > 0) {
    await prisma.researchVarSignature.deleteMany({
      where: { varFormId: { in: varFormIds } },
    });
    await prisma.researchVariableForm.deleteMany({
      where: { id: { in: varFormIds } },
    });
  }

  // ManuscriptSubmission children (RESTRICT): distributions first.
  const submissions = await prisma.manuscriptSubmission.findMany({
    where: { thesisId },
    select: { id: true },
  });
  const submissionIds = submissions.map((s) => s.id);
  if (submissionIds.length > 0) {
    await prisma.manuscriptDistribution.deleteMany({
      where: { submissionId: { in: submissionIds } },
    });
    await prisma.manuscriptSubmission.deleteMany({
      where: { id: { in: submissionIds } },
    });
  }

  await prisma.plagiarismResult.deleteMany({ where: { thesisId } });
  await prisma.thesisTitle.deleteMany({ where: { thesisId } });
  await prisma.thesisDocument.deleteMany({ where: { thesisId } });
  await prisma.adviserCertification.deleteMany({ where: { thesisId } });
  await prisma.grammarianCertification.deleteMany({ where: { thesisId } });
  await prisma.statisticianCertification.deleteMany({ where: { thesisId } });
  await prisma.expertEvaluation.deleteMany({ where: { thesisId } });
  await prisma.expertEvaluationRequest.deleteMany({ where: { thesisId } });
  await prisma.eLibrary.deleteMany({ where: { thesisId } });
  await prisma.rapReport.deleteMany({ where: { thesisId } });
  await prisma.defenseConclusion.deleteMany({ where: { thesisId } });

  // ThesisRecord.assignmentId → AdviserAssignment is ON DELETE RESTRICT.
  await prisma.thesisRecord.updateMany({
    where: { id: thesisId },
    data: { assignmentId: null },
  });
  await prisma.thesisRecord.delete({ where: { id: thesisId } });
}

async function clearAdviserWorkflow(prisma: Prisma, studentId: string) {
  // Clear ThesisRecord.assignmentId refs before deleting assignments (RESTRICT).
  await prisma.thesisRecord.updateMany({
    where: { studentId, assignmentId: { not: null } },
    data: { assignmentId: null },
  });
  await prisma.adviserRequest.deleteMany({ where: { studentId } });
  await prisma.adviserAssignment.deleteMany({ where: { studentId } });
}

/** Reset only this journey fixture student's workflow data, then rebuild. */
export async function resetJourneyStudentGraph(
  prisma: Prisma,
  studentId: string,
) {
  await clearAdviserWorkflow(prisma, studentId);
  const theses = await prisma.thesisRecord.findMany({
    where: { studentId },
    select: { id: true },
  });
  for (const t of theses) {
    await clearThesisGraph(prisma, t.id);
  }
}

async function ensureJourneyStudent(
  prisma: Prisma,
  passwordHash: string,
  programId: string,
  meta: { email: string; first: string; last: string; studentNumber: string },
) {
  const user = await prisma.user.upsert({
    where: { email: meta.email },
    update: {},
    create: {
      email: meta.email,
      passwordHash,
      firstName: meta.first,
      lastName: meta.last,
      role: "STUDENT",
      student: {
        create: {
          studentNumber: meta.studentNumber,
          dateOfBirth: new Date("1996-02-02T00:00:00.000Z"),
          programId,
          admissionStatus: "ENROLLED",
          enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
          residencyStartDate: new Date("2026-06-01T00:00:00.000Z"),
          curriculumType: "NEW",
          alignmentStatus: "ALIGNED",
        },
      },
    },
  });
  const student = await prisma.student.findUniqueOrThrow({
    where: { userId: user.id },
  });
  return { user, student };
}

async function ensureCompExam(prisma: Prisma, studentId: string) {
  const existing = await prisma.compExamRecord.findFirst({
    where: { studentId, status: "PASSED" },
  });
  if (!existing) {
    await prisma.compExamRecord.create({
      data: { studentId, status: "PASSED" },
    });
  }
}

async function createThesis(
  prisma: Prisma,
  studentId: string,
  stage: "TITLE" | "PROPOSAL" | "FINAL",
  status: "PENDING" | "APPROVED",
) {
  return prisma.thesisRecord.create({
    data: { studentId, stage, status },
  });
}

async function ensureTitles(prisma: Prisma, thesisId: string, selectedText: string) {
  const texts = [
    selectedText,
    "Panel Scoring Reliability in Oral Defense Evaluation",
    "Stage-Aware Eligibility Gates for Thesis Defense Applications",
  ];
  for (const titleText of texts) {
    await prisma.thesisTitle.create({
      data: {
        thesisId,
        titleText,
        isSelected: titleText === selectedText,
      },
    });
  }
  const selected = await prisma.thesisTitle.findFirstOrThrow({
    where: { thesisId, titleText: selectedText },
  });
  return selected.id;
}

async function createTitlePassedDefense(
  prisma: Prisma,
  opts: {
    thesisId: string;
    adminId: string;
    chairmanUserId: string;
    panelistUserId: string;
    selectedTitleId: string;
  },
) {
  const schedule = await prisma.defenseSchedule.create({
    data: {
      thesisId: opts.thesisId,
      defenseDate: new Date("2026-07-10T00:00:00.000Z"),
      defenseTime: new Date("1970-01-01T09:00:00.000Z"),
      venueOrLink: "https://teams.microsoft.com/l/meetup-join/journey-title",
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "CONCLUDED",
      setById: opts.adminId,
    },
  });

  await prisma.panelAssignment.createMany({
    data: [
      { scheduleId: schedule.id, userId: opts.chairmanUserId, role: "CHAIRMAN" },
      { scheduleId: schedule.id, userId: opts.panelistUserId, role: "PANELIST" },
    ],
    skipDuplicates: true,
  });

  await prisma.defenseConclusion.create({
    data: {
      scheduleId: schedule.id,
      thesisId: opts.thesisId,
      outcome: "PASSED",
      selectedTitleId: opts.selectedTitleId,
      finalRemarks: "WP6 fixture — formal Title Defense PASSED",
      concludedById: opts.adminId,
      concludedAt: new Date("2026-07-10T12:00:00.000Z"),
    },
  });

  return schedule.id;
}

async function createStagePassed(
  prisma: Prisma,
  opts: {
    thesisId: string;
    adminId: string;
    defenseType: "PROPOSAL_DEFENSE" | "FINAL_DEFENSE";
  },
) {
  const schedule = await prisma.defenseSchedule.create({
    data: {
      thesisId: opts.thesisId,
      defenseDate: new Date("2026-08-10T00:00:00.000Z"),
      defenseTime: new Date("1970-01-01T09:00:00.000Z"),
      venueOrLink: "https://teams.microsoft.com/l/meetup-join/journey-stage",
      defenseType: opts.defenseType,
      sessionStatus: "CONCLUDED",
      setById: opts.adminId,
    },
  });
  await prisma.defenseConclusion.create({
    data: {
      scheduleId: schedule.id,
      thesisId: opts.thesisId,
      outcome: "PASSED",
      finalRemarks: `WP6 fixture — ${opts.defenseType} PASSED`,
      concludedById: opts.adminId,
      concludedAt: new Date("2026-08-10T12:00:00.000Z"),
    },
  });
  return schedule.id;
}

async function createAdviserRequest(
  prisma: Prisma,
  opts: {
    studentId: string;
    requestedAdviserId: string;
    sourceDefenseScheduleId: string;
    adviserStatus: "PENDING" | "CONFORMED";
    deanStatus: "PENDING" | "APPROVED";
    overallStatus: "PENDING" | "APPROVED";
    deanUserId?: string;
  },
) {
  return prisma.adviserRequest.create({
    data: {
      studentId: opts.studentId,
      requestedAdviserId: opts.requestedAdviserId,
      reason: "WP6 Journey fixture request",
      sourceDefenseScheduleId: opts.sourceDefenseScheduleId,
      status: opts.overallStatus,
      adviserStatus: opts.adviserStatus,
      adviserRespondedAt:
        opts.adviserStatus === "PENDING"
          ? null
          : new Date("2026-07-12T10:00:00.000Z"),
      adviserRemarks: opts.adviserStatus === "PENDING" ? null : "Fixture remarks",
      deanStatus: opts.deanStatus,
      deanReviewedById:
        opts.deanStatus === "PENDING" ? null : opts.deanUserId ?? null,
      deanReviewedAt:
        opts.deanStatus === "PENDING" ? null : new Date("2026-07-13T10:00:00.000Z"),
      deanRemarks: opts.deanStatus === "PENDING" ? null : "Fixture Dean remarks",
      approvedById:
        opts.overallStatus === "APPROVED" ? opts.deanUserId ?? null : null,
      requestDate: new Date("2026-07-11T00:00:00.000Z"),
    },
  });
}

async function createActiveAssignment(
  prisma: Prisma,
  studentId: string,
  adviserId: string,
) {
  return prisma.adviserAssignment.create({
    data: {
      studentId,
      adviserId,
      assignedDate: new Date("2026-07-13T00:00:00.000Z"),
      isActive: true,
    },
  });
}

async function createStrikeResult(
  prisma: Prisma,
  thesisId: string,
  eligible: boolean,
) {
  await prisma.plagiarismResult.create({
    data: {
      thesisId,
      filePath: `uploads/seed-strike-${thesisId}.pdf`,
      // Fixture-only schema values — not Faculty STRIKE API semantics.
      similarityPercentage: eligible ? 8 : 25,
      isEligible: eligible,
      submittedAt: new Date("2026-08-15T00:00:00.000Z"),
    },
  });
}

/**
 * Reset + rebuild the 12 Journey scenarios. Safe after manual QA mutations.
 */
export async function seedStudentThesisJourneyFixtures(
  prisma: Prisma,
  passwordHash: string,
): Promise<JourneyFixtureHandle[]> {
  const program =
    (await prisma.program.findFirst({ where: { programType: "MASTERS" } })) ??
    (await prisma.program.findFirst());
  const admin = await prisma.user.findUnique({
    where: { email: "admin@earist.edu.ph" },
  });
  const chairman = await prisma.user.findUnique({
    where: { email: "panelist1@earist.edu.ph" },
  });
  const panelist = await prisma.user.findUnique({
    where: { email: "panelist2@earist.edu.ph" },
  });
  if (!program || !admin || !chairman || !panelist) {
    console.error(
      "Journey fixtures skipped: missing program/admin/panelist seed accounts.",
    );
    return [];
  }

  for (const uid of [chairman.id, panelist.id]) {
    await prisma.user.update({
      where: { id: uid },
      data: { role: "PANELIST", isActive: true },
    });
    const profile = await prisma.panelist.findUnique({ where: { userId: uid } });
    if (!profile) {
      await prisma.panelist.create({
        data: {
          userId: uid,
          isActive: true,
          isAvailableAsAdviser: true,
          specialization: "Graduate Education",
          officeAffiliation: "Graduate School",
        },
      });
    } else {
      await prisma.panelist.update({
        where: { id: profile.id },
        data: { isActive: true, isAvailableAsAdviser: true },
      });
    }
  }

  const handles: JourneyFixtureHandle[] = [];

  for (const meta of SCENARIOS) {
    const { user, student } = await ensureJourneyStudent(
      prisma,
      passwordHash,
      program.id,
      meta,
    );

    // Always reset fixture-owned graph first so reseed restores the named state.
    await resetJourneyStudentGraph(prisma, student.id);
    await ensureCompExam(prisma, student.id);

    let thesisId: string | null = null;

    if (meta.key === "TITLE_READY") {
      // Absence is the fixture: no ThesisRecord at all.
    } else if (meta.key === "TITLE_PENDING") {
      thesisId = (
        await createThesis(prisma, student.id, "TITLE", "PENDING")
      ).id;
    } else {
      const needsProposal = [
        "PROPOSAL_PASSED",
        "STRIKE_READY",
        "STRIKE_ELIGIBLE",
        "FINAL_READY",
        "FINAL_PASSED",
      ].includes(meta.key);
      const needsFinal = meta.key === "FINAL_PASSED";
      const needsStrikeEligible = [
        "STRIKE_ELIGIBLE",
        "FINAL_READY",
        "FINAL_PASSED",
      ].includes(meta.key);

      thesisId = (
        await createThesis(
          prisma,
          student.id,
          needsFinal ? "FINAL" : needsProposal ? "PROPOSAL" : "TITLE",
          "APPROVED",
        )
      ).id;

      const selectedTitleId = await ensureTitles(
        prisma,
        thesisId,
        DEFAULT_TITLE,
      );
      const titleScheduleId = await createTitlePassedDefense(prisma, {
        thesisId,
        adminId: admin.id,
        chairmanUserId: chairman.id,
        panelistUserId: panelist.id,
        selectedTitleId,
      });

      switch (meta.key) {
        case "TITLE_PASSED_NO_ADVISER":
          break;
        case "ADVISER_PENDING":
          await createAdviserRequest(prisma, {
            studentId: student.id,
            requestedAdviserId: chairman.id,
            sourceDefenseScheduleId: titleScheduleId,
            adviserStatus: "PENDING",
            deanStatus: "PENDING",
            overallStatus: "PENDING",
          });
          break;
        case "ADVISER_CONFORMED_WAITING_DEAN":
          await createAdviserRequest(prisma, {
            studentId: student.id,
            requestedAdviserId: chairman.id,
            sourceDefenseScheduleId: titleScheduleId,
            adviserStatus: "CONFORMED",
            deanStatus: "PENDING",
            overallStatus: "PENDING",
          });
          break;
        default: {
          const request = await createAdviserRequest(prisma, {
            studentId: student.id,
            requestedAdviserId: chairman.id,
            sourceDefenseScheduleId: titleScheduleId,
            adviserStatus: "CONFORMED",
            deanStatus: "APPROVED",
            overallStatus: "APPROVED",
            deanUserId: admin.id,
          });
          await createActiveAssignment(
            prisma,
            student.id,
            request.requestedAdviserId,
          );
          break;
        }
      }

      if (needsProposal) {
        await createStagePassed(prisma, {
          thesisId,
          adminId: admin.id,
          defenseType: "PROPOSAL_DEFENSE",
        });
      }

      if (needsStrikeEligible) {
        await createStrikeResult(prisma, thesisId, true);
      }

      if (needsFinal) {
        await createStagePassed(prisma, {
          thesisId,
          adminId: admin.id,
          defenseType: "FINAL_DEFENSE",
        });
      }
    }

    handles.push({
      scenario: meta.key,
      email: meta.email,
      userId: user.id,
      studentId: student.id,
      thesisId,
    });
    console.log(`  journey fixture ready: ${meta.email} (${meta.key})`);
  }

  console.log("Student Thesis Journey fixtures ready (reset + rebuild).");
  console.log("  Password: password123");
  console.log("  Accounts: journey-title-ready@ … journey-final-passed@earist.edu.ph");
  return handles;
}

export function journeyFixtureMeta() {
  return SCENARIOS.map((s) => ({ ...s }));
}
