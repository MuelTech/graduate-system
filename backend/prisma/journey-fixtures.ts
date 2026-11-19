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
import { ensureSyntheticPdf } from "./seed-pdf-helper";

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
  { key: "TITLE_READY", email: "journey-title-ready@earist.edu.ph", first: "Rafael", last: "Santos", studentNumber: "2026-9001" },
  { key: "TITLE_PENDING", email: "journey-title-pending@earist.edu.ph", first: "Camille", last: "Reyes", studentNumber: "2026-9002" },
  { key: "TITLE_PASSED_NO_ADVISER", email: "journey-title-passed@earist.edu.ph", first: "Jerome", last: "Villanueva", studentNumber: "2026-9003" },
  { key: "ADVISER_PENDING", email: "journey-adviser-pending@earist.edu.ph", first: "Andrea", last: "Bautista", studentNumber: "2026-9004" },
  { key: "ADVISER_CONFORMED_WAITING_DEAN", email: "journey-adviser-dean@earist.edu.ph", first: "Marco", last: "Dela Rosa", studentNumber: "2026-9005" },
  { key: "ADVISER_APPROVED", email: "journey-adviser-approved@earist.edu.ph", first: "Patricia", last: "Mendoza", studentNumber: "2026-9006" },
  { key: "PROPOSAL_READY", email: "journey-proposal-ready@earist.edu.ph", first: "Daniel", last: "Ramos", studentNumber: "2026-9007" },
  { key: "PROPOSAL_PASSED", email: "journey-proposal-passed@earist.edu.ph", first: "Kristine", last: "Aquino", studentNumber: "2026-9008" },
  { key: "STRIKE_READY", email: "journey-strike-ready@earist.edu.ph", first: "Lorenzo", last: "Torres", studentNumber: "2026-9009" },
  { key: "STRIKE_ELIGIBLE", email: "journey-strike-eligible@earist.edu.ph", first: "Bianca", last: "Navarro", studentNumber: "2026-9010" },
  { key: "FINAL_READY", email: "journey-final-ready@earist.edu.ph", first: "Gabriel", last: "Pascual", studentNumber: "2026-9011" },
  { key: "FINAL_PASSED", email: "journey-final-passed@earist.edu.ph", first: "Clarissa", last: "Magbanua", studentNumber: "2026-9012" },
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
  program: { id: string; maxResidencyYears: number | null },
  meta: { email: string; first: string; last: string; studentNumber: string },
) {
  const enrollmentDate = new Date("2026-06-01T00:00:00.000Z");
  const user = await prisma.user.upsert({
    where: { email: meta.email },
    update: {
      firstName: meta.first,
      lastName: meta.last,
      role: "STUDENT",
      isActive: true,
    },
    create: {
      email: meta.email,
      passwordHash,
      firstName: meta.first,
      lastName: meta.last,
      role: "STUDENT",
      student: {
        create: {
          studentNumber: meta.studentNumber,
          programId: program.id,
          admissionStatus: "ENROLLED",
          enrollmentDate,
          residencyStartDate: enrollmentDate,
          curriculumType: "NEW",
        },
      },
    },
  });
  const student = await prisma.student.update({
    where: { userId: user.id },
    data: {
      programId: program.id,
      admissionStatus: "ENROLLED",
      enrollmentDate,
      residencyStartDate: enrollmentDate,
      curriculumType: "NEW",
    },
  });

  await prisma.residencyTracking.upsert({
    where: { studentId: student.id },
    update: {
      startDate: enrollmentDate,
      maxYears: program.maxResidencyYears ?? 4,
    },
    create: {
      studentId: student.id,
      startDate: enrollmentDate,
      maxYears: program.maxResidencyYears ?? 4,
    },
  });

  return { user, student };
}

async function ensureCompExam(prisma: Prisma, studentId: string) {
  const existing = await prisma.compExamRecord.findFirst({
    where: { studentId, status: "PASSED" },
  });
  if (!existing) {
    const agg = await prisma.compExamRecord.aggregate({
      where: { studentId },
      _max: { attemptNumber: true },
    });
    const attemptNumber = (agg._max.attemptNumber ?? 0) + 1;
    await prisma.compExamRecord.create({
      data: { studentId, attemptNumber, status: "PASSED" },
    });
  }
}

async function createThesis(
  prisma: Prisma,
  studentId: string,
  stage: "TITLE" | "PROPOSAL" | "FINAL",
  status: "PENDING" | "APPROVED",
  meta: {
    hasProposalStage: boolean;
    hasFinalStage: boolean;
  },
) {
  return prisma.thesisRecord.create({
    data: {
      studentId,
      stage,
      status,
      amountPaid: 900,
      orNumber: "OR-2026-9001",
      titleOrNumber: "OR-2026-9001",
      titleApplicationSubmittedAt: new Date("2026-06-25T09:00:00.000Z"),
      proposalOrNumber: meta.hasProposalStage ? "OR-2026-9002" : null,
      proposalApplicationSubmittedAt: meta.hasProposalStage
        ? new Date("2026-07-28T09:00:00.000Z")
        : null,
      finalOrNumber: meta.hasFinalStage ? "OR-2026-9003" : null,
      finalApplicationSubmittedAt: meta.hasFinalStage
        ? new Date("2026-08-22T09:00:00.000Z")
        : null,
    },
  });
}

async function attachSyntheticStageDocs(
  prisma: Prisma,
  opts: {
    thesisId: string;
    defenseStage: "TITLE" | "PROPOSAL" | "FINAL";
    studentName: string;
    studentNumber: string;
    programName: string;
    uploaderUserId: string;
    titleText: string;
  },
) {
  const slug = `${opts.studentNumber}-${opts.defenseStage.toLowerCase()}`;
  const mainDocType =
    opts.defenseStage === "TITLE"
      ? ("TITLE_PROPOSAL" as const)
      : opts.defenseStage === "PROPOSAL"
        ? ("PROPOSAL_CHAPTERS" as const)
        : ("FINAL_MANUSCRIPT" as const);

  const specs: Array<{
    docType: typeof mainDocType | "COR" | "RECEIPT";
    namespace: "evidence" | "manuscripts";
    filename: string;
    originalFilename: string;
    category: string;
    manuscriptTitle: string | null;
    orNumber?: string;
  }> = [
    {
      docType: mainDocType,
      namespace: opts.defenseStage === "TITLE" ? "evidence" : "manuscripts",
      filename: `seed-${slug}-${mainDocType.toLowerCase()}.pdf`,
      originalFilename: `${opts.studentNumber}_${opts.defenseStage}_Manuscript.pdf`,
      category:
        opts.defenseStage === "TITLE"
          ? "Title Proposal Package"
          : opts.defenseStage === "PROPOSAL"
            ? "Proposal Manuscript (Chapters 1-3)"
            : "Final Thesis / Dissertation Manuscript",
      manuscriptTitle: opts.defenseStage === "TITLE" ? null : opts.titleText,
    },
    {
      docType: "COR",
      namespace: "evidence",
      filename: `seed-${slug}-cor.pdf`,
      originalFilename: `${opts.studentNumber}_${opts.defenseStage}_COR.pdf`,
      category: `Certificate of Registration (${opts.defenseStage} Defense)`,
      manuscriptTitle: null,
    },
    {
      docType: "RECEIPT",
      namespace: "evidence",
      filename: `seed-${slug}-receipt.pdf`,
      originalFilename: `${opts.studentNumber}_${opts.defenseStage}_OR_Receipt.pdf`,
      category: `Official Defense Fee Receipt (${opts.defenseStage} Defense)`,
      manuscriptTitle: null,
      orNumber:
        opts.defenseStage === "TITLE"
          ? "OR-2026-9001"
          : opts.defenseStage === "PROPOSAL"
            ? "OR-2026-9002"
            : "OR-2026-9003",
    },
  ];

  for (const spec of specs) {
    const pdf = await ensureSyntheticPdf({
      namespace: spec.namespace,
      filename: spec.filename,
      originalFilename: spec.originalFilename,
      documentCategory: spec.category,
      subjectName: opts.studentName,
      identifierLabel: "Student Number",
      identifierValue: opts.studentNumber,
      programName: opts.programName,
      details: [
        { label: "Defense Stage", value: opts.defenseStage },
        ...(spec.manuscriptTitle
          ? [{ label: "Working Title", value: spec.manuscriptTitle }]
          : []),
        ...(spec.orNumber
          ? [
              { label: "Official Receipt No.", value: spec.orNumber },
              { label: "Amount Paid", value: "PHP 900.00" },
            ]
          : []),
      ],
    });
    await prisma.thesisDocument.create({
      data: {
        thesisId: opts.thesisId,
        docType: spec.docType,
        defenseStage: opts.defenseStage,
        manuscriptTitle: spec.manuscriptTitle,
        filePath: pdf.filePath,
        storageKey: pdf.storageKey,
        storageProvider: pdf.storageProvider,
        originalFilename: pdf.originalFilename,
        verifiedMimeType: pdf.verifiedMimeType,
        sizeBytes: pdf.sizeBytes,
        checksum: pdf.checksum,
        checksumAlgorithm: pdf.checksumAlgorithm,
        uploadedById: opts.uploaderUserId,
        isCurrent: true,
        uploadedAt: new Date(),
      },
    });
  }
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

async function createFinalizedRap(
  prisma: Prisma,
  opts: {
    thesisId: string;
    scheduleId: string;
    defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE";
    generatedById: string;
    selectedTitle?: string | null;
  },
) {
  return prisma.rapReport.create({
    data: {
      scheduleId: opts.scheduleId,
      thesisId: opts.thesisId,
      defenseType: opts.defenseType,
      status: "FINALIZED",
      selectedTitle: opts.selectedTitle ?? null,
      reportDate: new Date("2026-07-11T00:00:00.000Z"),
      generatedById: opts.generatedById,
      generatedAt: new Date("2026-07-11T12:00:00.000Z"),
      decisionsAndRecommendations: "WP6 fixture — required RAP finalized",
    },
  });
}

async function createTitlePassedDefense(
  prisma: Prisma,
  opts: {
    thesisId: string;
    adminId: string;
    chairmanUserId: string;
    panelistUserId: string;
    selectedTitleId: string;
    selectedTitleText?: string;
    /** Canonical Title completion also requires a finalized Title RAP. */
    finalizeRap?: boolean;
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

  if (opts.finalizeRap !== false) {
    await createFinalizedRap(prisma, {
      thesisId: opts.thesisId,
      scheduleId: schedule.id,
      defenseType: "TITLE_DEFENSE",
      generatedById: opts.adminId,
      selectedTitle: opts.selectedTitleText ?? null,
    });
  }

  return schedule.id;
}

async function createStagePassed(
  prisma: Prisma,
  opts: {
    thesisId: string;
    adminId: string;
    defenseType: "PROPOSAL_DEFENSE" | "FINAL_DEFENSE";
    /** Stage completion for Proposal also requires a finalized Proposal RAP. */
    finalizeRap?: boolean;
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
  if (opts.finalizeRap) {
    await createFinalizedRap(prisma, {
      thesisId: opts.thesisId,
      scheduleId: schedule.id,
      defenseType: opts.defenseType,
      generatedById: opts.adminId,
    });
  }
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
  studentName: string,
  studentNumber: string,
  programName: string,
) {
  const similarityPercentage = eligible ? 8 : 25;
  const pdf = await ensureSyntheticPdf({
    namespace: "root",
    filename: `seed-strike-${studentNumber}.pdf`,
    originalFilename: `${studentNumber}_STRIKE_Report.pdf`,
    documentCategory: "STRIKE Plagiarism Similarity Report",
    subjectName: studentName,
    identifierLabel: "Student Number",
    identifierValue: studentNumber,
    programName,
    details: [
      { label: "Similarity Index", value: `${similarityPercentage}%` },
      { label: "Eligibility Status", value: eligible ? "ELIGIBLE" : "REVISION REQUIRED" },
    ],
  });

  await prisma.plagiarismResult.create({
    data: {
      thesisId,
      filePath: pdf.filePath,
      // Fixture-only schema values — not Faculty STRIKE API semantics.
      similarityPercentage,
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
  const mastersPrograms = await prisma.program.findMany({
    where: { programType: "MASTERS", isActive: true },
    orderBy: { programName: "asc" },
  });
  const fallbackProgram = mastersPrograms[0] ?? (await prisma.program.findFirst());
  const admin = await prisma.user.findUnique({
    where: { email: "admin@earist.edu.ph" },
  });
  const chairman = await prisma.user.findUnique({
    where: { email: "panelist1@earist.edu.ph" },
  });
  const panelist = await prisma.user.findUnique({
    where: { email: "panelist2@earist.edu.ph" },
  });
  if (!fallbackProgram || !admin || !chairman || !panelist) {
    console.error(
      "Journey fixtures skipped: missing program/admin/panelist seed accounts.",
    );
    return [];
  }

  for (const uid of [chairman.id, panelist.id]) {
    await prisma.user.update({
      where: { id: uid },
      data: { role: "FACULTY", isActive: true },
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

  for (let idx = 0; idx < SCENARIOS.length; idx++) {
    const meta = SCENARIOS[idx];
    const program =
      mastersPrograms.length > 0
        ? mastersPrograms[idx % mastersPrograms.length]
        : fallbackProgram;
    const studentName = `${meta.first} ${meta.last}`;

    const { user, student } = await ensureJourneyStudent(
      prisma,
      passwordHash,
      { id: program.id, maxResidencyYears: program.maxResidencyYears },
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
        await createThesis(prisma, student.id, "TITLE", "PENDING", {
          hasProposalStage: false,
          hasFinalStage: false,
        })
      ).id;
      await attachSyntheticStageDocs(prisma, {
        thesisId,
        defenseStage: "TITLE",
        studentName,
        studentNumber: meta.studentNumber,
        programName: program.programName,
        uploaderUserId: user.id,
        titleText: DEFAULT_TITLE,
      });
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
          { hasProposalStage: needsProposal, hasFinalStage: needsFinal },
        )
      ).id;

      await attachSyntheticStageDocs(prisma, {
        thesisId,
        defenseStage: "TITLE",
        studentName,
        studentNumber: meta.studentNumber,
        programName: program.programName,
        uploaderUserId: user.id,
        titleText: DEFAULT_TITLE,
      });

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
        selectedTitleText: DEFAULT_TITLE,
        // Canonical Title completion requires finalized Title RAP.
        finalizeRap: true,
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
        await attachSyntheticStageDocs(prisma, {
          thesisId,
          defenseStage: "PROPOSAL",
          studentName,
          studentNumber: meta.studentNumber,
          programName: program.programName,
          uploaderUserId: user.id,
          titleText: DEFAULT_TITLE,
        });
        await createStagePassed(prisma, {
          thesisId,
          adminId: admin.id,
          defenseType: "PROPOSAL_DEFENSE",
          // Proposal stage completion for later fixtures includes Proposal RAP.
          finalizeRap: true,
        });
      }

      if (needsStrikeEligible) {
        await createStrikeResult(
          prisma,
          thesisId,
          true,
          studentName,
          meta.studentNumber,
          program.programName,
        );
      }

      if (needsFinal) {
        await attachSyntheticStageDocs(prisma, {
          thesisId,
          defenseStage: "FINAL",
          studentName,
          studentNumber: meta.studentNumber,
          programName: program.programName,
          uploaderUserId: user.id,
          titleText: DEFAULT_TITLE,
        });
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
    console.log(
      `  journey fixture ready: ${meta.email} (${meta.key} -> ${program.programCode ?? program.programName})`,
    );
  }

  console.log("Student Thesis Journey fixtures ready (reset + rebuild).");
  console.log("  Password: password123");
  console.log("  Accounts: journey-title-ready@ … journey-final-passed@earist.edu.ph");
  return handles;
}

export function journeyFixtureMeta() {
  return SCENARIOS.map((s) => ({ ...s }));
}
