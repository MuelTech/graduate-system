/** Bounded FACULTY-10 management DTO. Separate from defense participant types. */
export interface FacultyResponse {
  id: string;
  userId: string;
  highestEducationalAttainment: string | null;
  officeAffiliation: string | null;
  specialization: string | null;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
  isActive: boolean;
  capabilityKeys: "essay.evaluate"[];
  createdAt: string;
  user: {
    id: string;
    role: "FACULTY" | "PANELIST";
    firstName: string;
    lastName: string;
    email: string;
    title: string | null;
    suffix: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: { firstName: string; lastName: string } | null;
    updatedBy: { firstName: string; lastName: string } | null;
  };
}

export interface FacultyCreateResponse {
  account: FacultyResponse;
  temporaryPassword: string;
}

/** Display model intentionally excludes credentials and raw access/role keys. */
export interface Faculty {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  title: string;
  suffix: string;
  email: string;
  qualification: string;
  affiliation: string;
  specialization: string;
  isExternal: boolean;
  isActive: boolean;
  isAvailableAsAdviser: boolean;
  essayEvaluation: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type FacultyForm = Pick<
  Faculty,
  | "firstName"
  | "lastName"
  | "title"
  | "suffix"
  | "email"
  | "qualification"
  | "affiliation"
  | "specialization"
  | "isExternal"
  | "isActive"
  | "isAvailableAsAdviser"
  | "essayEvaluation"
>;
