import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from '../repositories/auth.repository';
import { RegisterInput, LoginInput, UserResponse, LoginResponse } from '../interfaces/auth.interfaces';
import { Prisma, UserRole, AdmissionStatus, AlignmentStatus } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { sanitizeAdminCapabilities } from '../config/admin-capabilities';

export class AuthService {
    private authRepository = new AuthRepository();

    private getJwtSecret(): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new AppError("JWT_SECRET environment variable is missing!", 500);
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

        // Strict Gmail Exclusivity Rule
        if (!data.email.toLowerCase().endsWith("@gmail.com")) {
            throw new AppError("Invalid email domain. Only @gmail.com account are permitted for applicants.", 400);
        }

        // 1. Check existing records
        const existingUser = await this.authRepository.findUserByEmail(data.email);
        if (existingUser) {
            throw new AppError("Email is already registered!", 409);
        }

        const existingApplicant = await this.authRepository.findStudentByApplicantId(data.applicantId);
        if (existingApplicant) {
            throw new AppError("Applicant ID is already registered!", 409);
        }

        // 2. Fetch intended and prerequisite programs
        const intendedProgram = await this.authRepository.findProgramById(data.programId);
        if (!intendedProgram) {
            throw new AppError("Selected intended program could not be found!", 404);
        }

        let prereqName = "";
        let prereqId = data.undergraduateProgramId;

        if (data.programType === "Doctoral") {
            const masters = await this.authRepository.findProgramById(prereqId);
            if (!masters) throw new AppError("Prerequisite Masters program not found!", 404);
            prereqName = masters.programName;
        } else {
            const undergrad = await this.authRepository.findUndergraduateProgramById(prereqId);
            if (!undergrad) throw new AppError("Prerequisite Undergraduate program not found!", 404);
            prereqName = undergrad.programName;
        }

        // 3. Perform Alignment Check!
        const isAligned = this.checkProgramAlignment(prereqName, intendedProgram.programName);
        const alignmentStatus = isAligned ? AlignmentStatus.ALIGNED : AlignmentStatus.PENDING_WAIVER;

        // 4. Hash password
        const hashedPassword = await bcrypt.hash(data.password, 10);

        // 5. Construct payloads
        const userData: Prisma.UserCreateInput = {
            email: data.email,
            passwordHash: hashedPassword,
            firstName: data.firstName,
            lastName: data.lastName,
            role: UserRole.APPLICANT
        };

        const parseDob = new Date(`${data.dateOfBirth}T00:00:00.000Z`);

        const studentData: Prisma.StudentCreateWithoutUserInput = {
            cellphone: data.cellphone,
            dateOfBirth: parseDob,
            pinnacleApplicantId: data.applicantId,
            program: { connect: { id: intendedProgram.id } },
            admissionStatus: AdmissionStatus.APPLICANT,
            isProgramAligned: isAligned,
            alignmentStatus: alignmentStatus
        };

        let bridgingWaiverData: { intendedProgramId: string; undergraduateProgramId?: string } | null = null;

        if (data.programType === "Doctoral") {
            // For doctoral, connect previous masters program
            (studentData as any).previousMastersProgram = { connect: { id: prereqId } };
            if (!isAligned) {
                bridgingWaiverData = { intendedProgramId: intendedProgram.id };
            }
        } else {
            // For masters, connect undergraduate program
            (studentData as any).undergraduateProgram = { connect: { id: prereqId } };
            if (!isAligned) {
                bridgingWaiverData = {
                    intendedProgramId: intendedProgram.id,
                    undergraduateProgramId: prereqId
                };
            }
        }

        // 6. Save atomically
        const newUser = await this.authRepository.registerApplicant(userData, studentData, bridgingWaiverData);

        return { id: newUser.id, email: newUser.email, role: newUser.role, mustChangePassword: false }
    }

    async login(data: LoginInput): Promise<LoginResponse> {
        let user = null;

        if (data.role === 'applicant') {
            if (!data.applicantId) throw new AppError("Applicant ID is required!", 400);
            const student = await this.authRepository.findStudentByApplicantId(data.applicantId);
            user = student?.user || null;
            
            if (user && user.role !== 'APPLICANT') {
                throw new AppError("This applicant has already been promoted. Please log in using the Student portal with your Student Number.", 403);
            }
        }
        else if (data.role === 'student') {
            const studentNumber = String(data.studentNumber ?? "").trim();
            if (!studentNumber) throw new AppError("Student Number is required!", 400);

            // COR-6: Student login is Student Number + existing password only.
            // Date of Birth is not an authentication credential.
            const student = await this.authRepository.findStudentByStudentNumber(studentNumber);
            user = student?.user || null;

            if (user && user.role !== 'STUDENT') {
                throw new AppError("This user is not registered as a Student.", 403);
            }
        }
        else {
            if (!data.email) throw new AppError("Email is required!", 400);
            user = await this.authRepository.findUserByEmail(data.email);

            if (user) {
                const requestedRole = String(data.role || "").toLowerCase();
                if (requestedRole === "faculty" || requestedRole === "panelist") {
                    if (user.role !== "FACULTY" && user.role !== "PANELIST") {
                        throw new AppError("This account is not registered as a Faculty member.", 403);
                    }
                } else if (requestedRole === "admin") {
                    if (user.role !== "ADMIN") {
                        throw new AppError("This account is not registered as an Administrator.", 403);
                    }
                }
            }
        }

        if (!user) {
            throw new AppError("Invalid credentials!", 401);
        }

        if (!user.isActive) {
            throw new AppError("This account has been deactivated. Please contact the Administrator.", 403);
        }

        const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AppError("Invalid login credentials!", 401);
        }

        const effectiveRole: UserRole = user.role === UserRole.PANELIST ? UserRole.FACULTY : user.role;
        const panelist = (user as any).panelist;
        if (effectiveRole === UserRole.FACULTY && panelist && !panelist.isActive) {
            throw new AppError("This Faculty profile is currently inactive.", 403);
        }

        const token = jwt.sign(
            { userId: user.id, role: effectiveRole, mustChangePassword: user.mustChangePassword },
            this.getJwtSecret(),
            { expiresIn: '24h' }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                title: user.title,
                suffix: user.suffix,
                role: effectiveRole,
                mustChangePassword: user.mustChangePassword,
                adminAccessLevel: effectiveRole === UserRole.ADMIN ? (user.adminAccessLevel ?? "FULL") : null,
                adminCapabilities:
                    effectiveRole === UserRole.ADMIN
                        ? sanitizeAdminCapabilities(user.adminCapabilities)
                        : [],
                facultyProfile:
                    effectiveRole === UserRole.FACULTY && panelist
                        ? {
                              id: panelist.id,
                              isExternal: Boolean(panelist.isExternal),
                              isAvailableAsAdviser: panelist.isExternal ? false : Boolean(panelist.isAvailableAsAdviser),
                              canEvaluateEssays: Boolean(panelist.canEvaluateEssays),
                              highestEducationalAttainment: panelist.highestEducationalAttainment,
                              officeAffiliation: panelist.officeAffiliation,
                              specialization: panelist.specialization,
                          }
                        : null,
            },
        };
    }

    async getMe(userId: string): Promise<UserResponse> {
        const user = await this.authRepository.findUserById(userId);
        if (!user || !user.isActive) {
            throw new AppError("Account not found or inactive.", 403);
        }
        const effectiveRole: UserRole = user.role === UserRole.PANELIST ? UserRole.FACULTY : user.role;
        const panelist = user.panelist;
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            title: user.title,
            suffix: user.suffix,
            role: effectiveRole,
            mustChangePassword: user.mustChangePassword,
            adminAccessLevel: effectiveRole === UserRole.ADMIN ? (user.adminAccessLevel ?? "FULL") : null,
            adminCapabilities:
                effectiveRole === UserRole.ADMIN
                    ? sanitizeAdminCapabilities(user.adminCapabilities)
                    : [],
            facultyProfile:
                effectiveRole === UserRole.FACULTY && panelist
                    ? {
                          id: panelist.id,
                          isExternal: Boolean(panelist.isExternal),
                          isAvailableAsAdviser: panelist.isExternal ? false : Boolean(panelist.isAvailableAsAdviser),
                          canEvaluateEssays: Boolean(panelist.canEvaluateEssays),
                          highestEducationalAttainment: panelist.highestEducationalAttainment,
                          officeAffiliation: panelist.officeAffiliation,
                          specialization: panelist.specialization,
                      }
                    : null,
        };
    }

    async changePassword(userId: string, newPassword: string): Promise<{ token: string }> {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await this.authRepository.updatePassword(userId, passwordHash);

        // Get updated user to issue new JWT
        const user = await this.authRepository.findUserById(userId);
        if (!user) {
            throw new AppError("User not found!", 404);
        }

        const effectiveRole: UserRole = user.role === UserRole.PANELIST ? UserRole.FACULTY : user.role;
        // Issue new JWT with mustChangePassword: false
        const token = jwt.sign(
            { userId: user.id, role: effectiveRole, mustChangePassword: false },
            this.getJwtSecret(),
            { expiresIn: '24h' }
        );

        return { token };
    }
}
