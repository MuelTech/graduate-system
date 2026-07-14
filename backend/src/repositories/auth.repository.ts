import prisma from '../config/database';
import { Prisma, User, Student, Program, UndergraduateProgram } from '@prisma/client';

export class AuthRepository {
    async findUserByEmail(email: string): Promise <User | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    async findStudentByApplicantId(applicantId: string): Promise <(Student & { user: User}) | null> {
        return prisma.student.findFirst({
            where: { pinnacleApplicantId: applicantId },
            include: { user: true}
        });
    }

    async findStudentByStudentNumber(studentNumber: string, dob?: Date): Promise <(Student & { user: User}) | null> {
         const whereClause: Prisma.StudentWhereInput = { studentNumber };
         if (dob) {
            whereClause.dateOfBirth = dob;
         }

         return prisma.student.findFirst({
            where: whereClause,
            include: { user: true }
         });
    }

    async findProgramByName(programName: string): Promise <Program | null> {
        return prisma.program.findFirst({
            where: { programName }
        });
    }

    async findProgramById(id: string): Promise<Program | null> {
        return prisma.program.findUnique({
            where: { id }
        });
    }

    async findUndergraduateProgramById(id: string): Promise<UndergraduateProgram | null> {
        return prisma.undergraduateProgram.findUnique({
            where: { id }
        });
    }

    // Creates User, Student, and optionally BridgingWaiver atomically
    async registerApplicant(
        userData: Prisma.UserCreateInput, 
        studentData: Prisma.StudentCreateWithoutUserInput, 
        waiverData: { intendedProgramId: string; undergraduateProgramId?: string } | null = null
    ): Promise<User> {
        return prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: userData
            });

            const newStudent = await tx.student.create({
                data: {
                    ...studentData,
                    user: { connect: { id: newUser.id } },
                }
            });

            // If waiverData is provided, they are misaligned. Generate the waiver immediately!
            if (waiverData) {
                await tx.applicantBridgingWaiver.create({
                    data: {
                        student: { connect: { id: newStudent.id } },
                        intendedProgram: { connect: { id: waiverData.intendedProgramId } },
                        ...(waiverData.undergraduateProgramId && {
                            undergraduateProgram: { connect: { id: waiverData.undergraduateProgramId } }
                        })
                    }
                });
            }

            return newUser;
        });
    }
}
