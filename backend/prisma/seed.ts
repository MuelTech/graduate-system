import prisma from "../src/config/database";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding programs...");

  // Graduate Programs
  const programs = [
    // DOCTORAL PROGRAMS
    {
      programName: "Doctor of Philosophy in Industrial Psychology",
      programType: "DOCTORAL",
      department: "College of Arts and Sciences",
      maxResidencyYears: 7,
    },
    {
      programName: "Doctor of Education Major in Educational Management",
      programType: "DOCTORAL",
      department: "College of Education",
      maxResidencyYears: 7,
    },
    {
      programName: "Doctor in Business Administration",
      programType: "DOCTORAL",
      department: "College of Business Administration",
      maxResidencyYears: 7,
    },
    {
      programName: "Doctor in Public Administration",
      programType: "DOCTORAL",
      department: "College of Public Administration",
      maxResidencyYears: 7,
    },

    // MASTERS PROGRAMS
    {
      programName: "Master of Science in Mathematics",
      programType: "MASTERS",
      department: "College of Arts and Sciences",
      maxResidencyYears: 5,
    },
    {
      programName: "Master of Arts in Industrial Psychology",
      programType: "MASTERS",
      department: "College of Arts and Sciences",
      maxResidencyYears: 5,
    },
    {
      programName: "Master in Business Administration",
      programType: "MASTERS",
      department: "College of Business Administration",
      maxResidencyYears: 5,
    },
    {
      programName: "Master in Public Administration",
      programType: "MASTERS",
      department: "College of Public Administration",
      maxResidencyYears: 5,
    },
    {
      programName:
        "Master of Arts in Industrial Education Major in: Hotel and Restaurant Management",
      programType: "MASTERS",
      department: "College of Education",
      maxResidencyYears: 5,
    },

    // Master of Arts in Education
    {
      programName:
        "Master of Arts in Education Major in: Administration and Supervision",
      programType: "MASTERS",
      department: "College of Education",
      maxResidencyYears: 5,
    },
    {
      programName:
        "Master of Arts in Education Major in: Guidance and Counseling",
      programType: "MASTERS",
      department: "College of Education",
      maxResidencyYears: 5,
    },
    {
      programName: "Master of Arts in Education Major in: Special Education",
      programType: "MASTERS",
      department: "College of Education",
      maxResidencyYears: 5,
    },

    // Master of Arts in Teaching (MAT)
    {
      programName:
        "Master of Arts in Teaching (MAT) Major in: Electronics Technology",
      programType: "MASTERS",
      department: "College of Education",
      maxResidencyYears: 5,
    },
    {
      programName:
        "Master of Arts in Teaching (MAT) Major in: Electrical Technology",
      programType: "MASTERS",
      department: "College of Education",
      maxResidencyYears: 5,
    },
    {
      programName: "Master of Arts in Teaching (MAT) Major in: Mathematics",
      programType: "MASTERS",
      department: "College of Education",
      maxResidencyYears: 5,
    },
    {
      programName: "Master of Arts in Teaching (MAT) Major in: Science",
      programType: "MASTERS",
      department: "College of Education",
      maxResidencyYears: 5,
    },
  ];

  for (const p of programs) {
    const existing = await prisma.program.findFirst({
      where: { programName: p.programName },
    });

    if (!existing) {
      await prisma.program.create({
        data: p as any,
      });
      console.log(`Created graduate program: ${p.programName}`);
    } else {
      console.log(`Graduate program already exists: ${p.programName}`);
    }
  }

  // Undergraduate Programs
  const ugPrograms = [
    // College of Accountancy and Finance (CAF)
    {
      programName: "Bachelor of Science in Accountancy",
      acronym: "BSA",
      college: "College of Accountancy and Finance (CAF)",
    },
    {
      programName: "Bachelor of Science in Management Accounting",
      acronym: "BSMA",
      college: "College of Accountancy and Finance (CAF)",
    },
    {
      programName:
        "Bachelor of Science in Business Administration: Major in Financial Management",
      acronym: "BSBAFM",
      college: "College of Accountancy and Finance (CAF)",
    },

    // College of Architecture, Design and the Built Environment (CADBE)
    {
      programName: "Bachelor of Science in Architecture",
      acronym: "BS-ARCH",
      college:
        "College of Architecture, Design and the Built Environment (CADBE)",
    },
    {
      programName: "Bachelor of Science in Interior Design",
      acronym: "BSID",
      college:
        "College of Architecture, Design and the Built Environment (CADBE)",
    },
    {
      programName: "Bachelor of Science in Environmental Planning",
      acronym: "BSEP",
      college:
        "College of Architecture, Design and the Built Environment (CADBE)",
    },

    // College of Arts and Letters (CAL)
    {
      programName: "Bachelor of Arts in English Language Studies",
      acronym: "ABELS",
      college: "College of Arts and Letters (CAL)",
    },
    {
      programName: "Bachelor of Arts in Filipinology",
      acronym: "ABF",
      college: "College of Arts and Letters (CAL)",
    },
    {
      programName: "Bachelor of Arts in Literary and Cultural Studies",
      acronym: "ABLCS",
      college: "College of Arts and Letters (CAL)",
    },
    {
      programName: "Bachelor of Arts in Philosophy",
      acronym: "AB-PHILO",
      college: "College of Arts and Letters (CAL)",
    },
    {
      programName: "Bachelor of Performing Arts: Major in Theater Arts",
      acronym: "BPEA",
      college: "College of Arts and Letters (CAL)",
    },

    // College of Business Administration (CBA)
    {
      programName:
        "Bachelor of Science in Business Administration: Major in Human Resource Management",
      acronym: "BSBAHRM",
      college: "College of Business Administration (CBA)",
    },
    {
      programName:
        "Bachelor of Science in Business Administration: Major in Marketing Management",
      acronym: "BSBA-MM",
      college: "College of Business Administration (CBA)",
    },
    {
      programName: "Bachelor of Science in Entrepreneurship",
      acronym: "BSENTREP",
      college: "College of Business Administration (CBA)",
    },
    {
      programName: "Bachelor of Science in Office Administration",
      acronym: "BSOA",
      college: "College of Business Administration (CBA)",
    },

    // College of Communication (COC)
    {
      programName: "Bachelor in Advertising and Public Relations",
      acronym: "BADPR",
      college: "College of Communication (COC)",
    },
    {
      programName: "Bachelor of Arts in Broadcasting",
      acronym: "BA Broadcasting",
      college: "College of Communication (COC)",
    },
    {
      programName: "Bachelor of Arts in Communication Research",
      acronym: "BACR",
      college: "College of Communication (COC)",
    },
    {
      programName: "Bachelor of Arts in Journalism",
      acronym: "BAJ",
      college: "College of Communication (COC)",
    },

    // College of Computer and Information Sciences (CCIS)
    {
      programName: "Bachelor of Science in Computer Science",
      acronym: "BSCS",
      college: "College of Computer and Information Sciences (CCIS)",
    },
    {
      programName: "Bachelor of Science in Information Technology",
      acronym: "BSIT",
      college: "College of Computer and Information Sciences (CCIS)",
    },

    // College of Education (COED)
    {
      programName:
        "Bachelor of Business Technology and Livelihood Education: Major in Home Economics",
      acronym: "BBTLEHE",
      college: "College of Education (COED)",
    },
    {
      programName:
        "Bachelor of Business Technology and Livelihood Education: Major in Industrial Arts",
      acronym: "BBTLEIA",
      college: "College of Education (COED)",
    },
    {
      programName:
        "Bachelor of Business Technology and Livelihood Education: Major in Information and Communication Technology",
      acronym: "BBTLEDICT",
      college: "College of Education (COED)",
    },
    {
      programName: "Bachelor of Early Childhood Education",
      acronym: "BECED",
      college: "College of Education (COED)",
    },
    {
      programName: "Bachelor of Elementary Education",
      acronym: "BEED",
      college: "College of Education (COED)",
    },
    {
      programName: "Bachelor of Secondary Education: Major in English",
      acronym: "BSEDEN",
      college: "College of Education (COED)",
    },
    {
      programName: "Bachelor of Secondary Education: Major in Filipino",
      acronym: "BSEDFL",
      college: "College of Education (COED)",
    },
    {
      programName: "Bachelor of Secondary Education: Major in Mathematics",
      acronym: "BSEDMT",
      college: "College of Education (COED)",
    },
    {
      programName: "Bachelor of Secondary Education: Major in Science",
      acronym: "BSEDSC",
      college: "College of Education (COED)",
    },
    {
      programName: "Bachelor of Secondary Education: Major in Social Studies",
      acronym: "BSEDSS",
      college: "College of Education (COED)",
    },

    // College of Engineering (CE)
    {
      programName: "Bachelor of Science in Civil Engineering",
      acronym: "BSCE",
      college: "College of Engineering (CE)",
    },
    {
      programName: "Bachelor of Science in Computer Engineering",
      acronym: "BSCOE",
      college: "College of Engineering (CE)",
    },
    {
      programName: "Bachelor of Science in Electrical Engineering",
      acronym: "BSEE",
      college: "College of Engineering (CE)",
    },
    {
      programName: "Bachelor of Science in Electronics Engineering",
      acronym: "BS-ECE",
      college: "College of Engineering (CE)",
    },
    {
      programName: "Bachelor of Science in Industrial Engineering",
      acronym: "BSIE",
      college: "College of Engineering (CE)",
    },
    {
      programName: "Bachelor of Science in Mechanical Engineering",
      acronym: "BSME",
      college: "College of Engineering (CE)",
    },
    {
      programName: "Bachelor of Science in Railway Engineering",
      acronym: "BSRE",
      college: "College of Engineering (CE)",
    },

    // College of Human Kinetics (CHK)
    {
      programName: "Bachelor of Physical Education",
      acronym: "BPE",
      college: "College of Human Kinetics (CHK)",
    },
    {
      programName: "Bachelor of Science in Exercises and Sports",
      acronym: "BSESS",
      college: "College of Human Kinetics (CHK)",
    },
  ];

  for (const ug of ugPrograms) {
    const existingUG = await prisma.undergraduateProgram.findFirst({
      where: { programName: ug.programName },
    });

    if (!existingUG) {
      await prisma.undergraduateProgram.create({
        data: ug,
      });
      console.log(`Created undergraduate program: ${ug.programName}`);
    } else {
      console.log(`Undergraduate program already exists: ${ug.programName}`);
    }
  }

  console.log("All programs seeded successfully!");

  console.log("Seeding test accounts...");
  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Admin Test Account
  await prisma.user.upsert({
    where: { email: "admin@earist.edu.ph" },
    update: {},
    create: {
      email: "admin@earist.edu.ph",
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      role: "ADMIN",
    },
  });
  console.log("Created Admin test account");

  // 2. Panelists Test Account
  await prisma.user.upsert({
    where: { email: "panelist1@earist.edu.ph" },
    update: {},
    create: {
      email: "panelist1@earist.edu.ph",
      passwordHash,
      firstName: "Dr. John",
      lastName: "Doe",
      role: "PANELIST",
      panelist: {
        create: {
          isExternal: false,
          isAvailableAsAdviser: true,
        },
      },
    },
  });
  console.log("Created Panelist1 test account");

  await prisma.user.upsert({
    where: { email: "panelist2@earist.edu.ph" },
    update: {},
    create: {
      email: "panelist2@earist.edu.ph",
      passwordHash,
      firstName: "Prof. William",
      lastName: "Marcial",
      role: "PANELIST",
      panelist: {
        create: {
          isExternal: false,
          isAvailableAsAdviser: true,
        },
      },
    },
  });
  console.log("Created Panelist2 test account");

  await prisma.user.upsert({
    where: { email: "panelist3@earist.edu.ph" },
    update: {},
    create: {
      email: "panelist3@earist.edu.ph",
      passwordHash,
      firstName: "Prof. Hanna Mae",
      lastName: "Perdido",
      role: "PANELIST",
      panelist: {
        create: {
          isExternal: false,
          isAvailableAsAdviser: true,
        },
      },
    },
  });
  console.log("Created Panelist3 test account");

  // 3. Enrolled Student Test Accounts
  const firstProgram = await prisma.program.findFirst();
  const panelist1 = await prisma.user.findUnique({
    where: { email: "panelist1@earist.edu.ph" },
  });

  if (firstProgram && panelist1) {
    // Student 1 - Jane Smith (enrolled, comp exam passed, thesis in progress)
    const student1 = await prisma.user.upsert({
      where: { email: "student@earist.edu.ph" },
      update: {},
      create: {
        email: "student@earist.edu.ph",
        passwordHash,
        firstName: "Jane",
        lastName: "Smith",
        role: "STUDENT",
        student: {
          create: {
            studentNumber: "2026-0001",
            dateOfBirth: new Date("1995-05-15T00:00:00.000Z"),
            programId: firstProgram.id,
            admissionStatus: "ENROLLED",
            enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
            residencyStartDate: new Date("2026-06-01T00:00:00.000Z"),
            curriculumType: "NEW",
            alignmentStatus: "ALIGNED",
          },
        },
      },
    });
    console.log("Created Student 1 (Jane Smith)");

    // Add comprehensive exam record for Student 1
    const student1Record = await prisma.student.findUnique({
      where: { userId: student1.id },
    });
    if (student1Record) {
      const existingCompExam = await prisma.compExamRecord.findFirst({
        where: { studentId: student1Record.id, status: "PASSED" },
      });
      if (!existingCompExam) {
        await prisma.compExamRecord.create({
          data: {
            studentId: student1Record.id,
            status: "PASSED",
          },
        });
        console.log("Created Comp Exam record for Student 1 (PASSED)");
      }

      // Add thesis record for Student 1
      const adviserAssignment =
        (await prisma.adviserAssignment.findFirst({
          where: {
            studentId: student1Record.id,
            adviserId: panelist1.id,
            isActive: true,
          },
        })) ||
        (await prisma.adviserAssignment.create({
          data: {
            studentId: student1Record.id,
            adviserId: panelist1.id,
            assignedDate: new Date("2026-06-15T00:00:00.000Z"),
            isActive: true,
          },
        }));

      const existingThesis = await prisma.thesisRecord.findFirst({
        where: {
          studentId: student1Record.id,
          assignmentId: adviserAssignment.id,
          stage: "PROPOSAL",
        },
      });
      if (!existingThesis) {
        await prisma.thesisRecord.create({
          data: {
            studentId: student1Record.id,
            assignmentId: adviserAssignment.id,
            stage: "PROPOSAL",
            status: "PENDING",
          },
        });
        console.log("Created Thesis record for Student 1 (Proposal Defense)");
      }

      // Add residency tracking
      await prisma.residencyTracking.upsert({
        where: { studentId: student1Record.id },
        update: {},
        create: {
          studentId: student1Record.id,
          startDate: new Date("2026-06-01T00:00:00.000Z"),
          maxYears: 5,
        },
      });
      console.log("Ensured Residency Tracking for Student 1");
    }

    // Student 2 - Juan Dela Cruz (enrolled, comp exam failed once)
    const student2 = await prisma.user.upsert({
      where: { email: "student2@earist.edu.ph" },
      update: {},
      create: {
        email: "student2@earist.edu.ph",
        passwordHash,
        firstName: "Juan",
        lastName: "Dela Cruz",
        role: "STUDENT",
        student: {
          create: {
            studentNumber: "2026-0002",
            dateOfBirth: new Date("1998-03-20T00:00:00.000Z"),
            programId: firstProgram.id,
            admissionStatus: "ENROLLED",
            enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
            residencyStartDate: new Date("2026-06-01T00:00:00.000Z"),
            curriculumType: "OLD",
            alignmentStatus: "ALIGNED",
          },
        },
      },
    });
    console.log("Created Student 2 (Juan Dela Cruz)");

    // Add comprehensive exam record for Student 2 (1 strike)
    const student2Record = await prisma.student.findUnique({
      where: { userId: student2.id },
    });
    if (student2Record) {
      const existingCompExam = await prisma.compExamRecord.findFirst({
        where: { studentId: student2Record.id, status: "FAILED" },
      });
      if (!existingCompExam) {
        await prisma.compExamRecord.create({
          data: {
            studentId: student2Record.id,
            status: "FAILED",
          },
        });
        console.log("Created Comp Exam record for Student 2 (FAILED - 1 strike)");
      }
    }

    // Student 3 - Maria Santos (enrolled, no comp exam yet)
    await prisma.user.upsert({
      where: { email: "student3@earist.edu.ph" },
      update: {},
      create: {
        email: "student3@earist.edu.ph",
        passwordHash,
        firstName: "Maria",
        lastName: "Santos",
        role: "STUDENT",
        student: {
          create: {
            studentNumber: "2026-0003",
            dateOfBirth: new Date("1999-07-10T00:00:00.000Z"),
            programId: firstProgram.id,
            admissionStatus: "ENROLLED",
            enrollmentDate: new Date("2026-06-15T00:00:00.000Z"),
            residencyStartDate: new Date("2026-06-15T00:00:00.000Z"),
            curriculumType: "NEW",
            alignmentStatus: "ALIGNED",
          },
        },
      },
    });
    console.log("Created Student 3 (Maria Santos)");

    // Student 4 - Pedro Reyes (enrolled, comp exam failed twice - dismissed)
    const student4 = await prisma.user.upsert({
      where: { email: "student4@earist.edu.ph" },
      update: {},
      create: {
        email: "student4@earist.edu.ph",
        passwordHash,
        firstName: "Pedro",
        lastName: "Reyes",
        role: "STUDENT",
        student: {
          create: {
            studentNumber: "2026-0004",
            dateOfBirth: new Date("1997-11-25T00:00:00.000Z"),
            programId: firstProgram.id,
            admissionStatus: "DISMISSED",
            enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
            residencyStartDate: new Date("2026-06-01T00:00:00.000Z"),
            curriculumType: "NEW",
            alignmentStatus: "ALIGNED",
          },
        },
      },
    });
    console.log("Created Student 4 (Pedro Reyes - Dismissed)");

    // Add 2 failed comp exam records for Student 4
    const student4Record = await prisma.student.findUnique({
      where: { userId: student4.id },
    });
    if (student4Record) {
      let failedExamCount = await prisma.compExamRecord.count({
        where: { studentId: student4Record.id, status: "FAILED" },
      });
      while (failedExamCount < 2) {
        await prisma.compExamRecord.create({
          data: {
            studentId: student4Record.id,
            status: "FAILED",
          },
        });
        failedExamCount += 1;
      }
      console.log("Ensured 2 failed comp exam records for Student 4");
    }

    console.log("Created all Student test accounts");
  }

  // 4. Applicant Test Accounts
  const allPrograms = await prisma.program.findMany();
  const allUndergradPrograms = await prisma.undergraduateProgram.findMany();

  if (allPrograms.length > 0 && allUndergradPrograms.length > 0) {
    // Applicant 1 - Aligned, Exam Passed, COR Verified (eligible for promotion)
    await prisma.user.upsert({
      where: { email: "applicant1@earist.edu.ph" },
      update: {},
      create: {
        email: "applicant1@earist.edu.ph",
        passwordHash,
        firstName: "Juan",
        lastName: "Dela Cruz",
        role: "APPLICANT",
        student: {
          create: {
            cellphone: "+639171234567",
            dateOfBirth: new Date("1998-01-15T00:00:00.000Z"),
            pinnacleApplicantId: "PIN-2026-001",
            programId: allPrograms[0].id,
            undergraduateProgramId: allUndergradPrograms[0].id,
            admissionStatus: "APPLICANT",
            isProgramAligned: true,
            alignmentStatus: "ALIGNED",
          },
        },
      },
    });
    console.log("Created Applicant 1 (Aligned, eligible)");

    // Applicant 2 - Pending Waiver
    await prisma.user.upsert({
      where: { email: "applicant2@earist.edu.ph" },
      update: {},
      create: {
        email: "applicant2@earist.edu.ph",
        passwordHash,
        firstName: "Maria",
        lastName: "Santos",
        role: "APPLICANT",
        student: {
          create: {
            cellphone: "+639181234567",
            dateOfBirth: new Date("1999-03-20T00:00:00.000Z"),
            pinnacleApplicantId: "PIN-2026-002",
            programId: allPrograms[0].id,
            undergraduateProgramId:
              allUndergradPrograms.length > 1
                ? allUndergradPrograms[1].id
                : allUndergradPrograms[0].id,
            admissionStatus: "APPLICANT",
            isProgramAligned: false,
            alignmentStatus: "PENDING_WAIVER",
            bridgingWaiver: {
              create: {
                intendedProgramId: allPrograms[0].id,
                undergraduateProgramId:
                  allUndergradPrograms.length > 1
                    ? allUndergradPrograms[1].id
                    : allUndergradPrograms[0].id,
                status: "PENDING",
                waiverFormDownloadedAt: new Date(),
              },
            },
          },
        },
      },
    });
    console.log("Created Applicant 2 (Pending Waiver)");

    // Applicant 3 - Aligned, Exam Scheduled
    await prisma.user.upsert({
      where: { email: "applicant3@earist.edu.ph" },
      update: {},
      create: {
        email: "applicant3@earist.edu.ph",
        passwordHash,
        firstName: "Pedro",
        lastName: "Reyes",
        role: "APPLICANT",
        student: {
          create: {
            cellphone: "+639191234567",
            dateOfBirth: new Date("2000-06-10T00:00:00.000Z"),
            pinnacleApplicantId: "PIN-2026-003",
            programId:
              allPrograms.length > 1 ? allPrograms[1].id : allPrograms[0].id,
            undergraduateProgramId: allUndergradPrograms[0].id,
            admissionStatus: "APPLICANT",
            isProgramAligned: true,
            alignmentStatus: "ALIGNED",
          },
        },
      },
    });
    console.log("Created Applicant 3 (Aligned, Exam Scheduled)");

    // Applicant 4 - Cleared (waiver validated)
    await prisma.user.upsert({
      where: { email: "applicant4@earist.edu.ph" },
      update: {},
      create: {
        email: "applicant4@earist.edu.ph",
        passwordHash,
        firstName: "Ana",
        lastName: "Garcia",
        role: "APPLICANT",
        student: {
          create: {
            cellphone: "+639201234567",
            dateOfBirth: new Date("1997-09-25T00:00:00.000Z"),
            pinnacleApplicantId: "PIN-2026-004",
            programId: allPrograms[0].id,
            undergraduateProgramId:
              allUndergradPrograms.length > 2
                ? allUndergradPrograms[2].id
                : allUndergradPrograms[0].id,
            admissionStatus: "APPLICANT",
            isProgramAligned: false,
            alignmentStatus: "CLEARED",
            bridgingWaiver: {
              create: {
                intendedProgramId: allPrograms[0].id,
                undergraduateProgramId:
                  allUndergradPrograms.length > 2
                    ? allUndergradPrograms[2].id
                    : allUndergradPrograms[0].id,
                status: "VALIDATED",
                validatedAt: new Date(),
              },
            },
          },
        },
      },
    });
    console.log("Created Applicant 4 (Cleared)");

    // Applicants 5-12 for pagination testing
    const additionalApplicants = [
      {
        email: "applicant5@earist.edu.ph",
        firstName: "Carlos",
        lastName: "Mendoza",
        alignment: "ALIGNED" as const,
      },
      {
        email: "applicant6@earist.edu.ph",
        firstName: "Rosa",
        lastName: "Lim",
        alignment: "PENDING_WAIVER" as const,
      },
      {
        email: "applicant7@earist.edu.ph",
        firstName: "Miguel",
        lastName: "Torres",
        alignment: "ALIGNED" as const,
      },
      {
        email: "applicant8@earist.edu.ph",
        firstName: "Elena",
        lastName: "Cruz",
        alignment: "CLEARED" as const,
      },
      {
        email: "applicant9@earist.edu.ph",
        firstName: "Ricardo",
        lastName: "Villanueva",
        alignment: "ALIGNED" as const,
      },
      {
        email: "applicant10@earist.edu.ph",
        firstName: "Sofia",
        lastName: "Aquino",
        alignment: "PENDING_WAIVER" as const,
      },
      {
        email: "applicant11@earist.edu.ph",
        firstName: "Andres",
        lastName: "Ramos",
        alignment: "ALIGNED" as const,
      },
      {
        email: "applicant12@earist.edu.ph",
        firstName: "Isabel",
        lastName: "Fernandez",
        alignment: "CLEARED" as const,
      },
    ];

    for (let i = 0; i < additionalApplicants.length; i++) {
      const app = additionalApplicants[i];
      const progIndex = i % allPrograms.length;
      const undergradIndex = i % allUndergradPrograms.length;

      await prisma.user.upsert({
        where: { email: app.email },
        update: {},
        create: {
          email: app.email,
          passwordHash,
          firstName: app.firstName,
          lastName: app.lastName,
          role: "APPLICANT",
          student: {
            create: {
              cellphone: `+63917${String(1000000 + i).slice(0, 7)}`,
              dateOfBirth: new Date(
                `199${5 + (i % 5)}-0${(i % 9) + 1}-15T00:00:00.000Z`,
              ),
              pinnacleApplicantId: `PIN-2026-${String(i + 5).padStart(3, "0")}`,
              programId: allPrograms[progIndex].id,
              undergraduateProgramId: allUndergradPrograms[undergradIndex].id,
              admissionStatus: "APPLICANT",
              isProgramAligned: app.alignment !== "PENDING_WAIVER",
              alignmentStatus: app.alignment,
              ...(app.alignment !== "ALIGNED"
                ? {
                    bridgingWaiver: {
                      create: {
                        intendedProgramId: allPrograms[progIndex].id,
                        undergraduateProgramId:
                          allUndergradPrograms[undergradIndex].id,
                        status:
                          app.alignment === "CLEARED" ? "VALIDATED" : "PENDING",
                        ...(app.alignment === "CLEARED"
                          ? { validatedAt: new Date() }
                          : { waiverFormDownloadedAt: new Date() }),
                      },
                    },
                  }
                : {}),
            },
          },
        },
      });
    }
    console.log("Created Applicants 5-12 for pagination testing");
  }

  // 5. Exam Slots
  console.log("Seeding exam slots...");
  const examSlots = [
    {
      programId: allPrograms[0].id,
      examDate: new Date("2026-08-01T00:00:00.000Z"),
      examTime: new Date("2026-08-01T09:00:00.000Z"),
      maxSlots: 30,
    },
    {
      programId: allPrograms[0].id,
      examDate: new Date("2026-08-15T00:00:00.000Z"),
      examTime: new Date("2026-08-15T09:00:00.000Z"),
      maxSlots: 30,
    },
    {
      programId: allPrograms[1].id,
      examDate: new Date("2026-08-02T00:00:00.000Z"),
      examTime: new Date("2026-08-02T14:00:00.000Z"),
      maxSlots: 25,
    },
    {
      programId: allPrograms[4].id,
      examDate: new Date("2026-08-05T00:00:00.000Z"),
      examTime: new Date("2026-08-05T10:00:00.000Z"),
      maxSlots: 20,
    },
  ];

  const createdSlots = [];
  for (const slot of examSlots) {
    const existing = await prisma.examSlot.findFirst({
      where: { programId: slot.programId, examDate: slot.examDate },
    });
    if (!existing) {
      const created = await prisma.examSlot.create({ data: slot as any });
      createdSlots.push(created);
      console.log(`Created exam slot: ${slot.examDate.toLocaleDateString()}`);
    } else {
      createdSlots.push(existing);
      console.log(
        `Exam slot already exists: ${slot.examDate.toLocaleDateString()}`,
      );
    }
  }

  // 6. Exam Applications (for applicants with ALIGNED status)
  console.log("Seeding exam applications...");
  const applicantsToSchedule = [
    { email: "applicant1@earist.edu.ph", slotIndex: 0, status: "PASSED" },
    { email: "applicant3@earist.edu.ph", slotIndex: 0, status: "SCHEDULED" },
    { email: "applicant5@earist.edu.ph", slotIndex: 1, status: "PENDING" },
    { email: "applicant7@earist.edu.ph", slotIndex: 2, status: "PASSED" },
    { email: "applicant9@earist.edu.ph", slotIndex: 3, status: "FAILED" },
  ];

  for (const app of applicantsToSchedule) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: app.email },
        include: { student: true },
      });

      if (user?.student) {
        const existing = await prisma.entranceExamApplication.findFirst({
          where: { studentId: user.student.id },
        });

        if (!existing && createdSlots[app.slotIndex]) {
          console.log(
            `Created exam application for ${app.email} - ${app.status}`,
          );
        }
      }

      // 7. Email Templates (v8 System Notification Inventory)
      console.log("Seeding Email Templates...");

      const emailTemplates = [
        {
          templateKey: "ecat_result_pass",
          subject: "ECAT Result: PASSED",
          bodyHtml:
            "<p>Dear {{student_name}},</p><p>Congratulations! You passed the ECAT. Login to your portal: {{portal_link}}</p>",
        },
        {
          templateKey: "ecat_result_fail",
          subject: "ECAT Result: FAILED",
          bodyHtml:
            "<p>Dear {{student_name}},</p><p>We regret to inform you that you failed the ECAT. Login to your portal: {{portal_link}}</p>",
        },
        {
          templateKey: "credential_dispatch",
          subject: "Welcome! Your Student Credentials",
          bodyHtml:
            "<p>Dear {{student_name}},</p><p>Congratulations, you are now officially enrolled.</p><p>Your Student Number is: <strong>{{student_number}}</strong></p><p>Your Default Password is: <strong>{{default_password}}</strong> (Your Last Name in ALL CAPS)</p><p>Please login to your portal immediately to change your password: {{portal_link}}</p>",
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
          templateKey: "bridging_waiver_validated",
          subject: "Bridging Waiver Validated",
          bodyHtml:
            "<p>Dear {{student_name}},</p><p>Your bridging waiver has been validated. Login to your portal: {{portal_link}}</p>",
        },
        {
          templateKey: "bridging_waiver_rejected",
          subject: "Bridging Waiver Rejected",
          bodyHtml:
            "<p>Dear {{student_name}},</p><p>Your bridging waiver has been rejected. Login to your portal: {{portal_link}}</p>",
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
          templateKey: "alignment_aligned",
          subject: "Program Alignment: ALIGNED",
          bodyHtml:
            "<p>Dear {{student_name}},</p><p>Your undergraduate course is aligned. Login to your portal: {{portal_link}}</p>",
        },
        {
          templateKey: "alignment_misaligned",
          subject: "Program Alignment: MISALIGNED",
          bodyHtml:
            "<p>Dear {{student_name}},</p><p>Your undergraduate course is misaligned. Please login to download your bridging waiver: {{portal_link}}</p>",
        },
        {
          templateKey: "exam_reminder_24h",
          subject: "Reminder: Exam Tomorrow",
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
        const existing = await prisma.emailTemplate.findUnique({
          where: { templateKey: tpl.templateKey },
        });
        if (!existing) {
          await prisma.emailTemplate.create({
            data: {
              templateKey: tpl.templateKey,
              subject: tpl.subject,
              bodyHtml: tpl.bodyHtml,
            },
          });
          console.log(`Created Email Template: ${tpl.templateKey}`);
        }
      }
    } catch (e: any) {
      console.log(`Skipping ${app.email}: ${e.message}`);
    }
  }

  // ── Defense Lobby fixtures (idempotent) ────────────────────────────
  // Live lobby + concluded/RAP lobby so /panelist/defense-lobby and
  // /admin/thesis/rap-reports can be exercised after `prisma db seed`.
  console.log("Seeding defense lobby fixtures...");
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@earist.edu.ph" },
  });
  const panelUser1 = await prisma.user.findUnique({
    where: { email: "panelist1@earist.edu.ph" },
  });
  const panelUser2 = await prisma.user.findUnique({
    where: { email: "panelist2@earist.edu.ph" },
  });
  const panelUser3 = await prisma.user.findUnique({
    where: { email: "panelist3@earist.edu.ph" },
  });
  const lobbyStudentUser = await prisma.user.findUnique({
    where: { email: "student@earist.edu.ph" },
  });
  const lobbyStudent = lobbyStudentUser
    ? await prisma.student.findUnique({ where: { userId: lobbyStudentUser.id } })
    : null;
  const lobbyThesis = lobbyStudent
    ? await prisma.thesisRecord.findFirst({
        where: { studentId: lobbyStudent.id, stage: "PROPOSAL" },
      })
    : null;

  if (
    lobbyThesis &&
    adminUser &&
    panelUser1 &&
    panelUser2 &&
    panelUser3
  ) {
    const existingSelectedTitle = await prisma.thesisTitle.findFirst({
      where: { thesisId: lobbyThesis.id, isSelected: true },
    });
    if (!existingSelectedTitle) {
      await prisma.thesisTitle.create({
        data: {
          thesisId: lobbyThesis.id,
          titleText:
            "AI-Assisted Academic Advisement Practices in Graduate Education",
          isSelected: true,
        },
      });
      console.log("Created selected ThesisTitle for defense lobby");
    }

    const ensurePanel = async (
      scheduleId: string,
      userId: string,
      role: "CHAIRMAN" | "PANELIST" | "ADVISER" | "RAPPORTEUR" | "FACILITATOR",
    ) => {
      const existing = await prisma.panelAssignment.findFirst({
        where: { scheduleId, userId },
      });
      if (existing) return existing;
      const created = await prisma.panelAssignment.create({
        data: { scheduleId, userId, role },
      });
      console.log(`Assigned panelist ${userId} as ${role} on schedule ${scheduleId}`);
      return created;
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
      const created = await prisma.oralExamScore.create({
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
      console.log(`Created OralExamScore for panel ${panelId}`);
      return created;
    };

    // 1) LIVE lobby — PROPOSAL_DEFENSE, notes filled, 2/3 scored
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
          defenseDate: new Date("2026-09-15T00:00:00.000Z"),
          defenseTime: new Date("1970-01-01T09:00:00.000Z"),
          venueOrLink:
            "https://teams.microsoft.com/l/meetup-join/defense-lobby-demo",
          defenseType: "PROPOSAL_DEFENSE",
          setById: adminUser.id,
          rapporteurNotes:
            "Student presented Chapters 1-3.\nPanel suggested tightening the sampling section.\nAwaiting final vote on 'Approved with revisions'.",
        },
      });
      console.log("Created live DefenseSchedule (PROPOSAL_DEFENSE) for Student 1");
    }

    const liveChair = await ensurePanel(liveSchedule.id, panelUser2.id, "CHAIRMAN");
    const liveRapporteur = await ensurePanel(
      liveSchedule.id,
      panelUser3.id,
      "RAPPORTEUR",
    );
    await ensurePanel(liveSchedule.id, panelUser1.id, "ADVISER");

    // CHAIRMAN + RAPPORTEUR scored ("Ready"); ADVISER still "Scoring..."
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

    // 2) CONCLUDED lobby — TITLE_DEFENSE with summary + draft RAP
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
          defenseTime: new Date("1970-01-01T13:00:00.000Z"),
          venueOrLink: "GS Conference Room B",
          defenseType: "TITLE_DEFENSE",
          setById: adminUser.id,
          rapporteurNotes:
            "Title defense concluded. Panel selected Title A with minor wording edits.",
        },
      });
      console.log("Created concluded DefenseSchedule (TITLE_DEFENSE) for Student 1");
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
    const concludedAdviser = await ensurePanel(
      concludedSchedule.id,
      panelUser1.id,
      "ADVISER",
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
    await ensureScore(concludedAdviser.id, concludedSchedule.id, {
      overallAverage: 1.0,
      rating: "E",
      recommendations: "Strong title; supervise literature mapping closely.",
    });

    const existingSummary = await prisma.oralExamSummary.findFirst({
      where: { scheduleId: concludedSchedule.id },
    });
    if (!existingSummary) {
      await prisma.oralExamSummary.create({
        data: {
          scheduleId: concludedSchedule.id,
          overallAverage: 1.25,
          finalRating: "HS",
          finalRemarks: "Seeded from Defense Lobby fixtures",
          attestedById: adminUser.id,
        },
      });
      console.log("Created OralExamSummary for concluded defense");
    }

    const existingRap = await prisma.rapReport.findFirst({
      where: { scheduleId: concludedSchedule.id },
    });
    if (!existingRap) {
      const selectedTitle = await prisma.thesisTitle.findFirst({
        where: { thesisId: lobbyThesis.id, isSelected: true },
      });
      const rap = await prisma.rapReport.create({
        data: {
          scheduleId: concludedSchedule.id,
          thesisId: lobbyThesis.id,
          defenseType: "TITLE_DEFENSE",
          reportDate: new Date("2026-07-10T00:00:00.000Z"),
          venue: "GS Conference Room B",
          decisionsAndRecommendations:
            "=== RAPPORTEUR NOTES ===\nTitle defense concluded. Panel selected Title A with minor wording edits.\n\n=== PANEL ===\nApproved title; align Chapter 1 framing with selected title.\n\nTitle is feasible. Proceed to proposal defense.\n\nStrong title; supervise literature mapping closely.",
          selectedTitle: selectedTitle?.titleText || "No Title",
          status: "DRAFT",
          generatedById: adminUser.id,
          generatedAt: new Date(),
        },
      });
      await prisma.rapReportSignature.createMany({
        data: [
          { rapId: rap.id, userId: panelUser2.id },
          { rapId: rap.id, userId: panelUser3.id },
          { rapId: rap.id, userId: panelUser1.id },
        ],
      });
      console.log("Created draft RapReport + signature slots for concluded defense");
    } else {
      const sigCount = await prisma.rapReportSignature.count({
        where: { rapId: existingRap.id },
      });
      if (sigCount === 0) {
        await prisma.rapReportSignature.createMany({
          data: [
            { rapId: existingRap.id, userId: panelUser2.id },
            { rapId: existingRap.id, userId: panelUser3.id },
            { rapId: existingRap.id, userId: panelUser1.id },
          ],
        });
        console.log("Created missing RapReportSignature slots");
      }
    }

    await prisma.thesisRecord.update({
      where: { id: lobbyThesis.id },
      data: { status: "SCHEDULED" },
    });

    console.log("Defense lobby fixtures ready:");
    console.log(
      `  LIVE      → /panelist/defense-lobby/${liveSchedule.id} (PROPOSAL_DEFENSE)`,
    );
    console.log(
      `  CONCLUDED → /panelist/defense-lobby/${concludedSchedule.id} (TITLE_DEFENSE + draft RAP)`,
    );
  } else {
    console.log(
      "Skipping defense lobby fixtures (missing admin, panelists, or Student 1 thesis)",
    );
  }

  // ── Defense eligibility fixtures (pass / fail cases) ───────────────
  console.log("Seeding defense eligibility fixtures...");
  const eligStudentUser = await prisma.user.findUnique({
    where: { email: "student@earist.edu.ph" },
  });
  const eligStudent = eligStudentUser
    ? await prisma.student.findUnique({ where: { userId: eligStudentUser.id } })
    : null;

  if (eligStudent && lobbyThesis) {
    const titleTexts = [
      "AI-Assisted Academic Advisement Practices in Graduate Education",
      "Graduate Thesis Pipeline Digitization in State Universities",
      "Panel Scoring Reliability in Oral Defense Evaluation",
    ];
    for (const titleText of titleTexts) {
      const existingTitle = await prisma.thesisTitle.findFirst({
        where: { thesisId: lobbyThesis.id, titleText },
      });
      if (!existingTitle) {
        await prisma.thesisTitle.create({
          data: { thesisId: lobbyThesis.id, titleText },
        });
        console.log(`Created ThesisTitle: ${titleText}`);
      }
    }

    const requiredDocs: Array<{
      docType:
        | "TITLE_PROPOSAL"
        | "PROPOSAL_CHAPTERS"
        | "COR"
        | "RECEIPT"
        | "FINAL_MANUSCRIPT"
        | "INSTRUMENTS";
      defenseStage: "TITLE" | "PROPOSAL" | "FINAL";
    }> = [
      { docType: "TITLE_PROPOSAL", defenseStage: "TITLE" },
      { docType: "COR", defenseStage: "TITLE" },
      { docType: "RECEIPT", defenseStage: "TITLE" },
    ];
    for (const doc of requiredDocs) {
      const existingDoc = await prisma.thesisDocument.findFirst({
        where: {
          thesisId: lobbyThesis.id,
          docType: doc.docType,
          defenseStage: doc.defenseStage,
        },
      });
      if (!existingDoc) {
        await prisma.thesisDocument.create({
          data: {
            thesisId: lobbyThesis.id,
            docType: doc.docType,
            defenseStage: doc.defenseStage,
            filePath: `uploads/seed-${doc.docType.toLowerCase()}.pdf`,
            uploadedAt: new Date(),
          },
        });
        console.log(`Created ThesisDocument: ${doc.docType} @ ${doc.defenseStage}`);
      }
    }

    console.log("Eligibility fixtures:");
    console.log(
      "  student@earist.edu.ph → Title apply should SUCCEED (no adviser required; comp exam PASSED)",
    );
    console.log(
      "  student2@earist.edu.ph → Title apply should FAIL (comp exam not PASSED / strikes)",
    );
    console.log(
      "  Scheduling requires ThesisRecord.status=APPROVED + stage requirements (hard gate).",
    );
  } else {
    console.log(
      "Skipping defense eligibility fixtures (missing Student 1 or thesis)",
    );
  }

  // ── Defense workflow refactor fixtures (Phases B–G) ─────────────────────────
  // Manual QA accounts for: Title apply, review, schedule (7/8), score ≠ outcome,
  // formal conclusion, RAP, stage-scoped COR/receipt/certs, vars NOT_APPLICABLE.
  console.log("Seeding defense workflow refactor fixtures...");
  await seedDefenseWorkflowFixtures(passwordHash);
}

/** Idempotent fixtures for manual testing of the defense workflow refactor. */
async function seedDefenseWorkflowFixtures(passwordHash: string) {
  const masters =
    (await prisma.program.findFirst({ where: { programType: "MASTERS" } })) ??
    (await prisma.program.findFirst());
  const doctoral = await prisma.program.findFirst({
    where: { programType: "DOCTORAL" },
  });
  if (!masters) {
    console.error("No graduate program found — skipping workflow fixtures.");
    return;
  }
  const admin = await prisma.user.findUnique({
    where: { email: "admin@earist.edu.ph" },
  });
  if (!admin) {
    console.error("admin@earist.edu.ph missing — skipping workflow fixtures.");
    return;
  }
  // Capture a non-null id for nested helpers (TS does not keep narrowing in closures).
  const adminId = admin.id;

  // Enough panelists for Master's session total 7 (and Doctoral 8).
  const extraPanelists = [
    { email: "panelist4@earist.edu.ph", first: "Dr. Ana", last: "Reyes" },
    { email: "panelist5@earist.edu.ph", first: "Dr. Ben", last: "Santos" },
    { email: "panelist6@earist.edu.ph", first: "Prof. Cara", last: "Lim" },
    { email: "panelist7@earist.edu.ph", first: "Prof. Dan", last: "Cruz" },
    { email: "panelist8@earist.edu.ph", first: "Dr. Elise", last: "Torres" },
    { email: "panelist9@earist.edu.ph", first: "Dr. Finn", last: "Ng" },
    { email: "panelist10@earist.edu.ph", first: "Prof. Gwen", last: "Uy" },
  ];
  const panelistUsers: Record<string, string> = {};
  for (const p of extraPanelists) {
    const u = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        passwordHash,
        firstName: p.first,
        lastName: p.last,
        role: "PANELIST",
        panelist: {
          create: { isExternal: false, isAvailableAsAdviser: true },
        },
      },
    });
    panelistUsers[p.email] = u.id;
    console.log(`  panelist ready: ${p.email}`);
  }
  // ADMIN is created above; reuse it (do not rely on a stale findUnique below).
  for (const n of [1, 2, 3] as const) {
    const u = await prisma.user.findUnique({
      where: { email: `panelist${n}@earist.edu.ph` },
    });
    if (u) panelistUsers[`panelist${n}@earist.edu.ph`] = u.id;
  }

  async function ensureStudent(opts: {
    email: string;
    first: string;
    last: string;
    studentNumber: string;
    programId: string;
    compExam?: "PASSED" | "FAILED" | "PENDING";
    strikes?: number;
  }) {
    const user = await prisma.user.upsert({
      where: { email: opts.email },
      update: {},
      create: {
        email: opts.email,
        passwordHash,
        firstName: opts.first,
        lastName: opts.last,
        role: "STUDENT",
        student: {
          create: {
            studentNumber: opts.studentNumber,
            dateOfBirth: new Date("1996-01-15T00:00:00.000Z"),
            programId: opts.programId,
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

  async function ensureTitleDocs(thesisId: string) {
    const docs = [
      { docType: "TITLE_PROPOSAL" as const, defenseStage: "TITLE" as const },
      { docType: "COR" as const, defenseStage: "TITLE" as const },
      { docType: "RECEIPT" as const, defenseStage: "TITLE" as const },
    ];
    for (const doc of docs) {
      const existing = await prisma.thesisDocument.findFirst({
        where: {
          thesisId,
          docType: doc.docType,
          defenseStage: doc.defenseStage,
        },
      });
      if (!existing) {
        await prisma.thesisDocument.create({
          data: {
            thesisId,
            docType: doc.docType,
            defenseStage: doc.defenseStage,
            filePath: `uploads/seed-${doc.defenseStage.toLowerCase()}-${doc.docType.toLowerCase()}.pdf`,
            uploadedAt: new Date(),
          },
        });
      }
    }
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

  /** Ready-for-scheduling fixtures must not keep an active current-stage schedule. */
  async function cancelNonCancelledSchedules(
    thesisId: string,
    defenseType:
      | "TITLE_DEFENSE"
      | "PROPOSAL_DEFENSE"
      | "FINAL_DEFENSE",
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

  /**
   * Master's session roster (7) for history sessions.
   * History cards read committee from PanelAssignment — seed must create seats.
   */
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

  /** Prior-stage history: concluded schedule + committee + DefenseConclusion. */
  async function ensureConcludedPriorDefense(opts: {
    thesisId: string;
    defenseType:
      | "TITLE_DEFENSE"
      | "PROPOSAL_DEFENSE"
      | "FINAL_DEFENSE";
    defenseDate: string;
    venueOrLink: string;
    outcome?: "PASSED" | "REVISION_REQUIRED" | "FAILED";
    selectedTitleId?: string | null;
  }) {
    const outcome = opts.outcome ?? "PASSED";
    let schedule = await prisma.defenseSchedule.findFirst({
      where: {
        thesisId: opts.thesisId,
        defenseType: opts.defenseType,
        sessionStatus: "CONCLUDED",
      },
      orderBy: { createdAt: "desc" },
    });
    if (!schedule) {
      // Drop any leftover non-concluded rows so Ready cannot look Scheduled.
      await cancelNonCancelledSchedules(opts.thesisId, opts.defenseType);
      schedule = await prisma.defenseSchedule.create({
        data: {
          thesisId: opts.thesisId,
          defenseDate: new Date(opts.defenseDate),
          defenseTime: new Date("1970-01-01T09:00:00.000Z"),
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

    // History UI shows committee from PanelAssignment rows on this schedule.
    await ensureCommitteeRoster(schedule.id);

    const conclusion = await prisma.defenseConclusion.findUnique({
      where: { scheduleId: schedule.id },
    });
    if (!conclusion) {
      await prisma.defenseConclusion.create({
        data: {
          scheduleId: schedule.id,
          thesisId: opts.thesisId,
          outcome,
          selectedTitleId: opts.selectedTitleId ?? null,
          finalRemarks: `Seeded ${opts.defenseType} conclusion`,
          concludedById: adminId,
          concludedAt: new Date(opts.defenseDate),
        },
      });
    }
    return schedule;
  }

  const officialTitle =
    "Digital Inclusion Practices in Graduate Education";

  // A) title-ready@ — clean Title apply (comp PASSED, no active thesis block)
  await ensureStudent({
    email: "title-ready@earist.edu.ph",
    first: "Tina",
    last: "Ready",
    studentNumber: "2026-1001",
    programId: masters.id,
    compExam: "PASSED",
  });
  console.log("  scenario title-ready@earist.edu.ph → Title apply SUCCEEDS");

  // B) title-blocked@ — comp not passed / strikes
  await ensureStudent({
    email: "title-blocked@earist.edu.ph",
    first: "Toby",
    last: "Blocked",
    studentNumber: "2026-1002",
    programId: masters.id,
    compExam: "FAILED",
    strikes: 2,
  });
  console.log("  scenario title-blocked@earist.edu.ph → Title apply FAILS (comp exam)");

  // C) title-pending@ — application in admin review
  const c = await ensureStudent({
    email: "title-pending@earist.edu.ph",
    first: "Pam",
    last: "Pending",
    studentNumber: "2026-1003",
    programId: masters.id,
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
      },
    }));
  await ensureTitles(cThesis.id);
  await ensureTitleDocs(cThesis.id);
  console.log("  scenario title-pending@earist.edu.ph → admin review queue");

  // D) title-approved@ — ready to schedule (needs 7-person Master's committee)
  const d = await ensureStudent({
    email: "title-approved@earist.edu.ph",
    first: "Abe",
    last: "Approved",
    studentNumber: "2026-1004",
    programId: masters.id,
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
      },
    }));
  if (dThesis.status !== "APPROVED" || dThesis.stage !== "TITLE") {
    await prisma.thesisRecord.update({
      where: { id: dThesis.id },
      data: { stage: "TITLE", status: "APPROVED", outcome: null },
    });
  }
  // Ready for Scheduling: APPROVED + NO active current-stage schedule/committee.
  await cancelNonCancelledSchedules(dThesis.id, "TITLE_DEFENSE");
  await ensureTitles(dThesis.id);
  await ensureTitleDocs(dThesis.id);
  console.log(
    "  scenario title-approved@earist.edu.ph → schedule (session total 7: Chair+4 Panelists+Fac+Rap)",
  );

  // E) proposal-ready@ — Title COMPLETE + adviser + Proposal cert + vars N/A
  const e = await ensureStudent({
    email: "proposal-ready@earist.edu.ph",
    first: "Pia",
    last: "Proposal",
    studentNumber: "2026-1005",
    programId: masters.id,
    compExam: "PASSED",
  });
  const adviser = await prisma.user.findUnique({
    where: { email: "panelist1@earist.edu.ph" },
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
        outcome: null,
      },
    }));
  // Current stage is Proposal (Title already complete historically).
  await prisma.thesisRecord.update({
    where: { id: eThesis.id },
    data: {
      stage: "PROPOSAL",
      status: "APPROVED",
      outcome: null,
      assignmentId: eAssignment?.id ?? eThesis.assignmentId,
    },
  });
  await ensureTitles(eThesis.id, officialTitle);
  await ensureTitleDocs(eThesis.id);
  // Prior Title defense is historical only — must not block Proposal Ready.
  const eTitleSched = await ensureConcludedPriorDefense({
    thesisId: eThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-07-20T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/title-past",
    outcome: "PASSED",
  });
  // No PROPOSAL_DEFENSE schedule yet (Ready for Scheduling).
  await cancelNonCancelledSchedules(eThesis.id, "PROPOSAL_DEFENSE");
  // Prior Title RAP finalized (internal ref — no student re-upload)
  const eTitleRap = await prisma.rapReport.findFirst({
    where: { thesisId: eThesis.id, defenseType: "TITLE_DEFENSE" },
  });
  if (!eTitleRap) {
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
  // Proposal-scoped adviser cert
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
        certifiedAt: new Date("2026-07-25T00:00:00.000Z"),
      },
    });
  }
  // Research Variables NOT_APPLICABLE (IF ANY)
  const eVars = await prisma.researchVariableForm.findFirst({
    where: { thesisId: eThesis.id },
  });
  if (!eVars) {
    await prisma.researchVariableForm.create({
      data: {
        thesisId: eThesis.id,
        status: "NOT_APPLICABLE",
        hasAllSignatures: true,
        approvedAt: new Date("2026-07-25T00:00:00.000Z"),
      },
    });
  }
  console.log(
    "  scenario proposal-ready@earist.edu.ph → Proposal apply SUCCEEDS (vars NOT_APPLICABLE, Title RAP finalized)",
  );

  // F) proposal-blocked-vars@ — vars PENDING should block Proposal
  const f = await ensureStudent({
    email: "proposal-blocked-vars@earist.edu.ph",
    first: "Vic",
    last: "Vars",
    studentNumber: "2026-1006",
    programId: masters.id,
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
        stage: "PROPOSAL",
        status: "APPROVED",
        outcome: null,
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: fThesis.id },
    data: {
      stage: "PROPOSAL",
      status: "APPROVED",
      outcome: null,
      assignmentId: fAssignment?.id ?? fThesis.assignmentId,
    },
  });
  await ensureTitles(fThesis.id, officialTitle);
  await ensureTitleDocs(fThesis.id);
  if (adviser) {
    const fCert = await prisma.adviserCertification.findFirst({
      where: { thesisId: fThesis.id, defenseStage: "PROPOSAL_DEFENSE" },
    });
    if (!fCert) {
      await prisma.adviserCertification.create({
        data: {
          thesisId: fThesis.id,
          adviserId: adviser.id,
          defenseStage: "PROPOSAL_DEFENSE",
          status: "ISSUED",
          certifiedAt: new Date("2026-07-25T00:00:00.000Z"),
        },
      });
    }
  }
  const fTitleSched = await ensureConcludedPriorDefense({
    thesisId: fThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-07-20T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/title-past-2",
    outcome: "PASSED",
  });
  await cancelNonCancelledSchedules(fThesis.id, "PROPOSAL_DEFENSE");
  const fRap = await prisma.rapReport.findFirst({
    where: { thesisId: fThesis.id, defenseType: "TITLE_DEFENSE" },
  });
  if (!fRap) {
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
  const fVars = await prisma.researchVariableForm.findFirst({
    where: { thesisId: fThesis.id },
  });
  if (!fVars) {
    await prisma.researchVariableForm.create({
      data: {
        thesisId: fThesis.id,
        status: "PENDING",
        hasAllSignatures: false,
      },
    });
  }
  console.log(
    "  scenario proposal-blocked-vars@earist.edu.ph → Proposal apply FAILS (RESEARCH_VARIABLES pending)",
  );

  // G) revision-blocked@ — REVISION_REQUIRED never unlocks next stage
  const g = await ensureStudent({
    email: "revision-blocked@earist.edu.ph",
    first: "Ria",
    last: "Revision",
    studentNumber: "2026-1007",
    programId: masters.id,
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
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: gThesis.id },
    data: { stage: "TITLE", status: "REVISION", outcome: "REVISION_REQUIRED" },
  });
  await ensureTitles(gThesis.id);
  await ensureTitleDocs(gThesis.id);
  // History must come from DefenseConclusion, not only mutable ThesisRecord.status.
  await ensureConcludedPriorDefense({
    thesisId: gThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-07-22T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/revision",
    outcome: "REVISION_REQUIRED",
  });
  console.log(
    "  scenario revision-blocked@earist.edu.ph → Proposal stays LOCKED (REVISION_REQUIRED)",
  );

  // H) final-ready@ — Proposal COMPLETE + Final cert (no STRIKE gate by default)
  const h = await ensureStudent({
    email: "final-ready@earist.edu.ph",
    first: "Finn",
    last: "Final",
    studentNumber: "2026-1008",
    programId: masters.id,
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
        outcome: null,
      },
    }));
  // Current stage is Final; Title/Proposal remain as prior-stage history only.
  await prisma.thesisRecord.update({
    where: { id: hThesis.id },
    data: {
      stage: "FINAL",
      status: "APPROVED",
      outcome: null,
      assignmentId: hAssignment?.id ?? hThesis.assignmentId,
    },
  });
  await ensureTitles(hThesis.id, officialTitle);
  // Stage-scoped Proposal evidence (must not be reused for Final)
  for (const doc of [
    { docType: "PROPOSAL_CHAPTERS" as const, defenseStage: "PROPOSAL" as const },
    { docType: "COR" as const, defenseStage: "PROPOSAL" as const },
    { docType: "RECEIPT" as const, defenseStage: "PROPOSAL" as const },
  ]) {
    const existing = await prisma.thesisDocument.findFirst({
      where: {
        thesisId: hThesis.id,
        docType: doc.docType,
        defenseStage: doc.defenseStage,
      },
    });
    if (!existing) {
      await prisma.thesisDocument.create({
        data: {
          thesisId: hThesis.id,
          docType: doc.docType,
          defenseStage: doc.defenseStage,
          filePath: `uploads/seed-proposal-${doc.docType.toLowerCase()}.pdf`,
          uploadedAt: new Date(),
        },
      });
    }
  }
  await ensureConcludedPriorDefense({
    thesisId: hThesis.id,
    defenseType: "TITLE_DEFENSE",
    defenseDate: "2026-06-15T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/title-past-h",
    outcome: "PASSED",
  });
  await cancelNonCancelledSchedules(hThesis.id, "FINAL_DEFENSE");
  const hPropRap = await prisma.rapReport.findFirst({
    where: { thesisId: hThesis.id, defenseType: "PROPOSAL_DEFENSE" },
  });
  const hPropSched = await ensureConcludedPriorDefense({
    thesisId: hThesis.id,
    defenseType: "PROPOSAL_DEFENSE",
    defenseDate: "2026-08-10T00:00:00.000Z",
    venueOrLink: "https://teams.microsoft.com/l/meetup-join/proposal-past",
    outcome: "PASSED",
  });
  if (!hPropRap) {
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
  if (adviser) {
    const hFinalCert = await prisma.adviserCertification.findFirst({
      where: { thesisId: hThesis.id, defenseStage: "FINAL_DEFENSE" },
    });
    if (!hFinalCert) {
      await prisma.adviserCertification.create({
        data: {
          thesisId: hThesis.id,
          adviserId: adviser.id,
          defenseStage: "FINAL_DEFENSE",
          status: "ISSUED",
          certifiedAt: new Date("2026-08-15T00:00:00.000Z"),
        },
      });
    }
  }
  // NOTE: no STRIKE / statistician / instruments — default Final gates are OFF.
  console.log(
    "  scenario final-ready@earist.edu.ph → Final apply SUCCEEDS without STRIKE/statistician/instruments",
  );

  // I) scores-awaiting@ — all evaluator scores in, NOT concluded (score ≠ outcome)
  const i = await ensureStudent({
    email: "scores-awaiting@earist.edu.ph",
    first: "Sam",
    last: "Scores",
    studentNumber: "2026-1009",
    programId: masters.id,
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
      },
    }));
  await prisma.thesisRecord.update({
    where: { id: iThesis.id },
    data: { stage: "TITLE", status: "SCHEDULED", outcome: null },
  });
  // Active session fixture: only one non-cancelled TITLE schedule (AWAITING_CONCLUSION).
  await ensureTitles(iThesis.id);
  await ensureTitleDocs(iThesis.id);
  let iSched = await prisma.defenseSchedule.findFirst({
    where: { thesisId: iThesis.id, defenseType: "TITLE_DEFENSE" },
  });
  if (!iSched) {
    iSched = await prisma.defenseSchedule.create({
      data: {
        thesisId: iThesis.id,
        defenseDate: new Date("2026-09-20T00:00:00.000Z"),
        defenseTime: new Date("1970-01-01T09:00:00.000Z"),
        venueOrLink: "https://teams.microsoft.com/l/meetup-join/awaiting-conclude",
        defenseType: "TITLE_DEFENSE",
        setById: adminId,
        sessionStatus: "AWAITING_CONCLUSION",
      },
    });
    // Master's full roster 7 (explicit adviser seat NOT used on Title)
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
      await prisma.panelAssignment.create({
        data: { scheduleId: iSched.id, userId: uid, role: seat.role },
      });
      // Evaluators only (CHAIRMAN + PANELIST) have scores — Fac/Rap do not score
      if (seat.role === "CHAIRMAN" || seat.role === "PANELIST") {
        const panel = await prisma.panelAssignment.findFirst({
          where: { scheduleId: iSched.id, userId: uid },
        });
        if (panel) {
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
    }
  }
  console.log(
    "  scenario scores-awaiting@earist.edu.ph → scores complete, outcome NULL, no RAP yet (admin conclude next)",
  );

  // J) Doctoral student for session total 8 check
  if (doctoral) {
    await ensureStudent({
      email: "doctoral-ready@earist.edu.ph",
      first: "Doc",
      last: "Toral",
      studentNumber: "2026-1010",
      programId: doctoral.id,
      compExam: "PASSED",
    });
    const jUser = await prisma.user.findUnique({
      where: { email: "doctoral-ready@earist.edu.ph" },
    });
    const jStudent = jUser
      ? await prisma.student.findUnique({ where: { userId: jUser.id } })
      : null;
    if (jStudent) {
      const jThesis =
        (await prisma.thesisRecord.findFirst({
          where: { studentId: jStudent.id },
        })) ??
        (await prisma.thesisRecord.create({
          data: {
            studentId: jStudent.id,
            stage: "TITLE",
            status: "APPROVED",
          },
        }));
      await prisma.thesisRecord.update({
        where: { id: jThesis.id },
        data: { stage: "TITLE", status: "APPROVED", outcome: null },
      });
      await cancelNonCancelledSchedules(jThesis.id, "TITLE_DEFENSE");
      await ensureTitles(jThesis.id);
      await ensureTitleDocs(jThesis.id);
    }
    console.log(
      "  scenario doctoral-ready@earist.edu.ph → schedule requires session total 8",
    );
  }

  console.log("Defense workflow refactor fixtures ready.");
  console.log("  Password for all fixtures: password123");
  console.log("  Manual QA map:");
  console.log("    title-ready@ / title-blocked@ / title-pending@ / title-approved@");
  console.log("    proposal-ready@ / proposal-blocked-vars@ / revision-blocked@");
  console.log("    final-ready@ / scores-awaiting@ / doctoral-ready@");
  console.log("  Panelists panelist1@ … panelist10@ for full 7/8-person committees.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
