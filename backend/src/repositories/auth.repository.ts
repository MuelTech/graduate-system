import prisma from '../config/database';
import { Prisma, User, Student, Program } from '@prisma/client';

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
         const whereClause: any = { studentNumber };
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

    //Create both User and Student atomically for a new applicant
    async registerApplicant(userData: any, studentData: any): Promise <User> {
        return prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: userData
            });

            await tx.student.create({
                data: {
                    ...studentData,
                    userId: newUser.id,
                }
            });

            return newUser;
        });
    }

    //Find the intended program by its ID
    async findProgramById(id: string): Promise<Program | null> {
        return prisma.program.findUnique({
            where: { id }
        });
    }
}