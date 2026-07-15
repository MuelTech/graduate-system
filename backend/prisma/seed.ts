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

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
