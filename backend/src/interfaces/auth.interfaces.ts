import { UserRole } from '@prisma/client';

export interface RegisterInput {
  applicantId: string;
  firstName: string;
  lastName: string;
  email: string;
  cellphone: string;
  dateOfBirth: string;
  programId: string;
  programType: string;
  undergraduateProgramId: string;
  password: string;
}

export interface LoginInput {
  role: string;
  password: string;
  email?: string;
  applicantId?: string;
  studentId?: string;
  birthdate?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}
