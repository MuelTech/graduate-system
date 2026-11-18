import prisma from '../config/database';
import { Prisma, User, Student, Program } from '@prisma/client';

export class AuthRepository {
    async findUserByEmail(email: string) {
        return prisma.user.findUnique({
            where: { email },
            include: { panelist: true },
        });
    }

    async findStudentByApplicantId(applicantId: string): Promise <(Student & { user: User}) | null> {
        return prisma.student.findFirst({
            where: { pinnacleApplicantId: applicantId },
            include: { user: true}
        });
    }

    /**
     * COR-6: Student login identifier lookup — Student Number only.
     *
     * The linked User is included so the service can enforce User role and
     * bcrypt password verification. Date of Birth is NOT part of the
     * authentication lookup (it remains profile data only).
     */
    async findStudentByStudentNumber(studentNumber: string): Promise <(Student & { user: User}) | null> {
         return prisma.student.findFirst({
            where: { studentNumber },
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

    // Creates User and Student atomically
    async registerApplicant(
        userData: Prisma.UserCreateInput,
        studentData: Prisma.StudentCreateWithoutUserInput
    ): Promise<User> {
        return prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: userData
            });

            await tx.student.create({
                data: {
                    ...studentData,
                    user: { connect: { id: newUser.id } },
                }
            });

            return newUser;
        });
    }

    async updatePassword(userId: string, passwordHash: string): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                mustChangePassword: false,
            },
        });
    }

    async findUserById(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            include: { panelist: true },
        });
    }
}
