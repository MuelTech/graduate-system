import { ProgramRepository } from "../repositories/program.repository";

export class ProgramService {
    private programRepository = new ProgramRepository();

    async getAllPrograms() {
        const graduate = await this.programRepository.getAllGraduatePrograms();
        const undergraduate = await this.programRepository.getAllUndergraduatePrograms();

        return {
            graduatePrograms: graduate,
            undergraduatePrograms: undergraduate
        }
    }
}