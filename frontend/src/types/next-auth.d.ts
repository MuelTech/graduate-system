import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    accessToken?: string;
    mustChangePassword?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      accessToken: string;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    accessToken: string;
    mustChangePassword: boolean;
  }
}
