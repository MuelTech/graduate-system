import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { WaiverService } from "../services/waiver.service";
import { ApplicantRepository } from "../repositories/applicant.repository";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const waiverService = new WaiverService();
const applicantRepo = new ApplicantRepository();

export const getMyWaiver = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const student = await applicantRepo.getProfileWithRelations(userId);
    if (!student)
      return res.status(404).json({ error: "Student profile not found" });

    const waiver = await waiverService.getMyWaiver(student.id);
    res.json(waiver);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
};

export const downloadWaiverForm = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const student = await applicantRepo.getProfileWithRelations(userId);
    if (!student)
      return res.status(404).json({ error: "Student profile not found" });

    // Fetch the waiver details to get names and programs
    const waiver = await waiverService.getMyWaiver(student.id);

    // Log that they downloaded it
    await waiverService.logWaiverDownload(student.id);

    // Create a dynamic Temporary PDF Form
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const applicantName =
      `${student.user.firstName} ${student.user.lastName}`.trim();
    const undergradProgram =
      waiver.undergraduateProgram?.programName || "Unknown Program";
    const intendedProgram =
      waiver.intendedProgram?.programName || "Unknown Program";

    // Draw Content
    page.drawText("EARIST GRADUATE SCHOOL", {
      x: 180,
      y: 750,
      size: 18,
      font: boldFont,
      color: rgb(0.6, 0, 0),
    });
    page.drawText("BRIDGING WAIVER FORM", {
      x: 200,
      y: 720,
      size: 14,
      font: boldFont,
    });

    page.drawText(
      "This is to certify that the applicant below has been advised of the required bridging subjects:",
      { x: 50, y: 650, size: 11, font },
    );

    page.drawText("Applicant Name:", {
      x: 50,
      y: 600,
      size: 12,
      font: boldFont,
    });
    page.drawText(applicantName, { x: 200, y: 600, size: 12, font });

    page.drawText("Undergraduate Course:", {
      x: 50,
      y: 560,
      size: 12,
      font: boldFont,
    });
    page.drawText(undergradProgram, { x: 200, y: 560, size: 12, font });

    page.drawText("Intended Program:", {
      x: 50,
      y: 520,
      size: 12,
      font: boldFont,
    });
    page.drawText(intendedProgram, { x: 200, y: 520, size: 12, font });

    page.drawText(
      "By signing this document, I acknowledge the required bridging subjects for my master's degree.",
      { x: 50, y: 450, size: 11, font },
    );

    page.drawText("___________________________", {
      x: 50,
      y: 350,
      size: 12,
      font,
    });
    page.drawText("Applicant Signature over Printed Name", {
      x: 50,
      y: 330,
      size: 10,
      font,
    });
    page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: 310,
      size: 10,
      font,
    });

    const pdfBytes = await pdfDoc.save();

    // Stream to client
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Bridging-Waiver-${applicantName.replace(/\s+/g, "-")}.pdf`,
    );
    res.send(Buffer.from(pdfBytes));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAdminWaiverQueue = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const queue = await waiverService.getAdminQueue();
    res.json(queue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const validateWaiver = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = req.user?.userId;
    const id = req.params.id as string;

    if (!adminId) return res.status(401).json({ error: "Unauthorized" });

    const result = await waiverService.validateWaiver(id, adminId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectWaiver = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = req.user?.userId;
    const id = req.params.id as string;
    const { notes } = req.body;

    if (!adminId) return res.status(401).json({ error: "Unauthorized" });
    if (!notes)
      return res.status(400).json({ error: "Rejection notes are required" });

    const result = await waiverService.rejectWaiver(id, adminId, notes);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
