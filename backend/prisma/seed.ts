import prisma from '../src/config/database';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding programs...');

   // Graduate Programs
  const programs = [
    // DOCTORAL PROGRAMS
    { programName: 'Doctor of Philosophy in Industrial Psychology', programType: 'DOCTORAL', department: 'College of Arts and Sciences', maxResidencyYears: 7 },
    { programName: 'Doctor of Education Major in Educational Management', programType: 'DOCTORAL', department: 'College of Education', maxResidencyYears: 7 },
    { programName: 'Doctor in Business Administration', programType: 'DOCTORAL', department: 'College of Business Administration', maxResidencyYears: 7 },
    { programName: 'Doctor in Public Administration', programType: 'DOCTORAL', department: 'College of Public Administration', maxResidencyYears: 7 },
    
    // MASTERS PROGRAMS
    { programName: 'Master of Science in Mathematics', programType: 'MASTERS', department: 'College of Arts and Sciences', maxResidencyYears: 5 },
    { programName: 'Master of Arts in Industrial Psychology', programType: 'MASTERS', department: 'College of Arts and Sciences', maxResidencyYears: 5 },
    { programName: 'Master in Business Administration', programType: 'MASTERS', department: 'College of Business Administration', maxResidencyYears: 5 },
    { programName: 'Master in Public Administration', programType: 'MASTERS', department: 'College of Public Administration', maxResidencyYears: 5 },
    { programName: 'Master of Arts in Industrial Education Major in: Hotel and Restaurant Management', programType: 'MASTERS', department: 'College of Education', maxResidencyYears: 5 },
    
    // Master of Arts in Education
    { programName: 'Master of Arts in Education Major in: Administration and Supervision', programType: 'MASTERS', department: 'College of Education', maxResidencyYears: 5 },
    { programName: 'Master of Arts in Education Major in: Guidance and Counseling', programType: 'MASTERS', department: 'College of Education', maxResidencyYears: 5 },
    { programName: 'Master of Arts in Education Major in: Special Education', programType: 'MASTERS', department: 'College of Education', maxResidencyYears: 5 },
    
    // Master of Arts in Teaching (MAT)
    { programName: 'Master of Arts in Teaching (MAT) Major in: Electronics Technology', programType: 'MASTERS', department: 'College of Education', maxResidencyYears: 5 },
    { programName: 'Master of Arts in Teaching (MAT) Major in: Electrical Technology', programType: 'MASTERS', department: 'College of Education', maxResidencyYears: 5 },
    { programName: 'Master of Arts in Teaching (MAT) Major in: Mathematics', programType: 'MASTERS', department: 'College of Education', maxResidencyYears: 5 },
    { programName: 'Master of Arts in Teaching (MAT) Major in: Science', programType: 'MASTERS', department: 'College of Education', maxResidencyYears: 5 }
  ];

  for (const p of programs) {
    const existing = await prisma.program.findFirst({
      where: { programName: p.programName }
    });

    if (!existing) {
      await prisma.program.create({
        data: p as any
      });
      console.log(`Created graduate program: ${p.programName}`);
    } else {
      console.log(`Graduate program already exists: ${p.programName}`);
    }
  }

    // Undergraduate Programs
  const ugPrograms = [
    // College of Accountancy and Finance (CAF)
    { programName: 'Bachelor of Science in Accountancy', acronym: 'BSA', college: 'College of Accountancy and Finance (CAF)' },
    { programName: 'Bachelor of Science in Management Accounting', acronym: 'BSMA', college: 'College of Accountancy and Finance (CAF)' },
    { programName: 'Bachelor of Science in Business Administration: Major in Financial Management', acronym: 'BSBAFM', college: 'College of Accountancy and Finance (CAF)' },

    // College of Architecture, Design and the Built Environment (CADBE)
    { programName: 'Bachelor of Science in Architecture', acronym: 'BS-ARCH', college: 'College of Architecture, Design and the Built Environment (CADBE)' },
    { programName: 'Bachelor of Science in Interior Design', acronym: 'BSID', college: 'College of Architecture, Design and the Built Environment (CADBE)' },
    { programName: 'Bachelor of Science in Environmental Planning', acronym: 'BSEP', college: 'College of Architecture, Design and the Built Environment (CADBE)' },

    // College of Arts and Letters (CAL)
    { programName: 'Bachelor of Arts in English Language Studies', acronym: 'ABELS', college: 'College of Arts and Letters (CAL)' },
    { programName: 'Bachelor of Arts in Filipinology', acronym: 'ABF', college: 'College of Arts and Letters (CAL)' },
    { programName: 'Bachelor of Arts in Literary and Cultural Studies', acronym: 'ABLCS', college: 'College of Arts and Letters (CAL)' },
    { programName: 'Bachelor of Arts in Philosophy', acronym: 'AB-PHILO', college: 'College of Arts and Letters (CAL)' },
    { programName: 'Bachelor of Performing Arts: Major in Theater Arts', acronym: 'BPEA', college: 'College of Arts and Letters (CAL)' },

    // College of Business Administration (CBA)
    { programName: 'Bachelor of Science in Business Administration: Major in Human Resource Management', acronym: 'BSBAHRM', college: 'College of Business Administration (CBA)' },
    { programName: 'Bachelor of Science in Business Administration: Major in Marketing Management', acronym: 'BSBA-MM', college: 'College of Business Administration (CBA)' },
    { programName: 'Bachelor of Science in Entrepreneurship', acronym: 'BSENTREP', college: 'College of Business Administration (CBA)' },
    { programName: 'Bachelor of Science in Office Administration', acronym: 'BSOA', college: 'College of Business Administration (CBA)' },

    // College of Communication (COC)
    { programName: 'Bachelor in Advertising and Public Relations', acronym: 'BADPR', college: 'College of Communication (COC)' },
    { programName: 'Bachelor of Arts in Broadcasting', acronym: 'BA Broadcasting', college: 'College of Communication (COC)' },
    { programName: 'Bachelor of Arts in Communication Research', acronym: 'BACR', college: 'College of Communication (COC)' },
    { programName: 'Bachelor of Arts in Journalism', acronym: 'BAJ', college: 'College of Communication (COC)' },

    // College of Computer and Information Sciences (CCIS)
    { programName: 'Bachelor of Science in Computer Science', acronym: 'BSCS', college: 'College of Computer and Information Sciences (CCIS)' },
    { programName: 'Bachelor of Science in Information Technology', acronym: 'BSIT', college: 'College of Computer and Information Sciences (CCIS)' },

    // College of Education (COED)
    { programName: 'Bachelor of Business Technology and Livelihood Education: Major in Home Economics', acronym: 'BBTLEHE', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Business Technology and Livelihood Education: Major in Industrial Arts', acronym: 'BBTLEIA', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Business Technology and Livelihood Education: Major in Information and Communication Technology', acronym: 'BBTLEDICT', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Early Childhood Education', acronym: 'BECED', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Elementary Education', acronym: 'BEED', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Secondary Education: Major in English', acronym: 'BSEDEN', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Secondary Education: Major in Filipino', acronym: 'BSEDFL', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Secondary Education: Major in Mathematics', acronym: 'BSEDMT', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Secondary Education: Major in Science', acronym: 'BSEDSC', college: 'College of Education (COED)' },
    { programName: 'Bachelor of Secondary Education: Major in Social Studies', acronym: 'BSEDSS', college: 'College of Education (COED)' },

    // College of Engineering (CE)
    { programName: 'Bachelor of Science in Civil Engineering', acronym: 'BSCE', college: 'College of Engineering (CE)' },
    { programName: 'Bachelor of Science in Computer Engineering', acronym: 'BSCOE', college: 'College of Engineering (CE)' },
    { programName: 'Bachelor of Science in Electrical Engineering', acronym: 'BSEE', college: 'College of Engineering (CE)' },
    { programName: 'Bachelor of Science in Electronics Engineering', acronym: 'BS-ECE', college: 'College of Engineering (CE)' },
    { programName: 'Bachelor of Science in Industrial Engineering', acronym: 'BSIE', college: 'College of Engineering (CE)' },
    { programName: 'Bachelor of Science in Mechanical Engineering', acronym: 'BSME', college: 'College of Engineering (CE)' },
    { programName: 'Bachelor of Science in Railway Engineering', acronym: 'BSRE', college: 'College of Engineering (CE)' },

    // College of Human Kinetics (CHK)
    { programName: 'Bachelor of Physical Education', acronym: 'BPE', college: 'College of Human Kinetics (CHK)' },
    { programName: 'Bachelor of Science in Exercises and Sports', acronym: 'BSESS', college: 'College of Human Kinetics (CHK)' }
  ];

  for (const ug of ugPrograms) {
    const existingUG = await prisma.undergraduateProgram.findFirst({
      where: { programName: ug.programName }
    });

    if (!existingUG) {
      await prisma.undergraduateProgram.create({
        data: ug
      });
      console.log(`Created undergraduate program: ${ug.programName}`);
    } else {
      console.log(`Undergraduate program already exists: ${ug.programName}`);
    }
  }

  console.log('All programs seeded successfully!');

  console.log('Seeding test accounts...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Admin Test Account
  await prisma.user.upsert({
    where: { email: 'admin@earist.edu.ph' },
    update: {},
    create: {
      email: 'admin@earist.edu.ph',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
    }
  });
  console.log('Created Admin test account');

  // 2. Panelists Test Account
  await prisma.user.upsert({
    where: { email: 'panelist1@earist.edu.ph' },
    update: {},
    create: {
      email: 'panelist1@earist.edu.ph',
      passwordHash,
      firstName: 'Dr. John',
      lastName: 'Doe',
      role: 'PANELIST',
      panelist: {
        create: {
          isExternal: false,
          isAvailableAsAdviser: true,
        }
      }
    }
  });
  console.log('Created Panelist1 test account');

  await prisma.user.upsert({
    where: { email: 'panelist2@earist.edu.ph' },
    update: {},
    create: {
      email: 'panelist2@earist.edu.ph',
      passwordHash,
      firstName: 'Prof. William',
      lastName: 'Marcial',
      role: 'PANELIST',
      panelist: {
        create: {
          isExternal: false,
          isAvailableAsAdviser: true,
        }
      }
    }
  });
  console.log('Created Panelist2 test account');

  await prisma.user.upsert({
    where: { email: 'panelist3@earist.edu.ph' },
    update: {},
    create: {
      email: 'panelist3@earist.edu.ph',
      passwordHash,
      firstName: 'Prof. Hanna Mae',
      lastName: 'Perdido',
      role: 'PANELIST',
      panelist: {
        create: {
          isExternal: false,
          isAvailableAsAdviser: true,
        }
      }
    }
  });
  console.log('Created Panelist3 test account');

  // 3. Enrolled Student Test Account
  const firstProgram = await prisma.program.findFirst();
  if (firstProgram) {
    await prisma.user.upsert({
      where: { email: 'student@earist.edu.ph' },
      update: {},
      create: {
        email: 'student@earist.edu.ph',
        passwordHash,
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'STUDENT',
        student: {
          create: {
            studentNumber: '2026-0001',
            dateOfBirth: new Date('1995-05-15T00:00:00.000Z'),
            programId: firstProgram.id,
            admissionStatus: 'ENROLLED',
          }
        }
      }
    });
    console.log('Created Student test account');
  }

  // 4. Applicant Test Accounts
  const allPrograms = await prisma.program.findMany();
  const allUndergradPrograms = await prisma.undergraduateProgram.findMany();

  if (allPrograms.length > 0 && allUndergradPrograms.length > 0) {
    // Applicant 1 - Aligned, Exam Passed, COR Verified (eligible for promotion)
    await prisma.user.upsert({
      where: { email: 'applicant1@earist.edu.ph' },
      update: {},
      create: {
        email: 'applicant1@earist.edu.ph',
        passwordHash,
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        role: 'APPLICANT',
        student: {
          create: {
            cellphone: '+639171234567',
            dateOfBirth: new Date('1998-01-15T00:00:00.000Z'),
            pinnacleApplicantId: 'PIN-2026-001',
            programId: allPrograms[0].id,
            undergraduateProgramId: allUndergradPrograms[0].id,
            admissionStatus: 'APPLICANT',
            isProgramAligned: true,
            alignmentStatus: 'ALIGNED',
          }
        }
      }
    });
    console.log('Created Applicant 1 (Aligned, eligible)');

    // Applicant 2 - Pending Waiver
    await prisma.user.upsert({
      where: { email: 'applicant2@earist.edu.ph' },
      update: {},
      create: {
        email: 'applicant2@earist.edu.ph',
        passwordHash,
        firstName: 'Maria',
        lastName: 'Santos',
        role: 'APPLICANT',
        student: {
          create: {
            cellphone: '+639181234567',
            dateOfBirth: new Date('1999-03-20T00:00:00.000Z'),
            pinnacleApplicantId: 'PIN-2026-002',
            programId: allPrograms[0].id,
            undergraduateProgramId: allUndergradPrograms.length > 1 ? allUndergradPrograms[1].id : allUndergradPrograms[0].id,
            admissionStatus: 'APPLICANT',
            isProgramAligned: false,
            alignmentStatus: 'PENDING_WAIVER',
            bridgingWaiver: {
              create: {
                intendedProgramId: allPrograms[0].id,
                undergraduateProgramId: allUndergradPrograms.length > 1 ? allUndergradPrograms[1].id : allUndergradPrograms[0].id,
                status: 'PENDING',
                waiverFormDownloadedAt: new Date()
              }
            }
          }
        }
      }
    });
    console.log('Created Applicant 2 (Pending Waiver)');

    // Applicant 3 - Aligned, Exam Scheduled
    await prisma.user.upsert({
      where: { email: 'applicant3@earist.edu.ph' },
      update: {},
      create: {
        email: 'applicant3@earist.edu.ph',
        passwordHash,
        firstName: 'Pedro',
        lastName: 'Reyes',
        role: 'APPLICANT',
        student: {
          create: {
            cellphone: '+639191234567',
            dateOfBirth: new Date('2000-06-10T00:00:00.000Z'),
            pinnacleApplicantId: 'PIN-2026-003',
            programId: allPrograms.length > 1 ? allPrograms[1].id : allPrograms[0].id,
            undergraduateProgramId: allUndergradPrograms[0].id,
            admissionStatus: 'APPLICANT',
            isProgramAligned: true,
            alignmentStatus: 'ALIGNED',
          }
        }
      }
    });
    console.log('Created Applicant 3 (Aligned, Exam Scheduled)');

    // Applicant 4 - Cleared (waiver validated)
    await prisma.user.upsert({
      where: { email: 'applicant4@earist.edu.ph' },
      update: {},
      create: {
        email: 'applicant4@earist.edu.ph',
        passwordHash,
        firstName: 'Ana',
        lastName: 'Garcia',
        role: 'APPLICANT',
        student: {
          create: {
            cellphone: '+639201234567',
            dateOfBirth: new Date('1997-09-25T00:00:00.000Z'),
            pinnacleApplicantId: 'PIN-2026-004',
            programId: allPrograms[0].id,
            undergraduateProgramId: allUndergradPrograms.length > 2 ? allUndergradPrograms[2].id : allUndergradPrograms[0].id,
            admissionStatus: 'APPLICANT',
            isProgramAligned: false,
            alignmentStatus: 'CLEARED',
            bridgingWaiver: {
              create: {
                intendedProgramId: allPrograms[0].id,
                undergraduateProgramId: allUndergradPrograms.length > 2 ? allUndergradPrograms[2].id : allUndergradPrograms[0].id,
                status: 'VALIDATED',
                validatedAt: new Date()
              }
            }
          }
        }
      }
    });
    console.log('Created Applicant 4 (Cleared)');

    // Applicants 5-12 for pagination testing
    const additionalApplicants = [
      { email: 'applicant5@earist.edu.ph', firstName: 'Carlos', lastName: 'Mendoza', alignment: 'ALIGNED' as const },
      { email: 'applicant6@earist.edu.ph', firstName: 'Rosa', lastName: 'Lim', alignment: 'PENDING_WAIVER' as const },
      { email: 'applicant7@earist.edu.ph', firstName: 'Miguel', lastName: 'Torres', alignment: 'ALIGNED' as const },
      { email: 'applicant8@earist.edu.ph', firstName: 'Elena', lastName: 'Cruz', alignment: 'CLEARED' as const },
      { email: 'applicant9@earist.edu.ph', firstName: 'Ricardo', lastName: 'Villanueva', alignment: 'ALIGNED' as const },
      { email: 'applicant10@earist.edu.ph', firstName: 'Sofia', lastName: 'Aquino', alignment: 'PENDING_WAIVER' as const },
      { email: 'applicant11@earist.edu.ph', firstName: 'Andres', lastName: 'Ramos', alignment: 'ALIGNED' as const },
      { email: 'applicant12@earist.edu.ph', firstName: 'Isabel', lastName: 'Fernandez', alignment: 'CLEARED' as const },
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
          role: 'APPLICANT',
          student: {
            create: {
              cellphone: `+63917${String(1000000 + i).slice(0, 7)}`,
              dateOfBirth: new Date(`199${5 + (i % 5)}-0${(i % 9) + 1}-15T00:00:00.000Z`),
              pinnacleApplicantId: `PIN-2026-${String(i + 5).padStart(3, '0')}`,
              programId: allPrograms[progIndex].id,
              undergraduateProgramId: allUndergradPrograms[undergradIndex].id,
              admissionStatus: 'APPLICANT',
              isProgramAligned: app.alignment !== 'PENDING_WAIVER',
              alignmentStatus: app.alignment,
              ...(app.alignment !== 'ALIGNED' ? {
                bridgingWaiver: {
                  create: {
                    intendedProgramId: allPrograms[progIndex].id,
                    undergraduateProgramId: allUndergradPrograms[undergradIndex].id,
                    status: app.alignment === 'CLEARED' ? 'VALIDATED' : 'PENDING',
                    ...(app.alignment === 'CLEARED' ? { validatedAt: new Date() } : { waiverFormDownloadedAt: new Date() })
                  }
                }
              } : {})
            }
          }
        }
      });
    }
    console.log('Created Applicants 5-12 for pagination testing');
  }

  // 5. Exam Slots
  console.log('Seeding exam slots...');
  const examSlots = [
    { programId: allPrograms[0].id, examDate: new Date('2026-08-01T00:00:00.000Z'), examTime: new Date('2026-08-01T09:00:00.000Z'), maxSlots: 30 },
    { programId: allPrograms[0].id, examDate: new Date('2026-08-15T00:00:00.000Z'), examTime: new Date('2026-08-15T09:00:00.000Z'), maxSlots: 30 },
    { programId: allPrograms[1].id, examDate: new Date('2026-08-02T00:00:00.000Z'), examTime: new Date('2026-08-02T14:00:00.000Z'), maxSlots: 25 },
    { programId: allPrograms[4].id, examDate: new Date('2026-08-05T00:00:00.000Z'), examTime: new Date('2026-08-05T10:00:00.000Z'), maxSlots: 20 },
  ];

  const createdSlots = [];
  for (const slot of examSlots) {
    const existing = await prisma.examSlot.findFirst({
      where: { programId: slot.programId, examDate: slot.examDate }
    });
    if (!existing) {
      const created = await prisma.examSlot.create({ data: slot as any });
      createdSlots.push(created);
      console.log(`Created exam slot: ${slot.examDate.toLocaleDateString()}`);
    } else {
      createdSlots.push(existing);
      console.log(`Exam slot already exists: ${slot.examDate.toLocaleDateString()}`);
    }
  }

  // 6. Exam Applications (for applicants with ALIGNED status)
  console.log('Seeding exam applications...');
  const applicantsToSchedule = [
    { email: 'applicant1@earist.edu.ph', slotIndex: 0, status: 'PASSED' },
    { email: 'applicant3@earist.edu.ph', slotIndex: 0, status: 'SCHEDULED' },
    { email: 'applicant5@earist.edu.ph', slotIndex: 1, status: 'PENDING' },
    { email: 'applicant7@earist.edu.ph', slotIndex: 2, status: 'PASSED' },
    { email: 'applicant9@earist.edu.ph', slotIndex: 3, status: 'FAILED' },
  ];

  for (const app of applicantsToSchedule) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: app.email },
        include: { student: true }
      });

      if (user?.student) {
        const existing = await prisma.entranceExamApplication.findFirst({
          where: { studentId: user.student.id }
        });

        if (!existing && createdSlots[app.slotIndex]) {
          const slot = createdSlots[app.slotIndex];
          await prisma.entranceExamApplication.create({
            data: {
              studentId: user.student.id,
              programId: user.student.programId,
              slotId: slot.id,
              examDate: slot.examDate,
              examTime: slot.examTime,
              status: app.status as any,
              createdAt: new Date(),
            }
          });
          console.log(`Created exam application for ${app.email} - ${app.status}`);
        }
      }
    } catch (e: any) {
      console.log(`Skipping ${app.email}: ${e.message}`);
    }
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
