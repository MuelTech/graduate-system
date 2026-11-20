import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from '../repositories/auth.repository';
import { RegisterInput, LoginInput, UserResponse, LoginResponse } from '../interfaces/auth.interfaces';
import { Prisma, UserRole, AdmissionStatus } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { sanitizeAdminCapabilities } from '../config/admin-capabilities';
import { disconnectUserDefenseSockets } from '../realtime/defense-realtime.registry';

export class AuthService {
    private authRepository = new AuthRepository();

    private getJwtSecret(): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new AppError("JWT_SECRET environment variable is missing!", 500);
        }
        return secret;
    }

    async register(data: RegisterInput): Promise<UserResponse> {
        if (
            !data.applicantId?.trim() ||
            !data.firstName?.trim() ||
            !data.lastName?.trim() ||
            !data.email?.trim() ||
            !data.cellphone?.trim() ||
            !data.programId?.trim() ||
            !data.password
        ) {
            throw new AppError("All required fields must be filled.", 400);
        }

        // Strict Gmail Exclusivity Rule
        if (!data.email.toLowerCase().endsWith("@gmail.com")) {
            throw new AppError("Invalid email domain. Only @gmail.com account are permitted for applicants.", 400);
        }

        const normalizedCellphone = data.cellphone.trim();
        if (!/^(?:\+639|09)\d{9}$/.test(normalizedCellphone)) {
            throw new AppError("Invalid cellphone number. Please provide a valid Philippine mobile number (e.g., +639171234567).", 400);
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

        // 2. Fetch intended graduate program
        const intendedProgram = await this.authRepository.findProgramById(data.programId);
        if (!intendedProgram) {
            throw new AppError("Selected intended program could not be found!", 404);
        }
        if (intendedProgram.isActive === false) {
            throw new AppError("Selected program is not currently accepting applications.", 400);
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(data.password, 10);

        // 4. Construct payloads
        const userData: Prisma.UserCreateInput = {
            email: data.email,
            passwordHash: hashedPassword,
            firstName: data.firstName,
            lastName: data.lastName,
            role: UserRole.APPLICANT
        };

        const studentData: Prisma.StudentCreateWithoutUserInput = {
            cellphone: normalizedCellphone,
            pinnacleApplicantId: data.applicantId,
            program: { connect: { id: intendedProgram.id } },
            admissionStatus: AdmissionStatus.APPLICANT,
        };

        // 5. Save atomically
        const newUser = await this.authRepository.registerApplicant(userData, studentData);

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

        const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AppError("Invalid login credentials!", 401);
        }

        if (user.isActive === false) {
            throw new AppError("This account has been deactivated. Please contact the Administrator.", 403);
        }

        const effectiveRole: UserRole = user.role === UserRole.PANELIST ? UserRole.FACULTY : user.role;
        const panelist = (user as any).panelist;
        if (effectiveRole === UserRole.FACULTY && panelist && !panelist.isActive) {
            throw new AppError("This Faculty profile is currently inactive.", 403);
        }

        const tokenVersion =
            typeof (user as { tokenVersion?: unknown }).tokenVersion === "number"
                ? (user as { tokenVersion: number }).tokenVersion
                : 1;
        const token = jwt.sign(
            {
                userId: user.id,
                role: effectiveRole,
                mustChangePassword: user.mustChangePassword,
                tokenVersion,
            },
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
        if (!user || user.isActive === false) {
            throw new AppError("Account not found or inactive.", 403);
        }
        const effectiveRole: UserRole = user.role === UserRole.PANELIST ? UserRole.FACULTY : user.role;
        const panelist = user.panelist;
        if (effectiveRole === UserRole.FACULTY && panelist && !panelist.isActive) {
            throw new AppError("This Faculty profile is currently inactive.", 403);
        }
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
        const tokenVersion =
            typeof (user as { tokenVersion?: unknown }).tokenVersion === "number"
                ? (user as { tokenVersion: number }).tokenVersion
                : 1;
        // Issue new JWT with mustChangePassword: false and the incremented tokenVersion
        const token = jwt.sign(
            {
                userId: user.id,
                role: effectiveRole,
                mustChangePassword: false,
                tokenVersion,
            },
            this.getJwtSecret(),
            { expiresIn: '24h' }
        );

        void disconnectUserDefenseSockets(user.id, "SESSION_INVALIDATED");

        return { token };
    }
}
