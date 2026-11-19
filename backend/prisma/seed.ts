import "dotenv/config";
import type { Program, ProgramType } from "@prisma/client";
import prisma from "../src/config/database";
import bcrypt from "bcryptjs";
import { reconcileAuthoritativeGraduatePrograms } from "../src/config/graduate-programs";
import {
  ensureSyntheticPdf,
  getSyntheticSignatureDataUrl,
} from "./seed-pdf-helper";

function futureUtcDate(daysFromToday: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysFromToday,
    ),
  );
}

function utcTime(hour: number, minute = 0): Date {
  return new Date(
    `1970-01-01T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
  );
}

function pickByCode(programs: Program[], code: string): Program {
  return (
    programs.find((p) => p.programCode === code) ??
    programs[0]
  );
}

async function main() {
  console.log("Seeding Graduate School programs...");

  const programSync = await reconcileAuthoritativeGraduatePrograms(prisma);
  console.log(
    `Reconciled 16 authoritative graduate programs (updated: ${programSync.updated}, created: ${programSync.created}).`,
  );

  // Clean up any leftover deprecated UIUX Fixture program so strictly 16 programs exist.
  await prisma.program.deleteMany({
    where: {
      OR: [
        { department: "UIUX Fixture" },
        { programName: "UIUX Fixture — Essay Grading Review" },
      ],
    },
  });

  const allPrograms = await prisma.program.findMany({
    where: { isActive: true },
    orderBy: [{ programType: "asc" }, { programName: "asc" }],
  });
  const mastersPrograms = allPrograms.filter(
    (p) => p.programType === ("MASTERS" as ProgramType),
  );
  const doctoralPrograms = allPrograms.filter(
    (p) => p.programType === ("DOCTORAL" as ProgramType),
  );

  if (mastersPrograms.length === 0 || doctoralPrograms.length === 0) {
    throw new Error("Authoritative Graduate School programs failed to seed.");
  }

  const mbaProgram = pickByCode(mastersPrograms, "MBA");
  const mpaProgram = pickByCode(mastersPrograms, "MPA");
  const maedAsProgram =
    mastersPrograms.find(
      (p) =>
        p.programCode === "MAEd" &&
        p.majorName === "Administration and Supervision",
    ) ?? mastersPrograms[0];
  const maedGcProgram =
    mastersPrograms.find(
      (p) =>
        p.programCode === "MAEd" &&
        p.majorName === "Guidance and Counseling",
    ) ?? mastersPrograms[1 % mastersPrograms.length];
  const maieHrmProgram = pickByCode(mastersPrograms, "MAIE");
  const maipProgram = pickByCode(mastersPrograms, "MAIP");
  const matMathProgram =
    mastersPrograms.find(
      (p) => p.programCode === "MAT" && p.majorName === "Mathematics",
    ) ?? mastersPrograms[0];
  const msmProgram = pickByCode(mastersPrograms, "MSM");

  const eddProgram = pickByCode(doctoralPrograms, "Ed.D.-EM");
  const phdIpProgram = pickByCode(doctoralPrograms, "PhD-IP");
  const dpaProgram = pickByCode(doctoralPrograms, "DPA");
  const dbaProgram = pickByCode(doctoralPrograms, "DBA");

  const passwordHash = await bcrypt.hash("password123", 12);
  const signatureData = getSyntheticSignatureDataUrl();
  const officialsUpdatedAt = new Date().toISOString();

  // ── 0. Institutional Officials System Setting ────────────────────────────
  await prisma.systemSetting.upsert({
    where: { settingKey: "institutional_officials" },
    update: {
      settingValue: JSON.stringify({
        dean: {
          name: "Dr. Eriberto R. Astorga, Jr.",
          signatureData,
          updatedAt: officialsUpdatedAt,
        },
        vpaa: {
          name: "Dr. Maria Lourdes P. Reyes",
          signatureData,
          updatedAt: officialsUpdatedAt,
        },
        president: {
          name: "Dr. Rogelio T. Mamaradlo",
          signatureData,
          updatedAt: officialsUpdatedAt,
        },
      }),
      settingType: "JSON",
      isEditableByAdmin: false,
    },
    create: {
      settingKey: "institutional_officials",
      settingValue: JSON.stringify({
        dean: {
          name: "Dr. Eriberto R. Astorga, Jr.",
          signatureData,
          updatedAt: officialsUpdatedAt,
        },
        vpaa: {
          name: "Dr. Maria Lourdes P. Reyes",
          signatureData,
          updatedAt: officialsUpdatedAt,
        },
        president: {
          name: "Dr. Rogelio T. Mamaradlo",
          signatureData,
          updatedAt: officialsUpdatedAt,
        },
      }),
      settingType: "JSON",
      label: "Institutional Officials",
      description:
        "Authorized Graduate School & University officials printed on official PDF forms.",
      isEditableByAdmin: false,
    },
  });
  console.log("Seeded Institutional Officials setting.");

  // ── 1. Administrators ────────────────────────────────────────────────────
  console.log("Seeding test users...");

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@earist.edu.ph" },
    update: {
      role: "ADMIN",
      adminAccessLevel: "FULL",
      adminCapabilities: [],
      isActive: true,
    },
    create: {
      email: "admin@earist.edu.ph",
      passwordHash,
      firstName: "Graduate School",
      lastName: "Administrator",
      role: "ADMIN",
      adminAccessLevel: "FULL",
      adminCapabilities: [],
    },
  });
  console.log("Ensured Full Admin account (admin@earist.edu.ph)");

  await prisma.user.upsert({
    where: { email: "staff.admin@earist.edu.ph" },
    update: {
      role: "ADMIN",
      adminAccessLevel: "RESTRICTED",
      adminCapabilities: [
        "applicants.manage",
        "students.manage",
        "exam.schedules.manage",
        "exam.records.manage",
        "cor.verify",
      ],
      isActive: true,
    },
    create: {
      email: "staff.admin@earist.edu.ph",
      passwordHash,
      title: "Ms.",
      firstName: "Clarisse",
      lastName: "Mendoza",
      role: "ADMIN",
      adminAccessLevel: "RESTRICTED",
      adminCapabilities: [
        "applicants.manage",
        "students.manage",
        "exam.schedules.manage",
        "exam.records.manage",
        "cor.verify",
      ],
    },
  });
  console.log("Ensured Restricted Admin account (staff.admin@earist.edu.ph)");

  // ── 2. Graduate School Faculty (panelist1@ .. panelist10@) ───────────────
  const facultySpecs: Array<{
    email: string;
    title: string;
    firstName: string;
    lastName: string;
    isExternal: boolean;
    isAvailableAsAdviser: boolean;
    canEvaluateEssays: boolean;
    officeAffiliation: string;
    specialization: string;
  }> = [
    {
      email: "panelist1@earist.edu.ph",
      title: "Dr.",
      firstName: "Mateo",
      lastName: "Soriano",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: true,
      officeAffiliation: "Graduate School",
      specialization: "Educational Management",
    },
    {
      email: "panelist2@earist.edu.ph",
      title: "Dr.",
      firstName: "William",
      lastName: "Marcial",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: false,
      officeAffiliation: "Graduate School",
      specialization: "Business Administration",
    },
    {
      email: "panelist3@earist.edu.ph",
      title: "Prof.",
      firstName: "Hanna Mae",
      lastName: "Perdido",
      isExternal: true,
      isAvailableAsAdviser: false,
      canEvaluateEssays: false,
      officeAffiliation: "External / Partner Institution",
      specialization: "Public Administration",
    },
    {
      email: "panelist4@earist.edu.ph",
      title: "Dr.",
      firstName: "Ana",
      lastName: "Reyes",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: true,
      officeAffiliation: "Graduate School",
      specialization: "Industrial Psychology",
    },
    {
      email: "panelist5@earist.edu.ph",
      title: "Dr.",
      firstName: "Benjamin",
      lastName: "Santos",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: false,
      officeAffiliation: "Graduate School",
      specialization: "Mathematics Education",
    },
    {
      email: "panelist6@earist.edu.ph",
      title: "Prof.",
      firstName: "Cara",
      lastName: "Lim",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: false,
      officeAffiliation: "Graduate School",
      specialization: "Guidance and Counseling",
    },
    {
      email: "panelist7@earist.edu.ph",
      title: "Prof.",
      firstName: "Danilo",
      lastName: "Cruz",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: false,
      officeAffiliation: "Graduate School",
      specialization: "Science Education",
    },
    {
      email: "panelist8@earist.edu.ph",
      title: "Dr.",
      firstName: "Elise",
      lastName: "Torres",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: true,
      officeAffiliation: "Graduate School",
      specialization: "Special Education",
    },
    {
      email: "panelist9@earist.edu.ph",
      title: "Dr.",
      firstName: "Fernando",
      lastName: "Navarro",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: false,
      officeAffiliation: "Graduate School",
      specialization: "Electronics Technology",
    },
    {
      email: "panelist10@earist.edu.ph",
      title: "Prof.",
      firstName: "Gwendolyn",
      lastName: "Uy",
      isExternal: false,
      isAvailableAsAdviser: true,
      canEvaluateEssays: false,
      officeAffiliation: "Graduate School",
      specialization: "Hotel and Restaurant Management",
    },
  ];

  const panelistUsers: Record<string, string> = {};
  for (const f of facultySpecs) {
    const user = await prisma.user.upsert({
      where: { email: f.email },
      update: {
        role: "FACULTY",
        title: f.title,
        firstName: f.firstName,
        lastName: f.lastName,
        isActive: true,
        panelist: {
          upsert: {
            create: {
              isExternal: f.isExternal,
              isAvailableAsAdviser: f.isAvailableAsAdviser,
              canEvaluateEssays: f.canEvaluateEssays,
              highestEducationalAttainment: "Doctorate Degree",
              officeAffiliation: f.officeAffiliation,
              specialization: f.specialization,
              isActive: true,
            },
            update: {
              isExternal: f.isExternal,
              isAvailableAsAdviser: f.isAvailableAsAdviser,
              canEvaluateEssays: f.canEvaluateEssays,
              highestEducationalAttainment: "Doctorate Degree",
              officeAffiliation: f.officeAffiliation,
              specialization: f.specialization,
              isActive: true,
            },
          },
        },
      },
      create: {
        email: f.email,
        passwordHash,
        title: f.title,
        firstName: f.firstName,
        lastName: f.lastName,
        role: "FACULTY",
        panelist: {
          create: {
            isExternal: f.isExternal,
            isAvailableAsAdviser: f.isAvailableAsAdviser,
            canEvaluateEssays: f.canEvaluateEssays,
            highestEducationalAttainment: "Doctorate Degree",
            officeAffiliation: f.officeAffiliation,
            specialization: f.specialization,
            isActive: true,
          },
        },
      },
    });
    panelistUsers[f.email] = user.id;
  }
  console.log("Ensured 10 Graduate School Faculty accounts (panelist1..10@).");

  const panelUser1 = await prisma.user.findUniqueOrThrow({
    where: { email: "panelist1@earist.edu.ph" },
  });
  const panelUser2 = await prisma.user.findUniqueOrThrow({
    where: { email: "panelist2@earist.edu.ph" },
  });
  const panelUser3 = await prisma.user.findUniqueOrThrow({
    where: { email: "panelist3@earist.edu.ph" },
  });

  // Ensure panelist1@ has a saved profile signature vault entry for manual QA.
  await prisma.userSignature.upsert({
    where: { userId: panelUser1.id },
    update: { signatureData, method: "DRAW" },
    create: { userId: panelUser1.id, signatureData, method: "DRAW" },
  });

  // ── 3. Core Enrolled Students (Distributed Across Master's & Doctoral) ──
  async function upsertEnrolledStudentAccount(opts: {
    email: string;
    firstName: string;
    lastName: string;
    studentNumber: string;
    cellphone?: string;
    program: Program;
    admissionStatus?: "ENROLLED" | "DISMISSED";
    curriculumType?: "OLD" | "NEW";
    enrollmentDate?: Date;
  }) {
    const enrollDate = opts.enrollmentDate ?? new Date("2026-06-01T00:00:00.000Z");
    const status = opts.admissionStatus ?? "ENROLLED";
    const curriculum = opts.curriculumType ?? "NEW";

    const user = await prisma.user.upsert({
      where: { email: opts.email },
      update: {
        firstName: opts.firstName,
        lastName: opts.lastName,
        role: "STUDENT",
        isActive: status !== "DISMISSED",
      },
      create: {
        email: opts.email,
        passwordHash,
        firstName: opts.firstName,
        lastName: opts.lastName,
        role: "STUDENT",
        isActive: status !== "DISMISSED",
        student: {
          create: {
            studentNumber: opts.studentNumber,
            cellphone: opts.cellphone ?? "+639175550101",
            programId: opts.program.id,
            admissionStatus: status,
            enrollmentDate: enrollDate,
            residencyStartDate: enrollDate,
            curriculumType: curriculum,
          },
        },
      },
    });

    const student = await prisma.student.update({
      where: { userId: user.id },
      data: {
        programId: opts.program.id,
        admissionStatus: status,
        enrollmentDate: enrollDate,
        residencyStartDate: enrollDate,
        curriculumType: curriculum,
      },
    });

    const maxYears =
      opts.program.maxResidencyYears ??
      (opts.program.programType === "DOCTORAL" ? 6 : 4);
    await prisma.residencyTracking.upsert({
      where: { studentId: student.id },
      update: { startDate: enrollDate, maxYears },
      create: { studentId: student.id, startDate: enrollDate, maxYears },
    });

    return { user, student };
  }

  // Student 1 — Jane Smith (MBA, Proposal stage with scheduled upcoming defense)
  const s1 = await upsertEnrolledStudentAccount({
    email: "student@earist.edu.ph",
    firstName: "Jane",
    lastName: "Smith",
    studentNumber: "2026-0001",
    cellphone: "+639171110001",
    program: mbaProgram,
  });

  if (
    !(await prisma.compExamRecord.findFirst({
      where: { studentId: s1.student.id, status: "PASSED" },
    }))
  ) {
    await prisma.compExamRecord.create({
      data: { studentId: s1.student.id, status: "PASSED" },
    });
  }

  const s1AdviserAssign =
    (await prisma.adviserAssignment.findFirst({
      where: {
        studentId: s1.student.id,
        adviserId: panelUser1.id,
        isActive: true,
      },
    })) ??
    (await prisma.adviserAssignment.create({
      data: {
        studentId: s1.student.id,
        adviserId: panelUser1.id,
        assignedDate: new Date("2026-06-15T00:00:00.000Z"),
        isActive: true,
      },
    }));

  const s1TitleText =
    "AI-Assisted Academic Advisement Practices in Graduate Education";

  let lobbyThesis = await prisma.thesisRecord.findFirst({
    where: { studentId: s1.student.id },
  });
  if (!lobbyThesis) {
    lobbyThesis = await prisma.thesisRecord.create({
      data: {
        studentId: s1.student.id,
        assignmentId: s1AdviserAssign.id,
        stage: "PROPOSAL",
        status: "SCHEDULED",
        orNumber: "OR-2026-0001P",
        amountPaid: 900,
        titleOrNumber: "OR-2026-0001T",
        proposalOrNumber: "OR-2026-0001P",
        titleApplicationSubmittedAt: new Date("2026-06-20T09:00:00.000Z"),
        proposalApplicationSubmittedAt: new Date("2026-08-01T09:00:00.000Z"),
      },
    });
  } else {
    lobbyThesis = await prisma.thesisRecord.update({
      where: { id: lobbyThesis.id },
      data: {
        assignmentId: s1AdviserAssign.id,
        stage: "PROPOSAL",
        status: "SCHEDULED",
        amountPaid: 900,
        titleOrNumber: "OR-2026-0001T",
        proposalOrNumber: "OR-2026-0001P",
      },
    });
  }

  // Student 2 — Juan Dela Cruz (MPA, comp exam 1 failed strike)
  const s2 = await upsertEnrolledStudentAccount({
    email: "student2@earist.edu.ph",
    firstName: "Juan",
    lastName: "Dela Cruz",
    studentNumber: "2026-0002",
    cellphone: "+639171110002",
    program: mpaProgram,
    curriculumType: "OLD",
  });
  if (
    !(await prisma.compExamRecord.findFirst({
      where: { studentId: s2.student.id, status: "FAILED" },
    }))
  ) {
    await prisma.compExamRecord.create({
      data: { studentId: s2.student.id, status: "FAILED" },
    });
  }

  // Student 3 — Maria Santos (MAEd-AS, coursework ongoing)
  await upsertEnrolledStudentAccount({
    email: "student3@earist.edu.ph",
    firstName: "Maria",
    lastName: "Santos",
    studentNumber: "2026-0003",
    cellphone: "+639171110003",
    program: maedAsProgram,
    enrollmentDate: new Date("2026-06-15T00:00:00.000Z"),
  });

  // Student 4 — Pedro Reyes (Dismissed after 2 strikes)
  const s4 = await upsertEnrolledStudentAccount({
    email: "student4@earist.edu.ph",
    firstName: "Pedro",
    lastName: "Reyes",
    studentNumber: "2026-0004",
    cellphone: "+639171110004",
    program: mbaProgram,
    admissionStatus: "DISMISSED",
  });
  let s4FailedCount = await prisma.compExamRecord.count({
    where: { studentId: s4.student.id, status: "FAILED" },
  });
  while (s4FailedCount < 2) {
    await prisma.compExamRecord.create({
      data: { studentId: s4.student.id, status: "FAILED" },
    });
    s4FailedCount += 1;
  }

  // Doctoral Enrolled Students across remaining Doctoral offerings (Ed.D.-EM, PhD-IP, DPA)
  const doctoralScheduledAccount = await upsertEnrolledStudentAccount({
    email: "doctoral-scheduled@earist.edu.ph",
    firstName: "Maricel",
    lastName: "Valdez",
    studentNumber: "2026-2001",
    cellphone: "+639172000001",
    program: eddProgram,
  });
  if (
    !(await prisma.compExamRecord.findFirst({
      where: { studentId: doctoralScheduledAccount.student.id, status: "PASSED" },
    }))
  ) {
    await prisma.compExamRecord.create({
      data: { studentId: doctoralScheduledAccount.student.id, status: "PASSED" },
    });
  }

  const d3 = await upsertEnrolledStudentAccount({
    email: "doctoral-phd-ip@earist.edu.ph",
    firstName: "Arthur",
    lastName: "Magsaysay",
    studentNumber: "2026-2002",
    cellphone: "+639172000002",
    program: phdIpProgram,
  });
  if (
    !(await prisma.compExamRecord.findFirst({
      where: { studentId: d3.student.id, status: "PASSED" },
    }))
  ) {
    await prisma.compExamRecord.create({
      data: { studentId: d3.student.id, status: "PASSED" },
    });
  }

  const d4 = await upsertEnrolledStudentAccount({
    email: "doctoral-dpa@earist.edu.ph",
    firstName: "Evelyn",
    lastName: "Soriano",
    studentNumber: "2026-2003",
    cellphone: "+639172000003",
    program: dpaProgram,
  });
  if (
    !(await prisma.compExamRecord.findFirst({
      where: { studentId: d4.student.id, status: "PASSED" },
    }))
  ) {
    await prisma.compExamRecord.create({
      data: { studentId: d4.student.id, status: "PASSED" },
    });
  }
  console.log("Seeded core Master's and Doctoral Student accounts.");

  // ── 4. Applicants (Clean 2-stage EXAM -> COR Flow Across 16 Programs) ────
  const applicantSpecs: Array<{
    email: string;
    firstName: string;
    lastName: string;
    cellphone: string;
    pinnacleId: string;
    program: Program;
  }> = [
    {
      email: "applicant1@earist.edu.ph",
      firstName: "Juan",
      lastName: "Dela Cruz",
      cellphone: "+639171234561",
      pinnacleId: "PIN-2026-001",
      program: mbaProgram,
    },
    {
      email: "applicant2@earist.edu.ph",
      firstName: "Maria",
      lastName: "Santos",
      cellphone: "+639181234562",
      pinnacleId: "PIN-2026-002",
      program: maedAsProgram,
    },
    {
      email: "applicant3@earist.edu.ph",
      firstName: "Pedro",
      lastName: "Reyes",
      cellphone: "+639191234563",
      pinnacleId: "PIN-2026-003",
      program: mbaProgram,
    },
    {
      email: "applicant4@earist.edu.ph",
      firstName: "Ana",
      lastName: "Garcia",
      cellphone: "+639201234564",
      pinnacleId: "PIN-2026-004",
      program: dbaProgram,
    },
    {
      email: "applicant5@earist.edu.ph",
      firstName: "Carlos",
      lastName: "Mendoza",
      cellphone: "+639171000005",
      pinnacleId: "PIN-2026-005",
      program: mpaProgram,
    },
    {
      email: "applicant6@earist.edu.ph",
      firstName: "Rosa",
      lastName: "Lim",
      cellphone: "+639171000006",
      pinnacleId: "PIN-2026-006",
      program: maedGcProgram,
    },
    {
      email: "applicant7@earist.edu.ph",
      firstName: "Miguel",
      lastName: "Torres",
      cellphone: "+639171000007",
      pinnacleId: "PIN-2026-007",
      program: mpaProgram,
    },
    {
      email: "applicant8@earist.edu.ph",
      firstName: "Elena",
      lastName: "Cruz",
      cellphone: "+639171000008",
      pinnacleId: "PIN-2026-008",
      program: eddProgram,
    },
    {
      email: "applicant9@earist.edu.ph",
      firstName: "Ricardo",
      lastName: "Villanueva",
      cellphone: "+639171000009",
      pinnacleId: "PIN-2026-009",
      program: maipProgram,
    },
    {
      email: "applicant10@earist.edu.ph",
      firstName: "Sofia",
      lastName: "Aquino",
      cellphone: "+639171000010",
      pinnacleId: "PIN-2026-010",
      program: matMathProgram,
    },
    {
      email: "applicant11@earist.edu.ph",
      firstName: "Andres",
      lastName: "Ramos",
      cellphone: "+639171000011",
      pinnacleId: "PIN-2026-011",
      program: msmProgram,
    },
    {
      email: "applicant12@earist.edu.ph",
      firstName: "Isabel",
      lastName: "Fernandez",
      cellphone: "+639171000012",
      pinnacleId: "PIN-2026-012",
      program: maieHrmProgram,
    },
  ];

  const seededApplicants = new Map<
    string,
    { userId: string; studentId: string; name: string; pinnacleId: string; program: Program }
  >();

  for (const app of applicantSpecs) {
    const user = await prisma.user.upsert({
      where: { email: app.email },
      update: {
        firstName: app.firstName,
        lastName: app.lastName,
        role: "APPLICANT",
        isActive: true,
      },
      create: {
        email: app.email,
        passwordHash,
        firstName: app.firstName,
        lastName: app.lastName,
        role: "APPLICANT",
        student: {
          create: {
            cellphone: app.cellphone,
            pinnacleApplicantId: app.pinnacleId,
            programId: app.program.id,
            admissionStatus: "APPLICANT",
          },
        },
      },
    });
    const student = await prisma.student.update({
      where: { userId: user.id },
      data: {
        cellphone: app.cellphone,
        pinnacleApplicantId: app.pinnacleId,
        programId: app.program.id,
        admissionStatus: "APPLICANT",
      },
    });
    seededApplicants.set(app.email, {
      userId: user.id,
      studentId: student.id,
      name: `${app.firstName} ${app.lastName}`,
      pinnacleId: app.pinnacleId,
      program: app.program,
    });
  }
  console.log("Seeded 12 Applicant accounts across Graduate School programs.");

  // ── 5. Exam Slots (Future Active Slots + Completed Slots) ───────────────
  console.log("Seeding exam slots...");
  const slotConfigs = [
    { key: "MBA_FUTURE_1", programId: mbaProgram.id, date: futureUtcDate(2), time: utcTime(9), maxSlots: 25 },
    { key: "MPA_FUTURE_1", programId: mpaProgram.id, date: futureUtcDate(3), time: utcTime(14), maxSlots: 25 },
    { key: "MAED_FUTURE_1", programId: maedGcProgram.id, date: futureUtcDate(5), time: utcTime(9), maxSlots: 25 },
    { key: "MAT_FUTURE_1", programId: matMathProgram.id, date: futureUtcDate(6), time: utcTime(13), maxSlots: 20 },
    { key: "EDD_FUTURE_1", programId: eddProgram.id, date: futureUtcDate(6), time: utcTime(9), maxSlots: 20 },
    { key: "DBA_FUTURE_1", programId: dbaProgram.id, date: futureUtcDate(8), time: utcTime(10), maxSlots: 20 },
    // Historical slot anchor for completed / missed applicant rows
    { key: "PAST_MBA", programId: mbaProgram.id, date: futureUtcDate(-5), time: utcTime(9), maxSlots: 30 },
    { key: "PAST_MPA", programId: mpaProgram.id, date: futureUtcDate(-5), time: utcTime(14), maxSlots: 30 },
    { key: "PAST_MAED", programId: maedAsProgram.id, date: futureUtcDate(-4), time: utcTime(9), maxSlots: 25 },
    { key: "PAST_DBA", programId: dbaProgram.id, date: futureUtcDate(-4), time: utcTime(13), maxSlots: 20 },
    { key: "PAST_MAIP", programId: maipProgram.id, date: futureUtcDate(-3), time: utcTime(9), maxSlots: 20 },
    { key: "PAST_MSM", programId: msmProgram.id, date: futureUtcDate(-2), time: utcTime(9), maxSlots: 20 },
    { key: "PAST_MAIE", programId: maieHrmProgram.id, date: futureUtcDate(-1), time: utcTime(10), maxSlots: 20 },
  ];

  const slotsByKey = new Map<
    string,
    Awaited<ReturnType<typeof prisma.examSlot.create>>
  >();
  for (const cfg of slotConfigs) {
    let slot = await prisma.examSlot.findFirst({
      where: {
        programId: cfg.programId,
        examDate: cfg.date,
        examTime: cfg.time,
      },
    });
    if (!slot) {
      slot = await prisma.examSlot.create({
        data: {
          programId: cfg.programId,
          examDate: cfg.date,
          examTime: cfg.time,
          maxSlots: cfg.maxSlots,
          slotsTaken: 0,
          isActive: true,
        },
      });
    }
    slotsByKey.set(cfg.key, slot);
  }

  // ── 6. Entrance Exam Applications, Scores & Pending COR PDFs ────────────
  console.log("Seeding exam applications & COR uploads...");
  const examStates: Array<{
    email: string;
    slotKey: string;
    status: "PENDING" | "TAKEN" | "PASSED" | "FAILED" | "MISSED";
    mcq?: number;
    essay?: number;
    corPending?: boolean;
  }> = [
    { email: "applicant1@earist.edu.ph", slotKey: "PAST_MBA", status: "PASSED", mcq: 56, essay: 25, corPending: true },
    { email: "applicant7@earist.edu.ph", slotKey: "PAST_MPA", status: "PASSED", mcq: 54, essay: 24, corPending: true },
    { email: "applicant2@earist.edu.ph", slotKey: "PAST_MAED", status: "PASSED", mcq: 52, essay: 22 },
    { email: "applicant4@earist.edu.ph", slotKey: "PAST_DBA", status: "PASSED", mcq: 58, essay: 26 },
    { email: "applicant3@earist.edu.ph", slotKey: "MBA_FUTURE_1", status: "PENDING" },
    { email: "applicant5@earist.edu.ph", slotKey: "MPA_FUTURE_1", status: "PENDING" },
    { email: "applicant8@earist.edu.ph", slotKey: "EDD_FUTURE_1", status: "PENDING" },
    { email: "applicant9@earist.edu.ph", slotKey: "PAST_MAIP", status: "FAILED", mcq: 28, essay: 12 },
    { email: "applicant11@earist.edu.ph", slotKey: "PAST_MSM", status: "MISSED" },
    { email: "applicant12@earist.edu.ph", slotKey: "PAST_MAIE", status: "TAKEN", mcq: 48 },
  ];

  // Canonical Essay question (order 73) so OLSAT 1..72 MCQ import stays conflict-free.
  let canonicalEssayQuestion = await prisma.examQuestion.findFirst({
    where: { type: "ESSAY" },
    orderBy: { order: "asc" },
  });
  if (!canonicalEssayQuestion) {
    canonicalEssayQuestion = await prisma.examQuestion.create({
      data: {
        questionText:
          "Discuss a pressing research problem in your chosen field of graduate study and explain how your proposed inquiry can improve professional or institutional practice.",
        type: "ESSAY",
        order: 73,
      },
    });
  }

  for (const state of examStates) {
    const info = seededApplicants.get(state.email);
    const slot = slotsByKey.get(state.slotKey);
    if (!info || !slot) continue;

    let app = await prisma.entranceExamApplication.findFirst({
      where: { studentId: info.studentId, seatReleasedAt: null },
    });
    if (!app) {
      app = await prisma.entranceExamApplication.create({
        data: {
          studentId: info.studentId,
          programId: info.program.id,
          slotId: slot.id,
          examDate: slot.examDate,
          examTime: slot.examTime,
          status: state.status,
        },
      });
    } else {
      app = await prisma.entranceExamApplication.update({
        where: { id: app.id },
        data: {
          programId: info.program.id,
          slotId: slot.id,
          examDate: slot.examDate,
          examTime: slot.examTime,
          status: state.status,
        },
      });
    }

    if (state.status === "PASSED" || state.status === "FAILED") {
      const totalScore = (state.mcq ?? 0) + (state.essay ?? 0);
      await prisma.entranceExamScore.upsert({
        where: { applicationId: app.id },
        update: {
          multipleChoiceScore: state.mcq ?? 0,
          essayScore: state.essay ?? 0,
          totalScore,
          status: state.status,
          gradedById: adminUser.id,
          essayEvaluatedAt: slot.examDate,
          scoredAt: slot.examDate,
        },
        create: {
          applicationId: app.id,
          multipleChoiceScore: state.mcq ?? 0,
          essayScore: state.essay ?? 0,
          totalScore,
          status: state.status,
          gradedById: adminUser.id,
          essayEvaluatedAt: slot.examDate,
          scoredAt: slot.examDate,
        },
      });
    } else if (state.status === "TAKEN") {
      await prisma.entranceExamScore.upsert({
        where: { applicationId: app.id },
        update: {
          multipleChoiceScore: state.mcq ?? 48,
          essayScore: null,
          totalScore: null,
          status: "PENDING",
          gradedById: null,
        },
        create: {
          applicationId: app.id,
          multipleChoiceScore: state.mcq ?? 48,
          essayScore: null,
          totalScore: null,
          status: "PENDING",
        },
      });
      await prisma.applicantAnswer.upsert({
        where: {
          applicationId_questionId: {
            applicationId: app.id,
            questionId: canonicalEssayQuestion.id,
          },
        },
        update: {
          essayAnswer:
            "In hospitality and industrial education, competency-based micro-assessments paired with structured workplace mentoring help graduate practitioners translate theoretical standards into consistent service quality and measurable learning outcomes.",
        },
        create: {
          applicationId: app.id,
          questionId: canonicalEssayQuestion.id,
          essayAnswer:
            "In hospitality and industrial education, competency-based micro-assessments paired with structured workplace mentoring help graduate practitioners translate theoretical standards into consistent service quality and measurable learning outcomes.",
        },
      });
    }

    if (state.corPending) {
      const existingCor = await prisma.corUpload.findFirst({
        where: { studentId: info.studentId, status: "PENDING" },
      });
      if (!existingCor) {
        const corPdf = await ensureSyntheticPdf({
          namespace: "cor",
          filename: `seed-cor-${info.pinnacleId}.pdf`,
          originalFilename: `${info.pinnacleId}_Certificate_of_Registration.pdf`,
          documentCategory: "Certificate of Registration (COR)",
          subjectName: info.name,
          identifierLabel: "Pinnacle Applicant ID",
          identifierValue: info.pinnacleId,
          programName: info.program.programName,
          details: [
            { label: "Semester / AY", value: "First Semester, S.Y. 2026-2027" },
            { label: "Registration Status", value: "Official Enrolled COR — Pending Verification" },
          ],
        });
        await prisma.corUpload.create({
          data: {
            studentId: info.studentId,
            filePath: corPdf.filePath,
            storageKey: corPdf.storageKey,
            storageProvider: corPdf.storageProvider,
            originalFilename: corPdf.originalFilename,
            detectedMimeType: corPdf.detectedMimeType,
            sizeBytes: corPdf.sizeBytes,
            checksum: corPdf.checksum,
            checksumAlgorithm: corPdf.checksumAlgorithm,
            uploadedById: info.userId,
            status: "PENDING",
            uploadedAt: new Date(),
          },
        });
      }
    }
  }

  // ── 7. Clean Email Templates (Pre-exam Waiver/Alignment templates removed) ─
  console.log("Seeding Email Templates...");
  await prisma.emailTemplate.deleteMany({
    where: {
      templateKey: {
        in: [
          "bridging_waiver_validated",
          "bridging_waiver_rejected",
          "alignment_aligned",
          "alignment_misaligned",
        ],
      },
    },
  });

  const emailTemplates = [
    {
      templateKey: "ecat_result_pass",
      subject: "Entrance Examination Result: PASSED",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>Congratulations! You passed the Graduate School Entrance Examination. Login to your portal to upload your COR: {{portal_link}}</p>",
    },
    {
      templateKey: "ecat_result_fail",
      subject: "Entrance Examination Result: FAILED",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>We regret to inform you that you did not meet the passing score in the Entrance Examination. Login to your portal: {{portal_link}}</p>",
    },
    {
      templateKey: "credential_dispatch",
      subject: "COR Verified: Your Student Account",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>Your Certificate of Registration (COR) has been verified and your account is now a Student account.</p><p>Your Student Number is: <strong>{{student_number}}</strong></p><p>Sign in through the Student portal using your Student Number and your existing account password.</p><p>If you have forgotten your password, use the \"Forgot your password?\" option on the login page.</p><p>Portal: {{portal_link}}</p>",
    },
    {
      templateKey: "defense_schedule",
      subject: "Defense Schedule",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>Your defense is scheduled on {{defense_date}} at {{defense_time}} in {{venue}}.</p>",
    },
    {
      templateKey: "cor_verified",
      subject: "COR Verified",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>Your Certificate of Registration has been verified. Login to your portal: {{portal_link}}</p>",
    },
    {
      templateKey: "memo_broadcast",
      subject: "{{memo_title}}",
      bodyHtml:
        "<p>Dear {{student_name}},</p><div>{{memo_content}}</div><p>Login to your portal: {{portal_link}}</p>",
    },
    {
      templateKey: "residency_warning",
      subject: "Residency Warning",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>This is a warning regarding your residency: {{warning_details}}.</p><p>Login to your portal: {{portal_link}}</p>",
    },
    {
      templateKey: "exam_reminder_24h",
      subject: "Reminder: Entrance Examination Tomorrow",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>This is a 24-hour reminder for your scheduled exam on {{exam_date}}. Login to your portal: {{portal_link}}</p>",
    },
    {
      templateKey: "rap_distributed",
      subject: "RAP Report E-signature Requested",
      bodyHtml:
        "<p>Dear {{panelist_name}},</p><p>Please review and e-sign the RAP Report here: {{rap_link}}</p>",
    },
    {
      templateKey: "rap_finalized",
      subject: "RAP Report Finalized",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>Your RAP Report has been finalized by all panelists. View it here: {{rap_link}}</p>",
    },
    {
      templateKey: "strike_result",
      subject: "Plagiarism Strike Result",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>Your submission received a similarity percentage of {{similarity_percentage}}%.</p><div>Instructions: {{instructions}}</div>",
    },
    {
      templateKey: "adviser_assigned",
      subject: "Adviser Assigned",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>Your assigned adviser is {{adviser_name}}. Login to your portal: {{portal_link}}</p>",
    },
    {
      templateKey: "comp_exam_recorded",
      subject: "Comprehensive Exam Result Recorded",
      bodyHtml:
        "<p>Dear {{student_name}},</p><p>Your comprehensive exam result ({{result}}) has been recorded. Login to your portal: {{portal_link}}</p>",
    },
  ];

  for (const tpl of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { templateKey: tpl.templateKey },
      update: { subject: tpl.subject, bodyHtml: tpl.bodyHtml },
      create: {
        templateKey: tpl.templateKey,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
      },
    });
  }
  console.log(`Ensured ${emailTemplates.length} clean Email Templates.`);

  // ── 8. Defense Lobby Fixtures (student@earist.edu.ph + Doctoral Scheduled) ─
  console.log("Seeding defense lobby & upcoming schedule fixtures...");

  const ensurePanel = async (
    scheduleId: string,
    userId: string,
    role: "CHAIRMAN" | "PANELIST" | "ADVISER" | "RAPPORTEUR" | "FACILITATOR",
  ) => {
    const existing = await prisma.panelAssignment.findFirst({
      where: { scheduleId, userId },
    });
    if (existing) {
      return prisma.panelAssignment.update({
        where: { id: existing.id },
        data: { role, isActive: true },
      });
    }
    return prisma.panelAssignment.create({
      data: { scheduleId, userId, role },
    });
  };

  const ensureScore = async (
    panelId: string,
    scheduleId: string,
    data: {
      overallAverage: number;
      rating: "E" | "HS" | "VS" | "S" | "BS" | "F";
      recommendations: string;
    },
  ) => {
    const existing = await prisma.oralExamScore.findFirst({
      where: { panelId },
    });
    if (existing) return existing;
    return prisma.oralExamScore.create({
      data: {
        panelId,
        scheduleId,
        timelinessRelevance: 1.25,
        organization: 1.5,
        depthComprehensiveness: 1.75,
        relevanceConclusions: 1.5,
        evidenceOriginalThinking: 1.25,
        groupAAverage: 1.45,
        presentation: 1.5,
        masterySubject: 1.25,
        communicationSkill: 1.5,
        attitude: 1.0,
        groupBAverage: 1.31,
        overallAverage: data.overallAverage,
        rating: data.rating,
        recommendations: data.recommendations,
        scoredAt: new Date(),
      },
    });
  };

  const ensureStagePdfDoc = async (opts: {
    thesisId: string;
    defenseStage: "TITLE" | "PROPOSAL" | "FINAL";
    docType: "TITLE_PROPOSAL" | "PROPOSAL_CHAPTERS" | "FINAL_MANUSCRIPT" | "COR" | "RECEIPT";
    namespace: "evidence" | "manuscripts";
    filename: string;
    originalFilename: string;
    category: string;
    studentName: string;
    studentNumber: string;
    programName: string;
    uploaderUserId: string;
    manuscriptTitle?: string | null;
    orNumber?: string;
  }) => {
    const pdf = await ensureSyntheticPdf({
      namespace: opts.namespace,
      filename: opts.filename,
      originalFilename: opts.originalFilename,
      documentCategory: opts.category,
      subjectName: opts.studentName,
      identifierLabel: "Student Number",
      identifierValue: opts.studentNumber,
      programName: opts.programName,
      details: [
        { label: "Defense Stage", value: opts.defenseStage },
        ...(opts.manuscriptTitle
          ? [{ label: "Working Title", value: opts.manuscriptTitle }]
          : []),
        ...(opts.orNumber
          ? [
              { label: "Official Receipt No.", value: opts.orNumber },
              { label: "Amount Paid", value: "PHP 900.00" },
            ]
          : []),
      ],
    });
    const existing = await prisma.thesisDocument.findFirst({
      where: {
        thesisId: opts.thesisId,
        defenseStage: opts.defenseStage,
        docType: opts.docType,
        isCurrent: true,
      },
    });
    if (existing) {
      return prisma.thesisDocument.update({
        where: { id: existing.id },
        data: {
          manuscriptTitle: opts.manuscriptTitle ?? null,
          filePath: pdf.filePath,
          storageKey: pdf.storageKey,
          storageProvider: pdf.storageProvider,
          originalFilename: pdf.originalFilename,
          verifiedMimeType: pdf.verifiedMimeType,
          sizeBytes: pdf.sizeBytes,
          checksum: pdf.checksum,
          checksumAlgorithm: pdf.checksumAlgorithm,
          uploadedById: opts.uploaderUserId,
        },
      });
    }
    return prisma.thesisDocument.create({
      data: {
        thesisId: opts.thesisId,
        docType: opts.docType,
        defenseStage: opts.defenseStage,
        manuscriptTitle: opts.manuscriptTitle ?? null,
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
  };

  if (lobbyThesis) {
    const s1TitleTexts = [
      s1TitleText,
      "Graduate Thesis Pipeline Digitization in State Universities",
      "Panel Scoring Reliability in Oral Defense Evaluation",
    ];
    for (const titleText of s1TitleTexts) {
      const existing = await prisma.thesisTitle.findFirst({
        where: { thesisId: lobbyThesis.id, titleText },
      });
      if (!existing) {
        await prisma.thesisTitle.create({
          data: {
            thesisId: lobbyThesis.id,
            titleText,
            isSelected: titleText === s1TitleText,
          },
        });
      }
    }

    // Synthetic PDFs for Student 1's Title & Proposal stages
    await ensureStagePdfDoc({
      thesisId: lobbyThesis.id,
      defenseStage: "TITLE",
      docType: "TITLE_PROPOSAL",
      namespace: "evidence",
      filename: "seed-2026-0001-title-proposal.pdf",
      originalFilename: "2026-0001_Title_Proposal_Package.pdf",
      category: "Title Proposal Package",
      studentName: "Jane Smith",
      studentNumber: "2026-0001",
      programName: mbaProgram.programName,
      uploaderUserId: s1.user.id,
    });
    await ensureStagePdfDoc({
      thesisId: lobbyThesis.id,
      defenseStage: "TITLE",
      docType: "COR",
      namespace: "evidence",
      filename: "seed-2026-0001-title-cor.pdf",
      originalFilename: "2026-0001_Title_COR.pdf",
      category: "Certificate of Registration (TITLE Defense)",
      studentName: "Jane Smith",
      studentNumber: "2026-0001",
      programName: mbaProgram.programName,
      uploaderUserId: s1.user.id,
    });
    await ensureStagePdfDoc({
      thesisId: lobbyThesis.id,
      defenseStage: "TITLE",
      docType: "RECEIPT",
      namespace: "evidence",
      filename: "seed-2026-0001-title-receipt.pdf",
      originalFilename: "2026-0001_Title_OR_Receipt.pdf",
      category: "Official Defense Fee Receipt (TITLE Defense)",
      studentName: "Jane Smith",
      studentNumber: "2026-0001",
      programName: mbaProgram.programName,
      uploaderUserId: s1.user.id,
      orNumber: "OR-2026-0001T",
    });

    const s1ProposalManuscript = await ensureStagePdfDoc({
      thesisId: lobbyThesis.id,
      defenseStage: "PROPOSAL",
      docType: "PROPOSAL_CHAPTERS",
      namespace: "manuscripts",
      filename: "seed-2026-0001-proposal-chapters.pdf",
      originalFilename: "2026-0001_Proposal_Manuscript_Chapters_1-3.pdf",
      category: "Proposal Manuscript (Chapters 1-3)",
      studentName: "Jane Smith",
      studentNumber: "2026-0001",
      programName: mbaProgram.programName,
      uploaderUserId: s1.user.id,
      manuscriptTitle: s1TitleText,
    });
    await ensureStagePdfDoc({
      thesisId: lobbyThesis.id,
      defenseStage: "PROPOSAL",
      docType: "COR",
      namespace: "evidence",
      filename: "seed-2026-0001-proposal-cor.pdf",
      originalFilename: "2026-0001_Proposal_COR.pdf",
      category: "Certificate of Registration (PROPOSAL Defense)",
      studentName: "Jane Smith",
      studentNumber: "2026-0001",
      programName: mbaProgram.programName,
      uploaderUserId: s1.user.id,
    });
    await ensureStagePdfDoc({
      thesisId: lobbyThesis.id,
      defenseStage: "PROPOSAL",
      docType: "RECEIPT",
      namespace: "evidence",
      filename: "seed-2026-0001-proposal-receipt.pdf",
      originalFilename: "2026-0001_Proposal_OR_Receipt.pdf",
      category: "Official Defense Fee Receipt (PROPOSAL Defense)",
      studentName: "Jane Smith",
      studentNumber: "2026-0001",
      programName: mbaProgram.programName,
      uploaderUserId: s1.user.id,
      orNumber: "OR-2026-0001P",
    });

    const existingS1Cert = await prisma.adviserCertification.findFirst({
      where: { thesisId: lobbyThesis.id, defenseStage: "PROPOSAL_DEFENSE" },
    });
    if (!existingS1Cert) {
      await prisma.adviserCertification.create({
        data: {
          thesisId: lobbyThesis.id,
          adviserId: panelUser1.id,
          defenseStage: "PROPOSAL_DEFENSE",
          status: "ISSUED",
          reviewedDocumentId: s1ProposalManuscript.id,
          signatureData,
          signedAt: new Date("2026-07-30T10:00:00.000Z"),
          certifiedAt: new Date("2026-07-30T10:00:00.000Z"),
        },
      });
    }

    // 1) UPCOMING SCHEDULED PROPOSAL DEFENSE for Student 1 (+3 days from today)
    const upcomingDate = futureUtcDate(3);
    let liveSchedule = await prisma.defenseSchedule.findFirst({
      where: {
        thesisId: lobbyThesis.id,
        defenseType: "PROPOSAL_DEFENSE",
      },
    });
    if (!liveSchedule) {
      liveSchedule = await prisma.defenseSchedule.create({
        data: {
          thesisId: lobbyThesis.id,
          manuscriptDocumentId: s1ProposalManuscript.id,
          defenseDate: upcomingDate,
          defenseTime: utcTime(9),
          venueOrLink:
            "https://teams.microsoft.com/l/meetup-join/defense-lobby-demo",
          defenseType: "PROPOSAL_DEFENSE",
          sessionStatus: "SCHEDULED",
          setById: adminUser.id,
          rapporteurNotes:
            "Student presented Chapters 1-3.\nPanel suggested tightening the sampling section.",
        },
      });
    } else {
      liveSchedule = await prisma.defenseSchedule.update({
        where: { id: liveSchedule.id },
        data: {
          manuscriptDocumentId: s1ProposalManuscript.id,
          defenseDate: upcomingDate,
          defenseTime: utcTime(9),
          sessionStatus: "SCHEDULED",
        },
      });
    }

    const liveChair = await ensurePanel(liveSchedule.id, panelUser2.id, "CHAIRMAN");
    const liveRapporteur = await ensurePanel(
      liveSchedule.id,
      panelUser3.id,
      "RAPPORTEUR",
    );
    await ensurePanel(liveSchedule.id, panelUser1.id, "ADVISER");
    await ensureScore(liveChair.id, liveSchedule.id, {
      overallAverage: 1.38,
      rating: "HS",
      recommendations: "Revise sampling rationale before final defense.",
    });
    await ensureScore(liveRapporteur.id, liveSchedule.id, {
      overallAverage: 1.5,
      rating: "S",
      recommendations: "Acceptable proposal; minor edits on Chapter 2.",
    });

    // 2) CONCLUDED lobby — TITLE_DEFENSE for Student 1 with PARTIALLY_SIGNED RAP Report
    let concludedSchedule = await prisma.defenseSchedule.findFirst({
      where: {
        thesisId: lobbyThesis.id,
        defenseType: "TITLE_DEFENSE",
      },
    });
    if (!concludedSchedule) {
      concludedSchedule = await prisma.defenseSchedule.create({
        data: {
          thesisId: lobbyThesis.id,
          defenseDate: new Date("2026-07-10T00:00:00.000Z"),
          defenseTime: utcTime(13),
          venueOrLink: "GS Conference Room B",
          defenseType: "TITLE_DEFENSE",
          sessionStatus: "CONCLUDED",
          setById: adminUser.id,
          rapporteurNotes:
            "Title defense concluded. Panel selected Title A with minor wording edits.",
        },
      });
    }

    const concludedChair = await ensurePanel(
      concludedSchedule.id,
      panelUser2.id,
      "CHAIRMAN",
    );
    const concludedPanelist = await ensurePanel(
      concludedSchedule.id,
      panelUser3.id,
      "PANELIST",
    );
    const concludedRapporteur = await ensurePanel(
      concludedSchedule.id,
      panelUser1.id,
      "RAPPORTEUR",
    );

    await ensureScore(concludedChair.id, concludedSchedule.id, {
      overallAverage: 1.25,
      rating: "HS",
      recommendations: "Approved title; align Chapter 1 framing with selected title.",
    });
    await ensureScore(concludedPanelist.id, concludedSchedule.id, {
      overallAverage: 1.5,
      rating: "S",
      recommendations: "Title is feasible. Proceed to proposal defense.",
    });

    if (
      !(await prisma.oralExamSummary.findFirst({
        where: { scheduleId: concludedSchedule.id },
      }))
    ) {
      await prisma.oralExamSummary.create({
        data: {
          scheduleId: concludedSchedule.id,
          overallAverage: 1.25,
          finalRating: "HS",
          finalRemarks: "Seeded from Defense Lobby fixtures",
          attestedById: adminUser.id,
        },
      });
    }

    const existingRap = await prisma.rapReport.findFirst({
      where: { scheduleId: concludedSchedule.id },
    });
    if (!existingRap) {
      const rap = await prisma.rapReport.create({
        data: {
          scheduleId: concludedSchedule.id,
          thesisId: lobbyThesis.id,
          defenseType: "TITLE_DEFENSE",
          reportDate: new Date("2026-07-10T00:00:00.000Z"),
          venue: "GS Conference Room B",
          decisionsAndRecommendations:
            "=== RAPPORTEUR NOTES ===\nTitle defense concluded. Panel selected Title A with minor wording edits.\n\n=== PANEL ===\nApproved title; align Chapter 1 framing with selected title.\n\nTitle is feasible. Proceed to proposal defense.",
          selectedTitle: s1TitleText,
          status: "PARTIALLY_SIGNED",
          generatedById: adminUser.id,
          generatedAt: new Date(),
        },
      });
      await prisma.rapReportSignature.createMany({
        data: [
          {
            rapId: rap.id,
            userId: concludedChair.userId,
            roleAtDefense: "CHAIRMAN",
            required: true,
            isSigned: true,
            signatureData,
            signedAt: new Date(),
          },
          {
            rapId: rap.id,
            userId: concludedPanelist.userId,
            roleAtDefense: "PANELIST",
            required: true,
            isSigned: false,
          },
          {
            rapId: rap.id,
            userId: concludedRapporteur.userId,
            roleAtDefense: "RAPPORTEUR",
            required: true,
            isSigned: false,
          },
        ],
      });
    }
  }

  // ── Defense eligibility fixtures & Upcoming Scheduled Doctoral Title Defense
  let docThesis = await prisma.thesisRecord.findFirst({
    where: { studentId: doctoralScheduledAccount.student.id },
  });
  if (!docThesis) {
    docThesis = await prisma.thesisRecord.create({
      data: {
        studentId: doctoralScheduledAccount.student.id,
        stage: "TITLE",
        status: "SCHEDULED",
        orNumber: "OR-2026-2001",
        amountPaid: 900,
        titleOrNumber: "OR-2026-2001",
        titleApplicationSubmittedAt: new Date("2026-09-10T09:00:00.000Z"),
      },
    });
  }
  const docTitleTexts = [
    "Instructional Leadership Agility in State Universities and Colleges",
    "Digital Equity Frameworks for Graduate Teacher Education",
    "Outcome-Based Quality Assurance in Public Higher Education",
  ];
  for (const titleText of docTitleTexts) {
    if (
      !(await prisma.thesisTitle.findFirst({
        where: { thesisId: docThesis.id, titleText },
      }))
    ) {
      await prisma.thesisTitle.create({
        data: { thesisId: docThesis.id, titleText },
      });
    }
  }
  await ensureStagePdfDoc({
    thesisId: docThesis.id,
    defenseStage: "TITLE",
    docType: "TITLE_PROPOSAL",
    namespace: "evidence",
    filename: "seed-2026-2001-title-proposal.pdf",
    originalFilename: "2026-2001_Doctoral_Title_Proposal.pdf",
    category: "Doctoral Title Proposal Package",
    studentName: "Maricel Valdez",
    studentNumber: "2026-2001",
    programName: eddProgram.programName,
    uploaderUserId: doctoralScheduledAccount.user.id,
  });
  await ensureStagePdfDoc({
    thesisId: docThesis.id,
    defenseStage: "TITLE",
    docType: "COR",
    namespace: "evidence",
    filename: "seed-2026-2001-title-cor.pdf",
    originalFilename: "2026-2001_Doctoral_COR.pdf",
    category: "Certificate of Registration (TITLE Defense)",
    studentName: "Maricel Valdez",
    studentNumber: "2026-2001",
    programName: eddProgram.programName,
    uploaderUserId: doctoralScheduledAccount.user.id,
  });
  await ensureStagePdfDoc({
    thesisId: docThesis.id,
    defenseStage: "TITLE",
    docType: "RECEIPT",
    namespace: "evidence",
    filename: "seed-2026-2001-title-receipt.pdf",
    originalFilename: "2026-2001_Doctoral_OR_Receipt.pdf",
    category: "Official Defense Fee Receipt (TITLE Defense)",
    studentName: "Maricel Valdez",
    studentNumber: "2026-2001",
    programName: eddProgram.programName,
    uploaderUserId: doctoralScheduledAccount.user.id,
    orNumber: "OR-2026-2001",
  });

  const existingDocSchedule = await prisma.defenseSchedule.findFirst({
    where: { thesisId: docThesis.id, defenseType: "TITLE_DEFENSE" },
  });
  if (!existingDocSchedule) {
    const docSched = await prisma.defenseSchedule.create({
      data: {
        thesisId: docThesis.id,
        defenseDate: futureUtcDate(5),
        defenseTime: utcTime(14),
        venueOrLink: "Graduate School Boardroom (Nagtahan)",
        defenseType: "TITLE_DEFENSE",
        sessionStatus: "SCHEDULED",
        setById: adminUser.id,
      },
    });
    const docRoster: Array<{ email: string; role: "CHAIRMAN" | "PANELIST" | "FACILITATOR" | "RAPPORTEUR" }> = [
      { email: "panelist1@earist.edu.ph", role: "CHAIRMAN" },
      { email: "panelist2@earist.edu.ph", role: "PANELIST" },
      { email: "panelist3@earist.edu.ph", role: "PANELIST" },
      { email: "panelist4@earist.edu.ph", role: "PANELIST" },
      { email: "panelist5@earist.edu.ph", role: "PANELIST" },
      { email: "panelist8@earist.edu.ph", role: "PANELIST" },
      { email: "panelist6@earist.edu.ph", role: "FACILITATOR" },
      { email: "panelist7@earist.edu.ph", role: "RAPPORTEUR" },
    ];
    for (const seat of docRoster) {
      const uid = panelistUsers[seat.email];
      if (uid) {
        await prisma.panelAssignment.create({
          data: { scheduleId: docSched.id, userId: uid, role: seat.role },
        });
      }
    }
  } else {
    await prisma.defenseSchedule.update({
      where: { id: existingDocSchedule.id },
      data: { defenseDate: futureUtcDate(5), sessionStatus: "SCHEDULED" },
    });
  }

  // ── 9. Defense Workflow Refactor Fixtures (Distributed Across 16 Programs) ─
  console.log("Seeding defense workflow refactor fixtures...");
  await seedDefenseWorkflowFixtures(
    passwordHash,
    mastersPrograms,
    doctoralPrograms,
    panelistUsers,
    signatureData,
  );

  // ── 10. WP6 Student Thesis Journey Fixtures ──────────────────────────────
  console.log("Seeding Student Thesis Journey fixtures...");
  const { seedStudentThesisJourneyFixtures } = await import(
    "./journey-fixtures"
  );
  await seedStudentThesisJourneyFixtures(prisma, passwordHash);

  // ── 11. UIUX Essay-Grading Review Fixture (MBA — Strictly 16 Programs) ───
  console.log("Seeding essay-grading review fixture...");
  await seedEssayGradingReviewFixture(passwordHash, mbaProgram, canonicalEssayQuestion.id);

  // ── 12. Reconcile All ExamSlot seat counters cleanly (Zero B3 drift) ─────
  const allSlots = await prisma.examSlot.findMany({ select: { id: true } });
  for (const slot of allSlots) {
    const taken = await prisma.entranceExamApplication.count({
      where: { slotId: slot.id, seatReleasedAt: null },
    });
    await prisma.examSlot.update({
      where: { id: slot.id },
      data: { slotsTaken: taken },
    });
  }
  console.log(`Reconciled slotsTaken counters across ${allSlots.length} ExamSlot rows.`);
}

async function seedDefenseWorkflowFixtures(
  passwordHash: string,
  mastersPrograms: Program[],
  doctoralPrograms: Program[],
  panelistUsers: Record<string, string>,
  signatureData: string,
) {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@earist.edu.ph" },
  });
  if (!admin) {
    console.error("admin@earist.edu.ph missing — skipping workflow fixtures.");
    return;
  }
  const adminId = admin.id;
  const pickMasters = (idx: number) =>
    mastersPrograms[idx % mastersPrograms.length];
  const doctoral = pickByCode(doctoralPrograms, "DBA");

  async function ensureStudent(opts: {
    email: string;
    first: string;
    last: string;
    studentNumber: string;
    program: Program;
    compExam?: "PASSED" | "FAILED" | "PENDING";
    strikes?: number;
  }) {
    const enrollDate = new Date("2026-06-01T00:00:00.000Z");
    const user = await prisma.user.upsert({
      where: { email: opts.email },
      update: {
        firstName: opts.first,
        lastName: opts.last,
        role: "STUDENT",
        isActive: true,
      },
      create: {
        email: opts.email,
        passwordHash,
        firstName: opts.first,
        lastName: opts.last,
        role: "STUDENT",
        student: {
          create: {
            studentNumber: opts.studentNumber,
            programId: opts.program.id,
            admissionStatus: "ENROLLED",
            enrollmentDate: enrollDate,
            residencyStartDate: enrollDate,
            curriculumType: "NEW",
          },
        },
      },
    });
    const student = await prisma.student.update({
      where: { userId: user.id },
      data: {
        programId: opts.program.id,
        admissionStatus: "ENROLLED",
        enrollmentDate: enrollDate,
        residencyStartDate: enrollDate,
        curriculumType: "NEW",
      },
    });
    const maxYears =
      opts.program.maxResidencyYears ??
      (opts.program.programType === "DOCTORAL" ? 6 : 4);
    await prisma.residencyTracking.upsert({
      where: { studentId: student.id },
      update: { startDate: enrollDate, maxYears },
      create: { studentId: student.id, startDate: enrollDate, maxYears },
    });

    if (opts.compExam) {
      const existing = await prisma.compExamRecord.findFirst({
        where: { studentId: student.id, status: opts.compExam },
      });
      if (!existing) {
        await prisma.compExamRecord.create({
          data: { studentId: student.id, status: opts.compExam },
        });
      }
    }
    if (opts.strikes && opts.strikes > 0) {
      const failedCount = await prisma.compExamRecord.count({
        where: { studentId: student.id, status: "FAILED" },
      });
      for (let i = failedCount; i < opts.strikes; i++) {
        await prisma.compExamRecord.create({
          data: { studentId: student.id, status: "FAILED" },
        });
      }
    }
    return { user, student };
  }

  async function ensureStageDocsWithPdfs(opts: {
    thesisId: string;
    defenseStage: "TITLE" | "PROPOSAL" | "FINAL";
    studentName: string;
    studentNumber: string;
    programName: string;
    uploaderUserId: string;
    manuscriptTitle?: string | null;
    orNumber: string;
  }) {
    const mainDocType =
      opts.defenseStage === "TITLE"
        ? ("TITLE_PROPOSAL" as const)
        : opts.defenseStage === "PROPOSAL"
          ? ("PROPOSAL_CHAPTERS" as const)
          : ("FINAL_MANUSCRIPT" as const);
    const docs: Array<{
      docType: typeof mainDocType | "COR" | "RECEIPT";
      namespace: "evidence" | "manuscripts";
      category: string;
      title: string | null;
      orNum?: string;
    }> = [
      {
        docType: mainDocType,
        namespace: opts.defenseStage === "TITLE" ? "evidence" : "manuscripts",
        category:
          opts.defenseStage === "TITLE"
            ? "Title Proposal Package"
            : opts.defenseStage === "PROPOSAL"
              ? "Proposal Manuscript (Chapters 1-3)"
              : "Final Thesis / Dissertation Manuscript",
        title: opts.defenseStage === "TITLE" ? null : opts.manuscriptTitle ?? null,
      },
      {
        docType: "COR",
        namespace: "evidence",
        category: `Certificate of Registration (${opts.defenseStage} Defense)`,
        title: null,
      },
      {
        docType: "RECEIPT",
        namespace: "evidence",
        category: `Official Defense Fee Receipt (${opts.defenseStage} Defense)`,
        title: null,
        orNum: opts.orNumber,
      },
    ];

    let mainDocId: string | null = null;
    for (const doc of docs) {
      const pdf = await ensureSyntheticPdf({
        namespace: doc.namespace,
        filename: `seed-${opts.studentNumber}-${opts.defenseStage.toLowerCase()}-${doc.docType.toLowerCase()}.pdf`,
        originalFilename: `${opts.studentNumber}_${opts.defenseStage}_${doc.docType}.pdf`,
        documentCategory: doc.category,
        subjectName: opts.studentName,
        identifierLabel: "Student Number",
        identifierValue: opts.studentNumber,
        programName: opts.programName,
        details: [
          { label: "Defense Stage", value: opts.defenseStage },
          ...(doc.title ? [{ label: "Working Title", value: doc.title }] : []),
          ...(doc.orNum
            ? [
                { label: "Official Receipt No.", value: doc.orNum },
                { label: "Amount Paid", value: "PHP 900.00" },
              ]
            : []),
        ],
      });

      const existing = await prisma.thesisDocument.findFirst({
        where: {
          thesisId: opts.thesisId,
          docType: doc.docType,
          defenseStage: opts.defenseStage,
          isCurrent: true,
        },
      });
      const saved = existing
        ? await prisma.thesisDocument.update({
            where: { id: existing.id },
            data: {
              manuscriptTitle: doc.title,
              filePath: pdf.filePath,
              storageKey: pdf.storageKey,
              storageProvider: pdf.storageProvider,
              originalFilename: pdf.originalFilename,
              verifiedMimeType: pdf.verifiedMimeType,
              sizeBytes: pdf.sizeBytes,
              checksum: pdf.checksum,
              checksumAlgorithm: pdf.checksumAlgorithm,
              uploadedById: opts.uploaderUserId,
            },
          })
        : await prisma.thesisDocument.create({
            data: {
              thesisId: opts.thesisId,
              docType: doc.docType,
              defenseStage: opts.defenseStage,
              manuscriptTitle: doc.title,
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

      if (doc.docType === mainDocType) {
        mainDocId = saved.id;
      }
    }
    return mainDocId;
  }

  async function ensureTitles(thesisId: string, selected?: string) {
    const texts = [
      selected && selected.length > 0
        ? selected
        : "Digital Inclusion Practices in Graduate Education",
      "Panel Scoring Reliability in Oral Defense Evaluation",
      "Stage-Aware Eligibility Gates for Thesis Defense Applications",
    ];
    for (const titleText of texts) {
      const existing = await prisma.thesisTitle.findFirst({
        where: { thesisId, titleText },
      });
      if (!existing) {
        await prisma.thesisTitle.create({
          data: {
            thesisId,
            titleText,
            isSelected: selected ? titleText === selected : false,
          },
        });
      } else if (selected && titleText === selected && !existing.isSelected) {
        await prisma.thesisTitle.update({
          where: { id: existing.id },
          data: { isSelected: true },
        });
      }
    }
  }

  async function cancelNonCancelledSchedules(
    thesisId: string,
    defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE",
  ) {
    await prisma.defenseSchedule.updateMany({
      where: {
        thesisId,
        defenseType,
        sessionStatus: { not: "CANCELLED" },
      },
      data: { sessionStatus: "CANCELLED" },
    });
  }

  async function ensureCommitteeRoster(scheduleId: string) {
    const roster: Array<{
      email: string;
      role: "CHAIRMAN" | "PANELIST" | "FACILITATOR" | "RAPPORTEUR";
    }> = [
      { email: "panelist1@earist.edu.ph", role: "CHAIRMAN" },
      { email: "panelist2@earist.edu.ph", role: "PANELIST" },
      { email: "panelist3@earist.edu.ph", role: "PANELIST" },
      { email: "panelist4@earist.edu.ph", role: "PANELIST" },
      { email: "panelist5@earist.edu.ph", role: "PANELIST" },
      { email: "panelist6@earist.edu.ph", role: "FACILITATOR" },
      { email: "panelist7@earist.edu.ph", role: "RAPPORTEUR" },
    ];
    for (const seat of roster) {
      const uid = panelistUsers[seat.email];
      if (!uid) continue;
      const existing = await prisma.panelAssignment.findFirst({
        where: { scheduleId, userId: uid },
      });
      if (!existing) {
        await prisma.panelAssignment.create({
          data: { scheduleId, userId: uid, role: seat.role },
        });
      }
    }
  }

  async function resolveSelectedTitleId(thesisId: string, titleText: string) {
    const title = await prisma.thesisTitle.findFirst({
      where: { thesisId, titleText },
    });
    if (!title) return null;
    if (!title.isSelected) {
      await prisma.thesisTitle.updateMany({
        where: { thesisId },
        data: { isSelected: false },
      });
      await prisma.thesisTitle.update({
        where: { id: title.id },
        data: { isSelected: true },
      });
    }
    return title.id;
  }

  async function ensureConcludedPriorDefense(opts: {
    thesisId: string;
    defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE";
    defenseDate: string;
    venueOrLink: string;
    outcome?: "PASSED" | "REVISION_REQUIRED" | "FAILED";
    selectedTitleId?: string | null;
  }) {
    const outcome = opts.outcome ?? "PASSED";
    let selectedTitleId = opts.selectedTitleId ?? null;
    if (
      !selectedTitleId &&
      opts.defenseType === "TITLE_DEFENSE" &&
      outcome === "PASSED"
    ) {
      const selected = await prisma.thesisTitle.findFirst({
        where: { thesisId: opts.thesisId, isSelected: true },
      });
      selectedTitleId = selected?.id ?? null;
    }

    let schedule = await prisma.defenseSchedule.findFirst({
      where: {
        thesisId: opts.thesisId,
        defenseType: opts.defenseType,
        sessionStatus: "CONCLUDED",
      },
      orderBy: { createdAt: "desc" },
    });
    if (!schedule) {
      await cancelNonCancelledSchedules(opts.thesisId, opts.defenseType);
      schedule = await prisma.defenseSchedule.create({
        data: {
          thesisId: opts.thesisId,
          defenseDate: new Date(opts.defenseDate),
          defenseTime: utcTime(9),
          venueOrLink: opts.venueOrLink,
          defenseType: opts.defenseType,
          setById: adminId,
          sessionStatus: "CONCLUDED",
        },
      });
    } else if (schedule.sessionStatus !== "CONCLUDED") {
      await prisma.defenseSchedule.update({
        where: { id: schedule.id },
        data: { sessionStatus: "CONCLUDED" },
      });
    }

    await ensureCommitteeRoster(schedule.id);

    let conclusion = await prisma.defenseConclusion.findUnique({
      where: { scheduleId: schedule.id },
    });
    if (!conclusion) {
      conclusion = await prisma.defenseConclusion.create({
        data: {
          scheduleId: schedule.id,
          thesisId: opts.thesisId,
          outcome,
          selectedTitleId,
          finalRemarks: `Seeded ${opts.defenseType} conclusion`,
          concludedById: adminId,
          concludedAt: new Date(opts.defenseDate),
        },
      });
    } else if (
      selectedTitleId &&
      conclusion.selectedTitleId !== selectedTitleId
    ) {
      conclusion = await prisma.defenseConclusion.update({
        where: { id: conclusion.id },
        data: { selectedTitleId },
      });
    }
    return schedule;
  }

  const officialTitle = "Digital Inclusion Practices in Graduate Education";
  const adviser = await prisma.user.findUnique({
    where: { email: "panelist1@earist.edu.ph" },
  });

  // A) title-ready@
  await ensureStudent({
    email: "title-ready@earist.edu.ph",
    first: "Tina",
    last: "Ready",
    studentNumber: "2026-1001",
    program: pickMasters(0),
    compExam: "PASSED",
  });

  // B) title-blocked@
  await ensureStudent({
    email: "title-blocked@earist.edu.ph",
    first: "Toby",
    last: "Blocked",
    studentNumber: "2026-1002",
    program: pickMasters(1),
    compExam: "FAILED",
    strikes: 2,
  });

  // C) title-pending@
  const pC = pickMasters(2);
  const c = await ensureStudent({
    email: "title-pending@earist.edu.ph",
    first: "Pam",
    last: "Pending",
    studentNumber: "2026-1003",
    program: pC,
    compExam: "PASSED",
  });
  const cThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: c.student.id, stage: "TITLE" },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: c.student.id,
        stage: "TITLE",
        status: "PENDING",
        orNumber: "OR-2026-1003T",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1003T",
        titleApplicationSubmittedAt: new Date("2026-09-12T09:00:00.000Z"),
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: cThesis.id },
    data: {
      stage: "TITLE",
      status: "PENDING",
      outcome: null,
      orNumber: "OR-2026-1003T",
      amountPaid: 900,
      titleOrNumber: "OR-2026-1003T",
    },
  });
  await cancelNonCancelledSchedules(cThesis.id, "TITLE_DEFENSE");
  await ensureTitles(cThesis.id);
  await ensureStageDocsWithPdfs({
    thesisId: cThesis.id,
    defenseStage: "TITLE",
    studentName: "Pam Pending",
    studentNumber: "2026-1003",
    programName: pC.programName,
    uploaderUserId: c.user.id,
    orNumber: "OR-2026-1003T",
  });

  // D) title-approved@
  const pD = pickMasters(3);
  const d = await ensureStudent({
    email: "title-approved@earist.edu.ph",
    first: "Abe",
    last: "Approved",
    studentNumber: "2026-1004",
    program: pD,
    compExam: "PASSED",
  });
  const dThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: d.student.id, stage: "TITLE" },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: d.student.id,
        stage: "TITLE",
        status: "APPROVED",
        orNumber: "OR-2026-1004T",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1004T",
        titleApplicationSubmittedAt: new Date("2026-09-10T09:00:00.000Z"),
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: dThesis.id },
    data: {
      stage: "TITLE",
      status: "APPROVED",
      outcome: null,
      orNumber: "OR-2026-1004T",
      amountPaid: 900,
      titleOrNumber: "OR-2026-1004T",
    },
  });
  await cancelNonCancelledSchedules(dThesis.id, "TITLE_DEFENSE");
  await ensureTitles(dThesis.id);
  await ensureStageDocsWithPdfs({
    thesisId: dThesis.id,
    defenseStage: "TITLE",
    studentName: "Abe Approved",
    studentNumber: "2026-1004",
    programName: pD.programName,
    uploaderUserId: d.user.id,
    orNumber: "OR-2026-1004T",
  });

  // E) proposal-ready@
  const pE = pickMasters(4);
  const e = await ensureStudent({
    email: "proposal-ready@earist.edu.ph",
    first: "Pia",
    last: "Proposal",
    studentNumber: "2026-1005",
    program: pE,
    compExam: "PASSED",
  });
  let eAssignment = await prisma.adviserAssignment.findFirst({
    where: { studentId: e.student.id, isActive: true },
  });
  if (!eAssignment && adviser) {
    eAssignment = await prisma.adviserAssignment.create({
      data: {
        studentId: e.student.id,
        adviserId: adviser.id,
        assignedDate: new Date("2026-07-01T00:00:00.000Z"),
        isActive: true,
      },
    });
  }
  const eThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: e.student.id },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: e.student.id,
        assignmentId: eAssignment?.id ?? null,
        stage: "PROPOSAL",
        status: "APPROVED",
        orNumber: "OR-2026-1005P",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1005T",
        proposalOrNumber: "OR-2026-1005P",
        titleApplicationSubmittedAt: new Date("2026-07-01T09:00:00.000Z"),
        proposalApplicationSubmittedAt: new Date("2026-08-10T09:00:00.000Z"),
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: eThesis.id },
    data: {
      stage: "PROPOSAL",
      status: "APPROVED",
      outcome: null,
      assignmentId: eAssignment?.id ?? eThesis.assignmentId,
      orNumber: "OR-2026-1005P",
      amountPaid: 900,
      titleOrNumber: "OR-2026-1005T",
      proposalOrNumber: "OR-2026-1005P",
    },
  });
  await ensureTitles(eThesis.id, officialTitle);
  await ensureStageDocsWithPdfs({
    thesisId: eThesis.id,
    defenseStage: "TITLE",
    studentName: "Pia Proposal",
    studentNumber: "2026-1005",
    programName: pE.programName,
    uploaderUserId: e.user.id,
    orNumber: "OR-2026-1005T",
  });
  const eSelectedTitleId = await resolveSelectedTitleId(eThesis.id, officialTitle);
  const eTitleSched = await ensureConcludedPriorDefense({
    thesisId: eThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-07-20T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/title-past",
    outcome: "PASSED",
    selectedTitleId: eSelectedTitleId,
  });
  await cancelNonCancelledSchedules(eThesis.id, "PROPOSAL_DEFENSE");
  if (
    !(await prisma.rapReport.findFirst({
      where: { thesisId: eThesis.id, defenseType: "TITLE_DEFENSE" },
    }))
  ) {
    await prisma.rapReport.create({
      data: {
        scheduleId: eTitleSched.id,
        thesisId: eThesis.id,
        defenseType: "TITLE_DEFENSE",
        status: "FINALIZED",
        selectedTitle: officialTitle,
        generatedById: adminId,
        generatedAt: new Date(),
      },
    });
  }
  const ePropDocId = await ensureStageDocsWithPdfs({
    thesisId: eThesis.id,
    defenseStage: "PROPOSAL",
    studentName: "Pia Proposal",
    studentNumber: "2026-1005",
    programName: pE.programName,
    uploaderUserId: e.user.id,
    manuscriptTitle: officialTitle,
    orNumber: "OR-2026-1005P",
  });
  const eCert = await prisma.adviserCertification.findFirst({
    where: { thesisId: eThesis.id, defenseStage: "PROPOSAL_DEFENSE" },
  });
  if (!eCert && adviser) {
    await prisma.adviserCertification.create({
      data: {
        thesisId: eThesis.id,
        adviserId: adviser.id,
        defenseStage: "PROPOSAL_DEFENSE",
        status: "ISSUED",
        reviewedDocumentId: ePropDocId,
        signatureData,
        signedAt: new Date("2026-07-25T00:00:00.000Z"),
        certifiedAt: new Date("2026-07-25T00:00:00.000Z"),
      },
    });
  } else if (eCert && ePropDocId && !eCert.reviewedDocumentId) {
    await prisma.adviserCertification.update({
      where: { id: eCert.id },
      data: { reviewedDocumentId: ePropDocId, signatureData },
    });
  }
  if (
    !(await prisma.researchVariableForm.findFirst({
      where: { thesisId: eThesis.id },
    }))
  ) {
    await prisma.researchVariableForm.create({
      data: {
        thesisId: eThesis.id,
        status: "NOT_APPLICABLE",
        hasAllSignatures: true,
        approvedAt: new Date("2026-07-25T00:00:00.000Z"),
      },
    });
  }
  await cancelNonCancelledSchedules(eThesis.id, "PROPOSAL_DEFENSE");

  // F) proposal-blocked-vars@
  const pF = pickMasters(5);
  const f = await ensureStudent({
    email: "proposal-blocked-vars@earist.edu.ph",
    first: "Vic",
    last: "Vars",
    studentNumber: "2026-1006",
    program: pF,
    compExam: "PASSED",
  });
  let fAssignment = await prisma.adviserAssignment.findFirst({
    where: { studentId: f.student.id, isActive: true },
  });
  if (!fAssignment && adviser) {
    fAssignment = await prisma.adviserAssignment.create({
      data: {
        studentId: f.student.id,
        adviserId: adviser.id,
        assignedDate: new Date("2026-07-01T00:00:00.000Z"),
        isActive: true,
      },
    });
  }
  const fThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: f.student.id },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: f.student.id,
        assignmentId: fAssignment?.id ?? null,
        stage: "TITLE",
        status: "PASSED",
        outcome: "PASSED",
        orNumber: "OR-2026-1006T",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1006T",
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: fThesis.id },
    data: {
      stage: "TITLE",
      status: "PASSED",
      outcome: "PASSED",
      assignmentId: fAssignment?.id ?? fThesis.assignmentId,
    },
  });
  await ensureTitles(fThesis.id, officialTitle);
  await ensureStageDocsWithPdfs({
    thesisId: fThesis.id,
    defenseStage: "TITLE",
    studentName: "Vic Vars",
    studentNumber: "2026-1006",
    programName: pF.programName,
    uploaderUserId: f.user.id,
    orNumber: "OR-2026-1006T",
  });
  const fSelectedTitleId = await resolveSelectedTitleId(fThesis.id, officialTitle);
  if (
    adviser &&
    !(await prisma.adviserCertification.findFirst({
      where: { thesisId: fThesis.id, defenseStage: "PROPOSAL_DEFENSE" },
    }))
  ) {
    await prisma.adviserCertification.create({
      data: {
        thesisId: fThesis.id,
        adviserId: adviser.id,
        defenseStage: "PROPOSAL_DEFENSE",
        status: "ISSUED",
        signatureData,
        signedAt: new Date("2026-07-25T00:00:00.000Z"),
        certifiedAt: new Date("2026-07-25T00:00:00.000Z"),
      },
    });
  }
  const fTitleSched = await ensureConcludedPriorDefense({
    thesisId: fThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-07-20T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/title-past-2",
    outcome: "PASSED",
    selectedTitleId: fSelectedTitleId,
  });
  await cancelNonCancelledSchedules(fThesis.id, "PROPOSAL_DEFENSE");
  if (
    !(await prisma.rapReport.findFirst({
      where: { thesisId: fThesis.id, defenseType: "TITLE_DEFENSE" },
    }))
  ) {
    await prisma.rapReport.create({
      data: {
        scheduleId: fTitleSched.id,
        thesisId: fThesis.id,
        defenseType: "TITLE_DEFENSE",
        status: "FINALIZED",
        selectedTitle: officialTitle,
        generatedById: adminId,
        generatedAt: new Date(),
      },
    });
  }
  if (
    !(await prisma.researchVariableForm.findFirst({
      where: { thesisId: fThesis.id },
    }))
  ) {
    await prisma.researchVariableForm.create({
      data: {
        thesisId: fThesis.id,
        status: "PENDING",
        hasAllSignatures: false,
      },
    });
  }

  // G) revision-blocked@
  const pG = pickMasters(6);
  const g = await ensureStudent({
    email: "revision-blocked@earist.edu.ph",
    first: "Ria",
    last: "Revision",
    studentNumber: "2026-1007",
    program: pG,
    compExam: "PASSED",
  });
  const gThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: g.student.id },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: g.student.id,
        stage: "TITLE",
        status: "REVISION",
        outcome: "REVISION_REQUIRED",
        orNumber: "OR-2026-1007T",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1007T",
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: gThesis.id },
    data: { stage: "TITLE", status: "REVISION", outcome: "REVISION_REQUIRED" },
  });
  await ensureTitles(gThesis.id);
  await ensureStageDocsWithPdfs({
    thesisId: gThesis.id,
    defenseStage: "TITLE",
    studentName: "Ria Revision",
    studentNumber: "2026-1007",
    programName: pG.programName,
    uploaderUserId: g.user.id,
    orNumber: "OR-2026-1007T",
  });
  await ensureConcludedPriorDefense({
    thesisId: gThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-07-22T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/revision",
    outcome: "REVISION_REQUIRED",
  });

  // H) final-ready@
  const pH = pickMasters(7);
  const h = await ensureStudent({
    email: "final-ready@earist.edu.ph",
    first: "Finn",
    last: "Final",
    studentNumber: "2026-1008",
    program: pH,
    compExam: "PASSED",
  });
  let hAssignment = await prisma.adviserAssignment.findFirst({
    where: { studentId: h.student.id, isActive: true },
  });
  if (!hAssignment && adviser) {
    hAssignment = await prisma.adviserAssignment.create({
      data: {
        studentId: h.student.id,
        adviserId: adviser.id,
        assignedDate: new Date("2026-07-01T00:00:00.000Z"),
        isActive: true,
      },
    });
  }
  const hThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: h.student.id },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: h.student.id,
        assignmentId: hAssignment?.id ?? null,
        stage: "FINAL",
        status: "APPROVED",
        orNumber: "OR-2026-1008F",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1008T",
        proposalOrNumber: "OR-2026-1008P",
        finalOrNumber: "OR-2026-1008F",
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: hThesis.id },
    data: {
      stage: "FINAL",
      status: "APPROVED",
      outcome: null,
      assignmentId: hAssignment?.id ?? hThesis.assignmentId,
      orNumber: "OR-2026-1008F",
      amountPaid: 900,
      titleOrNumber: "OR-2026-1008T",
      proposalOrNumber: "OR-2026-1008P",
      finalOrNumber: "OR-2026-1008F",
    },
  });
  await ensureTitles(hThesis.id, officialTitle);
  await ensureStageDocsWithPdfs({
    thesisId: hThesis.id,
    defenseStage: "PROPOSAL",
    studentName: "Finn Final",
    studentNumber: "2026-1008",
    programName: pH.programName,
    uploaderUserId: h.user.id,
    manuscriptTitle: officialTitle,
    orNumber: "OR-2026-1008P",
  });
  const hSelectedTitleId = await resolveSelectedTitleId(hThesis.id, officialTitle);
  await ensureConcludedPriorDefense({
    thesisId: hThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-06-15T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/title-past-h",
    outcome: "PASSED",
    selectedTitleId: hSelectedTitleId,
  });
  await cancelNonCancelledSchedules(hThesis.id, "FINAL_DEFENSE");
  const hPropSched = await ensureConcludedPriorDefense({
    thesisId: hThesis.id,
    defenseType: "PROPOSAL_DEFENSE",
    defenseDate: "2026-08-10T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/proposal-past",
    outcome: "PASSED",
  });
  if (
    !(await prisma.rapReport.findFirst({
      where: { thesisId: hThesis.id, defenseType: "PROPOSAL_DEFENSE" },
    }))
  ) {
    await prisma.rapReport.create({
      data: {
        scheduleId: hPropSched.id,
        thesisId: hThesis.id,
        defenseType: "PROPOSAL_DEFENSE",
        status: "FINALIZED",
        selectedTitle: officialTitle,
        generatedById: adminId,
        generatedAt: new Date(),
      },
    });
  }
  const hFinalDocId = await ensureStageDocsWithPdfs({
    thesisId: hThesis.id,
    defenseStage: "FINAL",
    studentName: "Finn Final",
    studentNumber: "2026-1008",
    programName: pH.programName,
    uploaderUserId: h.user.id,
    manuscriptTitle: officialTitle,
    orNumber: "OR-2026-1008F",
  });
  const hCert = await prisma.adviserCertification.findFirst({
    where: { thesisId: hThesis.id, defenseStage: "FINAL_DEFENSE" },
  });
  if (!hCert && adviser) {
    await prisma.adviserCertification.create({
      data: {
        thesisId: hThesis.id,
        adviserId: adviser.id,
        defenseStage: "FINAL_DEFENSE",
        status: "ISSUED",
        reviewedDocumentId: hFinalDocId,
        signatureData,
        signedAt: new Date("2026-08-15T00:00:00.000Z"),
        certifiedAt: new Date("2026-08-15T00:00:00.000Z"),
      },
    });
  }
  await cancelNonCancelledSchedules(hThesis.id, "FINAL_DEFENSE");

  // K) proposal-review-pending@
  const pK = pickMasters(8);
  const k = await ensureStudent({
    email: "proposal-review-pending@earist.edu.ph",
    first: "Pat",
    last: "Review",
    studentNumber: "2026-1011",
    program: pK,
    compExam: "PASSED",
  });
  let kAssignment = await prisma.adviserAssignment.findFirst({
    where: { studentId: k.student.id, isActive: true },
  });
  if (!kAssignment && adviser) {
    kAssignment = await prisma.adviserAssignment.create({
      data: {
        studentId: k.student.id,
        adviserId: adviser.id,
        assignedDate: new Date("2026-07-01T00:00:00.000Z"),
        isActive: true,
      },
    });
  }
  const kThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: k.student.id },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: k.student.id,
        assignmentId: kAssignment?.id ?? null,
        stage: "PROPOSAL",
        status: "PENDING",
        orNumber: "OR-2026-1011P",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1011T",
        proposalOrNumber: "OR-2026-1011P",
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: kThesis.id },
    data: {
      stage: "PROPOSAL",
      status: "PENDING",
      outcome: null,
      assignmentId: kAssignment?.id ?? kThesis.assignmentId,
      orNumber: "OR-2026-1011P",
      amountPaid: 900,
      titleOrNumber: "OR-2026-1011T",
      proposalOrNumber: "OR-2026-1011P",
    },
  });
  await ensureTitles(kThesis.id, officialTitle);
  await ensureStageDocsWithPdfs({
    thesisId: kThesis.id,
    defenseStage: "TITLE",
    studentName: "Pat Review",
    studentNumber: "2026-1011",
    programName: pK.programName,
    uploaderUserId: k.user.id,
    orNumber: "OR-2026-1011T",
  });
  const kSelectedTitleId = await resolveSelectedTitleId(kThesis.id, officialTitle);
  const kTitleSched = await ensureConcludedPriorDefense({
    thesisId: kThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-07-18T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/title-k",
    outcome: "PASSED",
    selectedTitleId: kSelectedTitleId,
  });
  await cancelNonCancelledSchedules(kThesis.id, "PROPOSAL_DEFENSE");
  if (
    !(await prisma.rapReport.findFirst({
      where: { thesisId: kThesis.id, defenseType: "TITLE_DEFENSE" },
    }))
  ) {
    await prisma.rapReport.create({
      data: {
        scheduleId: kTitleSched.id,
        thesisId: kThesis.id,
        defenseType: "TITLE_DEFENSE",
        status: "FINALIZED",
        selectedTitle: officialTitle,
        generatedById: adminId,
        generatedAt: new Date(),
      },
    });
  }
  const kPropDocId = await ensureStageDocsWithPdfs({
    thesisId: kThesis.id,
    defenseStage: "PROPOSAL",
    studentName: "Pat Review",
    studentNumber: "2026-1011",
    programName: pK.programName,
    uploaderUserId: k.user.id,
    manuscriptTitle: officialTitle,
    orNumber: "OR-2026-1011P",
  });
  if (
    adviser &&
    !(await prisma.adviserCertification.findFirst({
      where: { thesisId: kThesis.id, defenseStage: "PROPOSAL_DEFENSE" },
    }))
  ) {
    await prisma.adviserCertification.create({
      data: {
        thesisId: kThesis.id,
        adviserId: adviser.id,
        defenseStage: "PROPOSAL_DEFENSE",
        status: "ISSUED",
        reviewedDocumentId: kPropDocId,
        signatureData,
        signedAt: new Date("2026-07-25T00:00:00.000Z"),
        certifiedAt: new Date("2026-07-25T00:00:00.000Z"),
      },
    });
  }
  const kVars = await prisma.researchVariableForm.findFirst({
    where: { thesisId: kThesis.id },
  });
  if (!kVars) {
    await prisma.researchVariableForm.create({
      data: {
        thesisId: kThesis.id,
        status: "NOT_APPLICABLE",
        hasAllSignatures: true,
        approvedAt: new Date("2026-07-25T00:00:00.000Z"),
      },
    });
  } else {
    await prisma.researchVariableForm.update({
      where: { id: kVars.id },
      data: { status: "NOT_APPLICABLE", hasAllSignatures: true },
    });
  }

  // L) final-review-pending@
  const pL = pickMasters(9);
  const l = await ensureStudent({
    email: "final-review-pending@earist.edu.ph",
    first: "Fay",
    last: "Review",
    studentNumber: "2026-1012",
    program: pL,
    compExam: "PASSED",
  });
  let lAssignment = await prisma.adviserAssignment.findFirst({
    where: { studentId: l.student.id, isActive: true },
  });
  if (!lAssignment && adviser) {
    lAssignment = await prisma.adviserAssignment.create({
      data: {
        studentId: l.student.id,
        adviserId: adviser.id,
        assignedDate: new Date("2026-07-01T00:00:00.000Z"),
        isActive: true,
      },
    });
  }
  const lThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: l.student.id },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: l.student.id,
        assignmentId: lAssignment?.id ?? null,
        stage: "FINAL",
        status: "PENDING",
        orNumber: "OR-2026-1012F",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1012T",
        proposalOrNumber: "OR-2026-1012P",
        finalOrNumber: "OR-2026-1012F",
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: lThesis.id },
    data: {
      stage: "FINAL",
      status: "PENDING",
      outcome: null,
      assignmentId: lAssignment?.id ?? lThesis.assignmentId,
      orNumber: "OR-2026-1012F",
      amountPaid: 900,
      titleOrNumber: "OR-2026-1012T",
      proposalOrNumber: "OR-2026-1012P",
      finalOrNumber: "OR-2026-1012F",
    },
  });
  await ensureTitles(lThesis.id, officialTitle);
  const lSelectedTitleId = await resolveSelectedTitleId(lThesis.id, officialTitle);
  const lTitleSched = await ensureConcludedPriorDefense({
    thesisId: lThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-06-10T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/title-l",
    outcome: "PASSED",
    selectedTitleId: lSelectedTitleId,
  });
  const lPropSched = await ensureConcludedPriorDefense({
    thesisId: lThesis.id,
    defenseType: "PROPOSAL_DEFENSE",
    defenseDate: "2026-08-12T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/prop-l",
    outcome: "PASSED",
  });
  await cancelNonCancelledSchedules(lThesis.id, "FINAL_DEFENSE");
  if (
    !(await prisma.rapReport.findFirst({
      where: { thesisId: lThesis.id, defenseType: "TITLE_DEFENSE" },
    }))
  ) {
    await prisma.rapReport.create({
      data: {
        scheduleId: lTitleSched.id,
        thesisId: lThesis.id,
        defenseType: "TITLE_DEFENSE",
        status: "FINALIZED",
        selectedTitle: officialTitle,
        generatedById: adminId,
        generatedAt: new Date(),
      },
    });
  }
  if (
    !(await prisma.rapReport.findFirst({
      where: { thesisId: lThesis.id, defenseType: "PROPOSAL_DEFENSE" },
    }))
  ) {
    await prisma.rapReport.create({
      data: {
        scheduleId: lPropSched.id,
        thesisId: lThesis.id,
        defenseType: "PROPOSAL_DEFENSE",
        status: "FINALIZED",
        selectedTitle: officialTitle,
        generatedById: adminId,
        generatedAt: new Date(),
      },
    });
  }
  const lFinalDocId = await ensureStageDocsWithPdfs({
    thesisId: lThesis.id,
    defenseStage: "FINAL",
    studentName: "Fay Review",
    studentNumber: "2026-1012",
    programName: pL.programName,
    uploaderUserId: l.user.id,
    manuscriptTitle: officialTitle,
    orNumber: "OR-2026-1012F",
  });
  if (
    adviser &&
    !(await prisma.adviserCertification.findFirst({
      where: { thesisId: lThesis.id, defenseStage: "FINAL_DEFENSE" },
    }))
  ) {
    await prisma.adviserCertification.create({
      data: {
        thesisId: lThesis.id,
        adviserId: adviser.id,
        defenseStage: "FINAL_DEFENSE",
        status: "ISSUED",
        reviewedDocumentId: lFinalDocId,
        signatureData,
        signedAt: new Date("2026-08-15T00:00:00.000Z"),
        certifiedAt: new Date("2026-08-15T00:00:00.000Z"),
      },
    });
  }

  // I) scores-awaiting@ — Future-dated upcoming session awaiting formal conclusion
  const pI = pickMasters(10);
  const i = await ensureStudent({
    email: "scores-awaiting@earist.edu.ph",
    first: "Sam",
    last: "Scores",
    studentNumber: "2026-1009",
    program: pI,
    compExam: "PASSED",
  });
  const iThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: i.student.id },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: i.student.id,
        stage: "TITLE",
        status: "SCHEDULED",
        outcome: null,
        orNumber: "OR-2026-1009T",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1009T",
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: iThesis.id },
    data: { stage: "TITLE", status: "SCHEDULED", outcome: null },
  });
  await prisma.defenseSchedule.updateMany({
    where: {
      thesisId: iThesis.id,
      defenseType: "TITLE_DEFENSE",
      sessionStatus: { notIn: ["AWAITING_CONCLUSION", "CANCELLED"] },
    },
    data: { sessionStatus: "CANCELLED" },
  });
  await ensureTitles(iThesis.id);
  await ensureStageDocsWithPdfs({
    thesisId: iThesis.id,
    defenseStage: "TITLE",
    studentName: "Sam Scores",
    studentNumber: "2026-1009",
    programName: pI.programName,
    uploaderUserId: i.user.id,
    orNumber: "OR-2026-1009T",
  });

  const awaitingDate = futureUtcDate(7);
  let iSched = await prisma.defenseSchedule.findFirst({
    where: {
      thesisId: iThesis.id,
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "AWAITING_CONCLUSION",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!iSched) {
    iSched = await prisma.defenseSchedule.create({
      data: {
        thesisId: iThesis.id,
        defenseDate: awaitingDate,
        defenseTime: utcTime(10),
        venueOrLink:
          "https://teams.microsoft.com/l/meetup-join/awaiting-conclude",
        defenseType: "TITLE_DEFENSE",
        setById: adminId,
        sessionStatus: "AWAITING_CONCLUSION",
      },
    });
    const roster: Array<{
      email: string;
      role: "CHAIRMAN" | "PANELIST" | "FACILITATOR" | "RAPPORTEUR";
    }> = [
      { email: "panelist1@earist.edu.ph", role: "CHAIRMAN" },
      { email: "panelist2@earist.edu.ph", role: "PANELIST" },
      { email: "panelist3@earist.edu.ph", role: "PANELIST" },
      { email: "panelist4@earist.edu.ph", role: "PANELIST" },
      { email: "panelist5@earist.edu.ph", role: "PANELIST" },
      { email: "panelist6@earist.edu.ph", role: "FACILITATOR" },
      { email: "panelist7@earist.edu.ph", role: "RAPPORTEUR" },
    ];
    for (const seat of roster) {
      const uid = panelistUsers[seat.email];
      if (!uid) continue;
      const panel = await prisma.panelAssignment.create({
        data: { scheduleId: iSched.id, userId: uid, role: seat.role },
      });
      if (seat.role === "CHAIRMAN" || seat.role === "PANELIST") {
        await prisma.oralExamScore.create({
          data: {
            panelId: panel.id,
            scheduleId: iSched.id,
            timelinessRelevance: 1.25,
            organization: 1.5,
            depthComprehensiveness: 1.5,
            relevanceConclusions: 1.5,
            evidenceOriginalThinking: 1.25,
            groupAAverage: 1.4,
            presentation: 1.5,
            masterySubject: 1.5,
            communicationSkill: 1.5,
            attitude: 1.0,
            groupBAverage: 1.4,
            overallAverage: 1.4,
            rating: "HS",
            recommendations: "Solid proposal direction.",
            scoredAt: new Date(),
          },
        });
      }
    }
  } else {
    await prisma.defenseSchedule.update({
      where: { id: iSched.id },
      data: { defenseDate: awaitingDate },
    });
  }

  // J) doctoral-ready@ (DBA)
  const j = await ensureStudent({
    email: "doctoral-ready@earist.edu.ph",
    first: "Doc",
    last: "Toral",
    studentNumber: "2026-1010",
    program: doctoral,
    compExam: "PASSED",
  });
  const jThesis =
    (await prisma.thesisRecord.findFirst({
      where: { studentId: j.student.id },
    })) ??
    (await prisma.thesisRecord.create({
      data: {
        studentId: j.student.id,
        stage: "TITLE",
        status: "APPROVED",
        orNumber: "OR-2026-1010T",
        amountPaid: 900,
        titleOrNumber: "OR-2026-1010T",
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: jThesis.id },
    data: { stage: "TITLE", status: "APPROVED", outcome: null },
  });
  await cancelNonCancelledSchedules(jThesis.id, "TITLE_DEFENSE");
  await ensureTitles(jThesis.id);
  await ensureStageDocsWithPdfs({
    thesisId: jThesis.id,
    defenseStage: "TITLE",
    studentName: "Doc Toral",
    studentNumber: "2026-1010",
    programName: doctoral.programName,
    uploaderUserId: j.user.id,
    orNumber: "OR-2026-1010T",
  });

  // K) title-qa@
  await ensureStudent({
    email: "title-qa@earist.edu.ph",
    first: "Quincy",
    last: "Titleqa",
    studentNumber: "2026-1013",
    program: pickMasters(11),
    compExam: "PASSED",
  });

  console.log("Defense workflow refactor fixtures ready (password123).");
}

/**
 * UIUX essay-grading review fixture bound cleanly to MBA (no extra fake program).
 */
async function seedEssayGradingReviewFixture(
  passwordHash: string,
  program: Program,
  essayQuestionId: string,
) {
  const FIXTURE_EMAIL = "uiux.essay.fixture@earist.edu.ph";
  const FIXTURE_PINNACLE = "PIN-UIUX-GRADE-001";
  const FIXTURE_SLOT_DATE = futureUtcDate(-1);
  const FIXTURE_SLOT_TIME = utcTime(9);
  const FIXTURE_ESSAY_RESPONSE = [
    "Graduate research has reshaped how I approach my work. Rather than relying on habit or seniority, I now frame everyday problems as questions, gather evidence before acting, and treat my first explanation as a hypothesis to be tested rather than a conclusion to defend.",
    "Engaging with the literature taught me to read critically and to separate strong evidence from claims that are merely persuasive. In my current role this has changed how I mentor colleagues: instead of handing down answers, I help them articulate a question clearly, choose a small measurable change, and interpret the result honestly, including when it contradicts what we expected.",
    "The discipline of writing has been just as formative. Drafting and revising the same argument across several versions forced me to notice gaps in my reasoning and to make my language more precise. I carry that habit into reports and briefings, where I now distinguish clearly between what the data show and what I still need to verify.",
    "I expect this research to continue that growth. My goal is not only to complete the study, but to build a repeatable practice of inquiry that improves how my team and I make decisions long after the project ends.",
  ].join("\n\n");

  let slot = await prisma.examSlot.findFirst({
    where: {
      programId: program.id,
      examDate: FIXTURE_SLOT_DATE,
      examTime: FIXTURE_SLOT_TIME,
    },
  });
  if (!slot) {
    slot = await prisma.examSlot.create({
      data: {
        programId: program.id,
        examDate: FIXTURE_SLOT_DATE,
        examTime: FIXTURE_SLOT_TIME,
        maxSlots: 20,
        isActive: true,
      },
    });
  }

  const fixtureUser = await prisma.user.upsert({
    where: { email: FIXTURE_EMAIL },
    update: { firstName: "Elena", lastName: "Magsino", role: "APPLICANT" },
    create: {
      email: FIXTURE_EMAIL,
      passwordHash,
      firstName: "Elena",
      lastName: "Magsino",
      role: "APPLICANT",
      student: {
        create: {
          pinnacleApplicantId: FIXTURE_PINNACLE,
          programId: program.id,
          admissionStatus: "APPLICANT",
        },
      },
    },
  });
  const fixtureStudent = await prisma.student.update({
    where: { userId: fixtureUser.id },
    data: {
      pinnacleApplicantId: FIXTURE_PINNACLE,
      programId: program.id,
      admissionStatus: "APPLICANT",
    },
  });

  const existingApplication = await prisma.entranceExamApplication.findFirst({
    where: { studentId: fixtureStudent.id, seatReleasedAt: null },
  });
  const application = existingApplication
    ? await prisma.entranceExamApplication.update({
        where: { id: existingApplication.id },
        data: {
          programId: program.id,
          slotId: slot.id,
          examDate: FIXTURE_SLOT_DATE,
          examTime: FIXTURE_SLOT_TIME,
          status: "TAKEN",
        },
      })
    : await prisma.entranceExamApplication.create({
        data: {
          studentId: fixtureStudent.id,
          programId: program.id,
          slotId: slot.id,
          examDate: FIXTURE_SLOT_DATE,
          examTime: FIXTURE_SLOT_TIME,
          status: "TAKEN",
        },
      });

  await prisma.entranceExamScore.upsert({
    where: { applicationId: application.id },
    update: {
      multipleChoiceScore: 18,
      essayScore: null,
      totalScore: null,
      status: "PENDING",
      gradedById: null,
    },
    create: {
      applicationId: application.id,
      multipleChoiceScore: 18,
      essayScore: null,
      totalScore: null,
      status: "PENDING",
    },
  });

  await prisma.applicantAnswer.upsert({
    where: {
      applicationId_questionId: {
        applicationId: application.id,
        questionId: essayQuestionId,
      },
    },
    update: { essayAnswer: FIXTURE_ESSAY_RESPONSE },
    create: {
      applicationId: application.id,
      questionId: essayQuestionId,
      essayAnswer: FIXTURE_ESSAY_RESPONSE,
    },
  });

  console.log("UIUX essay-grading review fixture ready.");
  console.log(`  Applicant : ${FIXTURE_EMAIL} (password123) -> MBA`);
  console.log(`  Pinnacle  : ${FIXTURE_PINNACLE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
