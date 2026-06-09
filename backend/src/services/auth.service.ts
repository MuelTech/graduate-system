import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from '../repositories/auth.repository';
import { RegisterInput, LoginInput, UserResponse, LoginResponse } from '../interfaces/auth.interfaces';
import { UserRole, AdmissionStatus } from '@prisma/client';

export class AuthService {
    private authRepository = new AuthRepository();

    private getJwtSecret(): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET environment variable is missing!");
        }

        return secret;
    }

    async register(data: RegisterInput): Promise<UserResponse> {
        // Check if email already exist
        const existingUser = await this.authRepository.findUserByEmail(data.email);
        if (existingUser) {
            throw new Error("Email is already registered!");
        }

        //Check if applicant ID already exist
        const existingApplicant = await this.authRepository.findStudentByApplicantId(data.applicantId);
        if (existingApplicant) {
            throw new Error("Applicant ID is already registered!");
        }

        // Find target by program ID instead of program name
        const program = await this.authRepository.findProgramById(data.programId);
        if (!program) {
            throw new Error("Selected program could not be found in the database!");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(data.password, 10);

        // Construct payloads & Save
        const userData = {
            email: data.email,
            passwordHash: hashedPassword,
            firstName: data.firstName,
            lastName: data.lastName,
            role: UserRole.APPLICANT
        };

        // Normalize the date to exact Midnight UTC to prevent local JS shifting
        const parseDob = new Date(`${data.dateOfBirth}T00:00:00.000Z`);

        const studentData: any = {
            cellphone: data.cellphone,
            dateOfBirth: parseDob,
            pinnacleApplicantId: data.applicantId,
            programId: program.id,
            admissionStatus: AdmissionStatus.APPLICANT,
        };

        // Dynamically assign the prerequisite field based on the applicant's target level
        if (data.programType === "Doctoral") {
            studentData.previousMastersProgramId = data.undergraduateProgramId;
        } else {
            studentData.undergraduateProgramId = data.undergraduateProgramId;
        }

        const newUser = await this.authRepository.registerApplicant(userData, studentData);


        return { id: newUser.id, email: newUser.email, role: newUser.role }
    }

    async login(data: LoginInput): Promise<LoginResponse> {
        let user = null;

        if (data.role === 'applicant') {
            if (!data.applicantId) throw new Error("Applicant ID is required!");
            const student = await this.authRepository.findStudentByApplicantId(data.applicantId);
            user = student?.user || null;
        }
        else if (data.role === 'student') {
            if (!data.studentId) throw new Error("Student ID is required!");
            const dob = data.birthdate ? new Date(`${data.birthdate}T00:00:00.000Z`) : undefined;

            const student = await this.authRepository.findStudentByStudentNumber(data.studentId, dob);
            user = student?.user || null;
        }
        else {
            //Admin, Panelist, or others
            if (!data.email) throw new Error("Email is required!");
            user = await this.authRepository.findUserByEmail(data.email);
        }

        if (!user) {
            throw new Error("Invalid credentials!");
        }

        const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error("Invalid login credentials!");
        }

        //Generate JWT token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            this.getJwtSecret(),
            { expiresIn: '24h' }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            },
        };
    }
}