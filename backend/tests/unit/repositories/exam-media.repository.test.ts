import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ examMedia: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { ExamMediaRepository } from "../../../src/repositories/exam-media.repository";
import { toApplicantQuestion } from "../../../src/repositories/exam-content.projection";

beforeEach(() => vi.resetAllMocks());

describe("ExamMediaRepository private persistence and visibility", () => {
  it("guards failed-import cleanup against any question/option reference and identity change", async () => {
    await new ExamMediaRepository().deleteUnreferenced("media1", "exam-media/key", "local");
    expect(db.examMedia.deleteMany).toHaveBeenCalledWith({ where: {
      id: "media1", storageKey: "exam-media/key", storageProvider: "local",
      stimulusQuestions: { none: {} }, options: { none: {} },
    } });
  });
  it("returns only opaque identity on creation", async () => {
    const data = { storageKey: "exam-media/private", storageProvider: "local", verifiedMimeType: "image/png", sizeBytes: 10, checksum: "hash" };
    db.examMedia.create.mockResolvedValue({ id: "media1" });
    expect(await new ExamMediaRepository().create(data)).toEqual({ id: "media1" });
    expect(db.examMedia.create).toHaveBeenCalledWith({ data, select: { id: true } });
  });

  it("allows Admin to resolve a staged image by opaque identity", async () => {
    await new ExamMediaRepository().findForAdmin("media1");
    expect(db.examMedia.findUnique.mock.calls[0][0].where).toEqual({ id: "media1" });
  });

  it("requires Applicant media to be an IMAGE stimulus or an option in the visible shared bank", async () => {
    await new ExamMediaRepository().findForApplicant("media1");
    const query = db.examMedia.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: "media1", OR: [
      { stimulusQuestions: { some: { stimulusType: "IMAGE" } } },
      { options: { some: {} } },
    ] });
    expect(JSON.stringify(query)).not.toContain("isCorrect");
    expect(query.select).not.toHaveProperty("options");
    expect(query.select).not.toHaveProperty("stimulusQuestions");
  });

  it("keeps joined media records and correctness out of the Applicant question DTO", () => {
    const mediaId = "c523f44d-c5ae-4b82-91bf-ccaf165ad567";
    const media = { id: mediaId, storageKey: "exam-media/private-key", storageProvider: "local", checksum: "secret-hash" };
    const internal = {
      id: "q1", questionText: "Choose.", type: "MULTIPLE_CHOICE" as const, order: 1,
      stimulusType: "IMAGE" as const, stimulusMediaId: mediaId, structuredStimulus: null,
      stimulusMedia: media,
      options: [{ id: "o1", questionId: "q1", label: "F", order: 0, optionText: null, mediaId, media, isCorrect: true }],
    };
    const dto = toApplicantQuestion(internal);
    expect(dto.stimulusMediaId).toBe(mediaId);
    expect(dto.options[0].mediaId).toBe(mediaId);
    const serialized = JSON.stringify(dto);
    for (const forbidden of ["storageKey", "storageProvider", "checksum", "isCorrect", "private-key", "secret-hash"]) expect(serialized).not.toContain(forbidden);
    expect(dto).not.toHaveProperty("stimulusMedia");
    expect(dto.options[0]).not.toHaveProperty("media");
  });
});
