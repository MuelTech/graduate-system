import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  getProfileWithRelations: vi.fn(),
  updateContactCellphone: vi.fn(),
}));

vi.mock("../../../src/repositories/applicant.repository", () => ({
  ApplicantRepository: class {
    getProfileWithRelations = repo.getProfileWithRelations;
    updateContactCellphone = repo.updateContactCellphone;
  },
}));

import { ApplicantService } from "../../../src/services/applicant.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApplicantService profile and contact management", () => {
  it("projects safe applicant profile details including contact and registration metadata", async () => {
    repo.getProfileWithRelations.mockResolvedValue({
      pinnacleApplicantId: "APP-2026-101",
      cellphone: "+639171234567",
      createdAt: new Date("2026-11-18T00:00:00.000Z"),
      user: {
        firstName: "Maria",
        lastName: "Santos",
        email: "maria.santos@gmail.com",
      },
      program: {
        programName: "Master in Business Administration (MBA)",
        programType: "MASTERS",
        programCode: "MBA",
      },
      examApplications: [
        {
          status: "PENDING",
          slot: {
            examDate: new Date("2026-11-25T00:00:00.000Z"),
            examTime: new Date("1970-01-01T09:00:00.000Z"),
          },
        },
      ],
    });

    const profile = await new ApplicantService().getProfile("user-1");

    expect(profile).toMatchObject({
      firstName: "Maria",
      lastName: "Santos",
      email: "maria.santos@gmail.com",
      cellphone: "+639171234567",
      applicantId: "APP-2026-101",
      program: "Master in Business Administration (MBA)",
      programType: "MASTERS",
      programCode: "MBA",
      currentStep: 1,
      examStatus: "PENDING",
      hasPassedExam: false,
    });
  });

  it("validates +63 Philippine mobile numbers before updating applicant contact", async () => {
    await expect(
      new ApplicantService().updateProfile("user-1", {
        cellphone: "0917666869054",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.updateContactCellphone).not.toHaveBeenCalled();

    repo.updateContactCellphone.mockResolvedValue({
      id: "stud-1",
      cellphone: "+639171234567",
    });
    const res = await new ApplicantService().updateProfile("user-1", {
      cellphone: " +639171234567 ",
    });

    expect(repo.updateContactCellphone).toHaveBeenCalledWith(
      "user-1",
      "+639171234567",
    );
    expect(res).toEqual({
      message: "Contact number updated.",
      cellphone: "+639171234567",
    });
  });
});
