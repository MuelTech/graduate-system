import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from '../repositories/auth.repository';
import { RegisterInput, LoginInput, UserResponse, LoginResponse } from '../interfaces/auth.interfaces';
import { UserRole, AdmissionStatus, AlignmentStatus } from '@prisma/client';

export class AuthService {
    private authRepository = new AuthRepository();

    private getJwtSecret(): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET environment variable is missing!");
        }
        return secret;
    }

    // Advanced Domain-Based Business Logic for Program Alignment
    private checkProgramAlignment(prereqName: string, intendedName: string): boolean {
        const prereq = prereqName.toLowerCase();
        const intended = intendedName.toLowerCase();
        
        // Define domains and their associated keywords based on EARIST programs
        const domains = [
            {
                name: 'Business & Administration',
                keywords: ['business', 'management', 'accountancy', 'accounting', 'entrepreneurship', 'office', 'finance', 'marketing', 'public administration', 'hotel and restaurant']
            },
            {
                name: 'Education & Teaching',
                keywords: ['education', 'teaching', 'childhood', 'guidance', 'counseling']
            },
            {
                name: 'Technology & IT',
                keywords: ['technology', 'computer', 'information', 'electronics', 'electrical']
            },
            {
                name: 'Science & Math',
                keywords: ['science', 'mathematics', 'math']
            },
            {
                name: 'Arts, Humanities & Psychology',
                keywords: ['arts', 'psychology', 'communication', 'journalism', 'broadcasting', 'letters', 'english', 'filipinology', 'philosophy', 'theater']
            },
            {
                name: 'Engineering & Built Environment',
                keywords: ['engineering', 'architecture', 'interior design', 'environmental planning', 'civil', 'mechanical', 'railway']
            },
            {
                name: 'Physical Education & Sports',
                keywords: ['physical education', 'sports', 'human kinetics', 'exercises']
            }
        ];

        // Check if both the prerequisite and intended program share a common domain
        for (const domain of domains) {
            const prereqMatch = domain.keywords.some(keyword => prereq.includes(keyword));
            const intendedMatch = domain.keywords.some(keyword => intended.includes(keyword));
            
            // If they both hit keywords in the exact same domain, they are aligned!
            if (prereqMatch && intendedMatch) {
                return true;
            }
        }
        
        // If no common domain is found, they are misaligned
        return false;
    }


    async register(data: RegisterInput): Promise<UserResponse> {
        // 1. Check existing records
        const existingUser = await this.authRepository.findUserByEmail(data.email);
        if (existingUser) {
            throw new Error("Email is already registered!");
        }

        const existingApplicant = await this.authRepository.findStudentByApplicantId(data.applicantId);
        if (existingApplicant) {
            throw new Error("Applicant ID is already registered!");
        }

        // 2. Fetch intended and prerequisite programs
        const intendedProgram = await this.authRepository.findProgramById(data.programId);
        if (!intendedProgram) {
            throw new Error("Selected intended program could not be found!");
        }

        let prereqName = "";
        let prereqId = data.undergraduateProgramId;

        if (data.programType === "Doctoral") {
            const masters = await this.authRepository.findProgramById(prereqId);
            if (!masters) throw new Error("Prerequisite Masters program not found!");
            prereqName = masters.programName;
        } else {
            const undergrad = await this.authRepository.findUndergraduateProgramById(prereqId);
            if (!undergrad) throw new Error("Prerequisite Undergraduate program not found!");
            prereqName = undergrad.programName;
        }

        // 3. Perform Alignment Check!
        const isAligned = this.checkProgramAlignment(prereqName, intendedProgram.programName);
        const alignmentStatus = isAligned ? AlignmentStatus.ALIGNED : AlignmentStatus.PENDING_WAIVER;

        // 4. Hash password
        const hashedPassword = await bcrypt.hash(data.password, 10);

        // 5. Construct payloads
        const userData = {
            email: data.email,
            passwordHash: hashedPassword,
            firstName: data.firstName,
            lastName: data.lastName,
            role: UserRole.APPLICANT
        };

        const parseDob = new Date(`${data.dateOfBirth}T00:00:00.000Z`);

        const studentData: any = {
            cellphone: data.cellphone,
            dateOfBirth: parseDob,
            pinnacleApplicantId: data.applicantId,
            programId: intendedProgram.id,
            admissionStatus: AdmissionStatus.APPLICANT,
            isProgramAligned: isAligned,
            alignmentStatus: alignmentStatus
        };

        let bridgingWaiverData: any = null;

        if (data.programType === "Doctoral") {
            studentData.previousMastersProgramId = prereqId;
            if (!isAligned) {
                bridgingWaiverData = { intendedProgramId: intendedProgram.id };
            }
        } else {
            studentData.undergraduateProgramId = prereqId;
            if (!isAligned) {
                bridgingWaiverData = {
                    intendedProgramId: intendedProgram.id,
                    undergraduateProgramId: prereqId
                };
            }
        }

        // 6. Save atomically
        const newUser = await this.authRepository.registerApplicant(userData, studentData, bridgingWaiverData);

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

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            this.getJwtSecret(),
            { expiresIn: '24h' }
        );

        return {
            token,
            user: { id: user.id, email: user.email, role: user.role },
        };
    }
}
