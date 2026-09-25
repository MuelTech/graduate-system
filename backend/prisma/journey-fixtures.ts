/**
 * WP6 — deterministic, idempotent Student Thesis Journey fixtures.
 *
 * Each scenario has its own Student account. Formal DefenseConclusion is the
 * academic authority (never ThesisRecord.status alone).
 *
 * Login: password123 (same as existing seed convention).
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
  {
    key: "TITLE_READY",
    email: "journey-title-ready@earist.edu.ph",
    first: "Journey",
    last: "TitleReady",
    studentNumber: "2026-9001",
  },
  {
    key: "TITLE_PENDING",
    email: "journey-title-pending@earist.edu.ph",
    first: "Journey",
    last: "TitlePending",
    studentNumber: "2026-9002",
  },
  {
    key: "TITLE_PASSED_NO_ADVISER",
    email: "journey-title-passed@earist.edu.ph",
    first: "Journey",
    last: "TitlePassed",
    studentNumber: "2026-9003",
  },
  {
    key: "ADVISER_PENDING",
    email: "journey-adviser-pending@earist.edu.ph",
    first: "Journey",
    last: "AdviserPending",
    studentNumber: "2026-9004",
  },
  {
    key: "ADVISER_CONFORMED_WAITING_DEAN",
    email: "journey-adviser-dean@earist.edu.ph",
    first: "Journey",
    last: "AdviserDean",
    studentNumber: "2026-9005",
  },
  {
    key: "ADVISER_APPROVED",
    email: "journey-adviser-approved@earist.edu.ph",
    first: "Journey",
    last: "AdviserApproved",
    studentNumber: "2026-9006",
  },
  {
    key: "PROPOSAL_READY",
    email: "journey-proposal-ready@earist.edu.ph",
    first: "Journey",
    last: "ProposalReady",
    studentNumber: "2026-9007",
  },
  {
    key: "PROPOSAL_PASSED",
    email: "journey-proposal-passed@earist.edu.ph",
    first: "Journey",
    last: "ProposalPassed",
    studentNumber: "2026-9008",
  },
  {
    key: "STRIKE_READY",
    email: "journey-strike-ready@earist.edu.ph",
    first: "Journey",
    last: "StrikeReady",
    studentNumber: "2026-9009",
  },
  {
    key: "STRIKE_ELIGIBLE",
    email: "journey-strike-eligible@earist.edu.ph",
    first: "Journey",
    last: "StrikeEligible",
    studentNumber: "2026-9010",
  },
  {
    key: "FINAL_READY",
    email: "journey-final-ready@earist.edu.ph",
    first: "Journey",
    last: "FinalReady",
    studentNumber: "2026-9011",
  },
  {
    key: "FINAL_PASSED",
    email: "journey-final-passed@earist.edu.ph",
    first: "Journey",
    last: "FinalPassed",
    studentNumber: "2026-9012",
  },
];

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

async function ensureCompExam(
  prisma: Prisma,
  studentId: string,
  status: "PASSED" | "PENDING",
) {
  const existing = await prisma.compExamRecord.findFirst({
    where: { studentId, status },
  });
  if (!existing) {
    await prisma.compExamRecord.create({ data: { studentId, status } });
  }
}

async function ensureThesis(
  prisma: Prisma,
  studentId: string,
  stage: "TITLE" | "PROPOSAL" | "FINAL",
  status: "PENDING" | "APPROVED" | "REJECTED",
) {
  const existing = await prisma.thesisRecord.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await prisma.thesisRecord.update({
      where: { id: existing.id },
      data: { stage, status, outcome: null },
    });
    return existing.id;
  }
  const created = await prisma.thesisRecord.create({
    data: { studentId, stage, status },
  });
  return created.id;
}

async function ensureTitles(prisma: Prisma, thesisId: string, selectedText: string) {
  const texts = [
    selectedText,
    "Panel Scoring Reliability in Oral Defense Evaluation",
    "Stage-Aware Eligibility Gates for Thesis Defense Applications",
  ];
  const selected = await prisma.thesisTitle.findFirst({
    where: { thesisId, titleText: selectedText },
  });
  const selectedId =
    selected?.id ??
    (await prisma.thesisTitle.create({
      data: {
        thesisId,
        titleText: selectedText,
        isSelected: true,
      },
    })).id;

  for (const titleText of texts) {
    const row = await prisma.thesisTitle.findFirst({
      where: { thesisId, titleText },
    });
    if (!row) {
      await prisma.thesisTitle.create({
        data: {
          thesisId,
          titleText,
          isSelected: titleText === selectedText,
        },
      });
    } else if (titleText === selectedText && !row.isSelected) {
      await prisma.thesisTitle.update({
        where: { id: row.id },
        data: { isSelected: true },
      });
    }
  }
  return selectedId;
}

async function ensureTitlePassedDefense(
  prisma: Prisma,
  opts: {
    thesisId: string;
    adminId: string;
    chairmanUserId: string;
    panelistUserId: string;
  },
) {
  // Rebuild fixture-owned Title schedule + conclusion deterministically.
  await prisma.defenseConclusion.deleteMany({
    where: {
      thesisId: opts.thesisId,
      schedule: { defenseType: "TITLE_DEFENSE" },
    },
  });
  await prisma.oralExamScore.deleteMany({
    where: {
      schedule: { thesisId: opts.thesisId, defenseType: "TITLE_DEFENSE" },
    },
  });
  await prisma.panelAssignment.deleteMany({
    where: {
      schedule: { thesisId: opts.thesisId, defenseType: "TITLE_DEFENSE" },
    },
  });
  await prisma.defenseSchedule.deleteMany({
    where: { thesisId: opts.thesisId, defenseType: "TITLE_DEFENSE" },
  });

  const selectedTitle = await prisma.thesisTitle.findFirst({
    where: { thesisId: opts.thesisId, isSelected: true },
    orderBy: { createdAt: "asc" },
  });

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
      {
        scheduleId: schedule.id,
        userId: opts.chairmanUserId,
        role: "CHAIRMAN",
      },
      {
        scheduleId: schedule.id,
        userId: opts.panelistUserId,
        role: "PANELIST",
      },
    ],
    skipDuplicates: true,
  });

  const conclusion = await prisma.defenseConclusion.create({
    data: {
      scheduleId: schedule.id,
      thesisId: opts.thesisId,
      outcome: "PASSED",
      selectedTitleId: selectedTitle?.id ?? null,
      finalRemarks: "WP6 fixture — formal Title Defense PASSED",
      concludedById: opts.adminId,
      concludedAt: new Date("2026-07-10T12:00:00.000Z"),
    },
  });

  return { scheduleId: schedule.id, conclusionId: conclusion.id, selectedTitleId: selectedTitle?.id ?? null };
}

async function ensureStageConclusion(
  prisma: Prisma,
  opts: {
    thesisId: string;
    adminId: string;
    defenseType: "PROPOSAL_DEFENSE" | "FINAL_DEFENSE";
    outcome: "PASSED";
  },
) {
  await prisma.defenseConclusion.deleteMany({
    where: {
      thesisId: opts.thesisId,
      schedule: { defenseType: opts.defenseType },
    },
  });
  await prisma.panelAssignment.deleteMany({
    where: {
      schedule: { thesisId: opts.thesisId, defenseType: opts.defenseType },
    },
  });
  await prisma.defenseSchedule.deleteMany({
    where: { thesisId: opts.thesisId, defenseType: opts.defenseType },
  });

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
      outcome: opts.outcome,
      finalRemarks: `WP6 fixture — ${opts.defenseType} PASSED`,
      concludedById: opts.adminId,
      concludedAt: new Date("2026-08-10T12:00:00.000Z"),
    },
  });

  return schedule.id;
}

async function clearAdviserWorkflow(prisma: Prisma, studentId: string) {
  await prisma.adviserRequest.deleteMany({ where: { studentId } });
  await prisma.adviserAssignment.deleteMany({ where: { studentId } });
}

async function ensureAdviserRequest(
  prisma: Prisma,
  opts: {
    studentId: string;
    requestedAdviserId: string;
    sourceDefenseScheduleId: string;
    adviserStatus: "PENDING" | "CONFORMED" | "DECLINED";
    deanStatus: "PENDING" | "APPROVED" | "REJECTED";
    overallStatus: "PENDING" | "APPROVED" | "REJECTED";
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
        opts.deanStatus === "PENDING"
          ? null
          : new Date("2026-07-13T10:00:00.000Z"),
      deanRemarks: opts.deanStatus === "PENDING" ? null : "Fixture Dean remarks",
      approvedById:
        opts.overallStatus === "APPROVED" ? opts.deanUserId ?? null : null,
      requestDate: new Date("2026-07-11T00:00:00.000Z"),
    },
  });
}

async function ensureActiveAssignment(
  prisma: Prisma,
  studentId: string,
  adviserId: string,
) {
  const existing = await prisma.adviserAssignment.findFirst({
    where: { studentId, isActive: true },
  });
  if (existing) return existing;
  return prisma.adviserAssignment.create({
    data: {
      studentId,
      adviserId,
      assignedDate: new Date("2026-07-13T00:00:00.000Z"),
      isActive: true,
    },
  });
}

async function ensureStrikeResult(
  prisma: Prisma,
  thesisId: string,
  eligible: boolean,
) {
  await prisma.plagiarismResult.deleteMany({ where: { thesisId } });
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
 * Seed the 12 required Journey scenarios. Idempotent: re-running rebuilds only
 * fixture-owned child records for journey-* students.
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

  // Ensure ODP panelists are valid GS-020 adviser candidates.
  for (const uid of [chairman.id, panelist.id]) {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) continue;
    await prisma.user.update({
      where: { id: uid },
      data: { role: "PANELIST", isActive: true },
    });
    const profile = await prisma.panelist.findUnique({
      where: { userId: uid },
    });
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
    await ensureCompExam(prisma, student.id, "PASSED");

    let thesisId: string | null = null;

    const needsTitlePassed =
      meta.key !== "TITLE_READY" && meta.key !== "TITLE_PENDING";
    const needsAdviser = meta.key !== "TITLE_READY" && meta.key !== "TITLE_PENDING";
    const needsProposalPassed = [
      "PROPOSAL_PASSED",
      "STRIKE_READY",
      "STRIKE_ELIGIBLE",
      "FINAL_READY",
      "FINAL_PASSED",
    ].includes(meta.key);
    const needsFinalPassed = meta.key === "FINAL_PASSED";
    const needsStrikeEligible = ["STRIKE_ELIGIBLE", "FINAL_READY", "FINAL_PASSED"].includes(
      meta.key,
    );

    if (meta.key === "TITLE_READY") {
      // No application / no ThesisRecord — Title must be CURRENT (not WAITING).
      await clearAdviserWorkflow(prisma, student.id);
      const legacyTheses = await prisma.thesisRecord.findMany({
        where: { studentId: student.id },
      });
      for (const t of legacyTheses) {
        await prisma.defenseConclusion.deleteMany({ where: { thesisId: t.id } });
        await prisma.defenseSchedule.deleteMany({ where: { thesisId: t.id } });
        await prisma.thesisTitle.deleteMany({ where: { thesisId: t.id } });
        await prisma.plagiarismResult.deleteMany({ where: { thesisId: t.id } });
        await prisma.thesisDocument.deleteMany({ where: { thesisId: t.id } });
        await prisma.thesisRecord.delete({ where: { id: t.id } });
      }
    } else if (meta.key === "TITLE_PENDING") {
      thesisId = await ensureThesis(prisma, student.id, "TITLE", "PENDING");
      await clearAdviserWorkflow(prisma, student.id);
    } else {
      thesisId = await ensureThesis(
        prisma,
        student.id,
        needsFinalPassed ? "FINAL" : needsProposalPassed ? "PROPOSAL" : "TITLE",
        "APPROVED",
      );
      const selectedId = await ensureTitles(
        prisma,
        thesisId,
        DEFAULT_TITLE,
      );
      const title = await ensureTitlePassedDefense(prisma, {
        thesisId,
        adminId: admin.id,
        chairmanUserId: chairman.id,
        panelistUserId: panelist.id,
      });
      // Guarantee formal selected title is set on the conclusion.
      if (title.selectedTitleId !== selectedId && selectedId) {
        await prisma.defenseConclusion.update({
          where: { scheduleId: title.scheduleId },
          data: { selectedTitleId: selectedId },
        });
      }

      await clearAdviserWorkflow(prisma, student.id);

      switch (meta.key) {
        case "TITLE_PASSED_NO_ADVISER":
          break;
        case "ADVISER_PENDING":
          await ensureAdviserRequest(prisma, {
            studentId: student.id,
            requestedAdviserId: chairman.id,
            sourceDefenseScheduleId: title.scheduleId,
            adviserStatus: "PENDING",
            deanStatus: "PENDING",
            overallStatus: "PENDING",
          });
          break;
        case "ADVISER_CONFORMED_WAITING_DEAN":
          await ensureAdviserRequest(prisma, {
            studentId: student.id,
            requestedAdviserId: chairman.id,
            sourceDefenseScheduleId: title.scheduleId,
            adviserStatus: "CONFORMED",
            deanStatus: "PENDING",
            overallStatus: "PENDING",
          });
          break;
        case "ADVISER_APPROVED":
        case "PROPOSAL_READY":
        case "PROPOSAL_PASSED":
        case "STRIKE_READY":
        case "STRIKE_ELIGIBLE":
        case "FINAL_READY":
        case "FINAL_PASSED": {
          const request = await ensureAdviserRequest(prisma, {
            studentId: student.id,
            requestedAdviserId: chairman.id,
            sourceDefenseScheduleId: title.scheduleId,
            adviserStatus: "CONFORMED",
            deanStatus: "APPROVED",
            overallStatus: "APPROVED",
            deanUserId: admin.id,
          });
          await ensureActiveAssignment(prisma, student.id, request.requestedAdviserId);
          break;
        }
      }

      if (needsProposalPassed) {
        await ensureStageConclusion(prisma, {
          thesisId,
          adminId: admin.id,
          defenseType: "PROPOSAL_DEFENSE",
          outcome: "PASSED",
        });
      }

      if (meta.key === "STRIKE_READY") {
        await prisma.plagiarismResult.deleteMany({ where: { thesisId } });
      } else if (needsStrikeEligible) {
        await ensureStrikeResult(prisma, thesisId, true);
      } else {
        await prisma.plagiarismResult.deleteMany({ where: { thesisId } });
      }

      if (needsFinalPassed) {
        await ensureStageConclusion(prisma, {
          thesisId,
          adminId: admin.id,
          defenseType: "FINAL_DEFENSE",
          outcome: "PASSED",
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

  console.log("Student Thesis Journey fixtures ready.");
  console.log("  Password: password123");
  console.log("  Accounts: journey-title-ready@ … journey-final-passed@earist.edu.ph");
  return handles;
}

export function journeyFixtureMeta() {
  return SCENARIOS.map((s) => ({ ...s }));
}
