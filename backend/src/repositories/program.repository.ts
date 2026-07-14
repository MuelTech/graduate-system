import prisma from "../config/database";

export class ProgramRepository {
    async getAllGraduatePrograms() {
        return prisma.program.findMany({
            orderBy: {
                programName: 'asc'
            }
        });
    }

    async getAllUndergraduatePrograms() {
        return prisma.undergraduateProgram.findMany({
            where: { isActive: true },
            orderBy: {
                programName: 'asc'
            }
        });
    }
}
