import prisma from "../config/database";

export class ProgramRepository {
    async getAllGraduatePrograms() {
        return prisma.program.findMany();
    }

    async getAllUndergraduatePrograms() {
        return prisma.undergraduateProgram.findMany({
            where: { isActive: true }
        });
    }
}