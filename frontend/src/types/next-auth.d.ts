import { DefaultSession } from "next-auth";

export interface FacultySessionProfile {
  id: string;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
  canEvaluateEssays: boolean;
}

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    accessToken?: string;
    mustChangePassword?: boolean;
    adminAccessLevel?: "FULL" | "RESTRICTED" | null;
    adminCapabilities?: string[] | null;
    facultyProfile?: FacultySessionProfile | null;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      accessToken: string;
      mustChangePassword: boolean;
      adminAccessLevel?: "FULL" | "RESTRICTED" | null;
      adminCapabilities?: string[] | null;
      facultyProfile?: FacultySessionProfile | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    accessToken: string;
    mustChangePassword: boolean;
    adminAccessLevel?: "FULL" | "RESTRICTED" | null;
    adminCapabilities?: string[] | null;
    facultyProfile?: FacultySessionProfile | null;
  }
}
