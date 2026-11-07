import { DefaultSession } from "next-auth";
import type { CurrentSessionError } from "../lib/current-session";

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
      currentAccountError?: CurrentSessionError;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    accessToken: string;
    mustChangePassword: boolean;
    currentAccountError?: CurrentSessionError;
  }
}
