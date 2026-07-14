import { CompExamStatus } from "@prisma/client";

export interface UpdateCompExamInput {
    status: CompExamStatus;
}