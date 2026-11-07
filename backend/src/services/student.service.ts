import { admissionStudentAuthorization } from "../access/admission-student-authorization";
import { StudentRepository } from '../repositories/student.repository';
import { UpdateCompExamInput } from '../interfaces/student.interfaces';

export class StudentService {
  constructor(private readonly access = admissionStudentAuthorization) {}
  private studentRepo = new StudentRepository();

  async getStudentJourney(userId: string) {
    const journey = await this.studentRepo.getStudentJourney(userId);
    if (!journey) {
      throw new Error('Student profile not found');
    }
    return journey;
  }

  async updateCompExam(studentId: string, data: UpdateCompExamInput, actorId: string) {
    await this.access.assert(actorId, "students.comprehensive_exam.manage");
    const student = await this.studentRepo.getStudentById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    return this.studentRepo.updateComprehensiveExamStatus(studentId, data.status);
  }
}
