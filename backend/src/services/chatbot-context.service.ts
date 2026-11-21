import prisma from "../config/database";
import {
  normalizeKnowledgeRole,
  type KnowledgeRole,
  type UserLiveStateContext,
} from "./chatbot-rag.service";

export interface AuthenticatedActor {
  userId: string;
  role: string;
}

const PAGE_TITLE_MAP: Array<{ prefix: string; title: string }> = [
  // Applicant portal
  { prefix: "/applicant/dashboard", title: "Applicant Dashboard" },
  { prefix: "/applicant/schedule", title: "Entrance Exam Schedule" },
  { prefix: "/applicant/exam", title: "Entrance Examination" },
  { prefix: "/applicant/results", title: "Entrance Exam Results" },
  { prefix: "/applicant/cor-upload", title: "COR Upload" },
  { prefix: "/applicant/profile", title: "Applicant Profile" },
  { prefix: "/applicant/notifications", title: "Applicant Notifications" },

  // Student portal
  { prefix: "/student/dashboard", title: "Student Dashboard" },
  { prefix: "/student/thesis/title-defense", title: "Title Defense" },
  { prefix: "/student/thesis/adviser-request", title: "Thesis Adviser Request" },
  { prefix: "/student/thesis/proposal-defense", title: "Proposal Defense" },
  { prefix: "/student/thesis/strike", title: "Plagiarism Check" },
  { prefix: "/student/thesis/final-defense", title: "Final Defense" },
  { prefix: "/student/thesis", title: "Thesis Journey Hub" },
  { prefix: "/student/plagiarism", title: "Plagiarism Check" },
  { prefix: "/student/repository/submit", title: "Research Repository Submission" },
  { prefix: "/student/repository", title: "Student Research Repository" },
  { prefix: "/student/curriculum", title: "Curriculum Checklist" },
  { prefix: "/student/journey", title: "Academic Journey" },
  { prefix: "/student/profile", title: "Student Profile" },
  { prefix: "/student/announcements", title: "Student Announcements" },
  { prefix: "/student/notifications", title: "Student Notifications" },

  // Faculty / Panelist portal
  { prefix: "/panelist/defense-workspace", title: "Defense Workspace" },
  { prefix: "/panelist/defense-lobby", title: "Defense Lobby" },
  { prefix: "/panelist/defenses", title: "Assigned Defenses" },
  { prefix: "/panelist/advisees", title: "My Advisees" },
  { prefix: "/panelist/adviser-requests", title: "Adviser Requests" },
  { prefix: "/panelist/adviser-reviews", title: "Pre-Defense Adviser Reviews" },
  { prefix: "/panelist/essay-evaluations", title: "Essay Evaluations" },
  { prefix: "/panelist/signatures", title: "E-Signatures" },
  { prefix: "/panelist/scoring", title: "Defense Scoring" },
  { prefix: "/panelist/materials", title: "Defense Materials" },
  { prefix: "/panelist/repository", title: "Faculty Research Repository" },
  { prefix: "/panelist/announcements", title: "Faculty Announcements" },
  { prefix: "/panelist/notifications", title: "Faculty Notifications" },
  { prefix: "/panelist/profile", title: "Faculty Profile" },
  { prefix: "/panelist/dashboard", title: "Faculty Dashboard" },
  { prefix: "/panelist", title: "Faculty Portal" },
  { prefix: "/faculty", title: "Faculty Portal" },

  // Admin portal
  { prefix: "/admin/dashboard", title: "Admin Dashboard" },
  { prefix: "/admin/emails", title: "Admin Email Manager" },
  { prefix: "/admin/exam", title: "Admin Entrance Exam Management" },
  { prefix: "/admin/thesis", title: "Admin Thesis & Defense Management" },
  { prefix: "/admin/users", title: "Admin User Management" },
  { prefix: "/admin/analytics", title: "Admin Academic Analytics" },
  { prefix: "/admin/memos", title: "Admin Announcements & Memos" },
  { prefix: "/admin/notifications", title: "Admin Notifications" },
  { prefix: "/admin/repository", title: "Admin Research Repository" },
  { prefix: "/admin/settings", title: "Admin System Settings" },
  { prefix: "/admin", title: "Admin Portal" },

  // Public & Auth pages
  { prefix: "/programs", title: "Graduate Programs" },
  { prefix: "/about", title: "About EARIST Graduate School" },
  { prefix: "/repository", title: "Public Research Repository" },
  { prefix: "/login", title: "Portal Sign In" },
  { prefix: "/register", title: "Applicant Registration" },
  { prefix: "/forgot-password", title: "Forgot Password" },
  { prefix: "/reset-password", title: "Reset Password" },
  { prefix: "/change-password", title: "Change Password" },
];

export function resolvePageTitle(rawPathname?: string): string {
  const pathname = (rawPathname ?? "/").trim().slice(0, 200);
  if (pathname === "/" || pathname === "") {
    return "EARIST Graduate School Home";
  }
  for (const entry of PAGE_TITLE_MAP) {
    if (pathname.startsWith(entry.prefix)) {
      return entry.title;
    }
  }
  return "EARIST Graduate School Portal";
}

function formatFullName(user: {
  title?: string | null;
  firstName: string;
  lastName: string;
  suffix?: string | null;
}): string {
  return [user.title, user.firstName, user.lastName, user.suffix]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function formatDateLabel(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return null;
  }
}

function formatTimeLabel(time: Date | null | undefined): string | null {
  if (!time) return null;
  try {
    const hours = time.getUTCHours();
    const minutes = time.getUTCMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${h12}:${String(minutes).padStart(2, "0")} ${period} Philippine Time`;
  } catch {
    return null;
  }
}

function humanizeThesisStage(stage: string): string {
  switch (stage) {
    case "TITLE":
      return "Title Defense";
    case "PROPOSAL":
      return "Proposal Defense";
    case "FINAL":
      return "Final Defense";
    default:
      return stage;
  }
}

function humanizeThesisStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending Review";
    case "APPROVED":
      return "Approved (Awaiting Schedule)";
    case "REJECTED":
      return "Returned / Rejected";
    case "SCHEDULED":
      return "Defense Scheduled";
    case "PASSED":
      return "Passed";
    case "FAILED":
      return "Did Not Pass";
    case "REVISION":
      return "For Revision";
    default:
      return status;
  }
}

function humanizeSessionStatus(status: string): string {
  switch (status) {
    case "UNSCHEDULED":
      return "Unscheduled";
    case "SCHEDULED":
      return "Scheduled";
    case "IN_PROGRESS":
      return "In Progress";
    case "AWAITING_CONCLUSION":
      return "Awaiting Conclusion";
    case "CONCLUDED":
      return "Concluded";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function humanizeCorStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending Administrator Verification";
    case "VERIFIED":
      return "Verified";
    case "REJECTED":
      return "Rejected (Re-upload Required)";
    default:
      return status;
  }
}

export async function buildLivePortalContext(
  actor: AuthenticatedActor | undefined,
  pathname: string,
): Promise<{
  role: KnowledgeRole;
  userContext: UserLiveStateContext;
}> {
  const pageTitle = resolvePageTitle(pathname);

  if (!actor?.userId) {
    return {
      role: "public",
      userContext: { pageTitle },
    };
  }

  const normalizedRole: KnowledgeRole =
    normalizeKnowledgeRole(actor.role) ?? "public";

  try {
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        id: true,
        title: true,
        firstName: true,
        lastName: true,
        suffix: true,
        role: true,
        adminAccessLevel: true,
      },
    });

    if (!user) {
      return {
        role: "public",
        userContext: { pageTitle },
      };
    }

    const userName = formatFullName(user);
    const verifiedRole = normalizeKnowledgeRole(user.role) ?? normalizedRole;

    if (verifiedRole === "applicant") {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: {
          program: { select: { programName: true } },
          examApplications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              status: true,
              examDate: true,
              examTime: true,
              finalizedAt: true,
              resultDecision: { select: { decision: true } },
              score: { select: { status: true } },
            },
          },
          corUploads: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      });

      const latestExam = student?.examApplications[0];
      const latestCor = student?.corUploads[0];
      const parts: string[] = [];
      let activeStatusSummary = "Applicant Portal";

      if (!latestExam) {
        activeStatusSummary = "No Entrance Exam Scheduled Yet";
        parts.push(
          "Entrance Examination: Not yet scheduled. Next step is booking an available schedule on the Entrance Exam Schedule page.",
        );
      } else {
        const dateStr = formatDateLabel(latestExam.examDate);
        const timeStr = formatTimeLabel(latestExam.examTime);
        const whenStr = [dateStr, timeStr].filter(Boolean).join(" at ");

        if (latestExam.resultDecision?.decision === "PASSED_RECONSIDERED") {
          activeStatusSummary = "Entrance Exam Passed (Reconsidered)";
          parts.push("Entrance Examination Outcome: Passed (Reconsidered).");
        } else if (latestExam.status === "PASSED") {
          activeStatusSummary = "Entrance Exam Passed";
          parts.push("Entrance Examination Outcome: Passed.");
        } else if (latestExam.status === "FAILED") {
          activeStatusSummary = "Entrance Exam Did Not Meet Threshold";
          parts.push("Entrance Examination Outcome: Did Not Meet Threshold.");
        } else if (latestExam.status === "TAKEN" || latestExam.finalizedAt) {
          activeStatusSummary = "Awaiting Official Exam Result Release";
          parts.push(
            "Entrance Examination: Submitted and awaiting essay evaluation or official result release.",
          );
        } else if (
          latestExam.status === "PENDING" ||
          latestExam.status === "APPROVED"
        ) {
          activeStatusSummary = whenStr
            ? `Entrance Exam Scheduled (${whenStr})`
            : "Entrance Exam Scheduled";
          parts.push(
            `Entrance Examination: Scheduled${whenStr ? ` on ${whenStr}` : ""}.`,
          );
        } else {
          activeStatusSummary = `Entrance Exam (${latestExam.status.toLowerCase()})`;
          parts.push(
            `Entrance Examination Status: ${latestExam.status.replace(/_/g, " ")}.`,
          );
        }
      }

      if (latestCor) {
        parts.push(`COR Upload Status: ${humanizeCorStatus(latestCor.status)}.`);
      }

      return {
        role: "applicant",
        userContext: {
          userName,
          program: student?.program?.programName,
          pageTitle,
          activeStatusSummary,
          liveDetailsSummary: parts.join(" "),
        },
      };
    }

    if (verifiedRole === "student") {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        select: {
          studentNumber: true,
          program: { select: { programName: true } },
          compExamRecords: {
            orderBy: { attemptNumber: "desc" },
            take: 1,
            select: { attemptNumber: true, status: true },
          },
          adviserAssignments: {
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              adviser: {
                select: {
                  title: true,
                  firstName: true,
                  lastName: true,
                  suffix: true,
                },
              },
            },
          },
          adviserRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              adviserStatus: true,
              deanStatus: true,
              requestedAdviser: {
                select: {
                  title: true,
                  firstName: true,
                  lastName: true,
                  suffix: true,
                },
              },
            },
          },
          thesisRecords: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              stage: true,
              status: true,
              thesisTitles: {
                where: { isSelected: true },
                take: 1,
                select: { titleText: true },
              },
              defenseSchedules: {
                where: {
                  sessionStatus: {
                    in: ["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"],
                  },
                },
                orderBy: { defenseDate: "desc" },
                take: 1,
                select: {
                  defenseType: true,
                  sessionStatus: true,
                  defenseDate: true,
                  defenseTime: true,
                  venueOrLink: true,
                },
              },
              plagiarismResults: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { isEligible: true },
              },
            },
          },
        },
      });

      const parts: string[] = [];
      let activeStatusSummary = "Enrolled Graduate Student";

      if (student?.studentNumber) {
        parts.push(`Student Number: ${student.studentNumber}.`);
      }

      const latestComp = student?.compExamRecords[0];
      if (latestComp) {
        const wceLabel =
          latestComp.status === "PASSED"
            ? "Passed"
            : latestComp.status === "FAILED"
              ? `Failed (Attempt ${latestComp.attemptNumber} of 3)`
              : "Pending";
        parts.push(`Written Comprehensive Exam: ${wceLabel}.`);
      }

      const activeAdviser = student?.adviserAssignments[0]?.adviser;
      if (activeAdviser) {
        parts.push(`Assigned Adviser: ${formatFullName(activeAdviser)}.`);
      } else {
        const latestReq = student?.adviserRequests[0];
        if (latestReq && latestReq.deanStatus === "PENDING") {
          const reqName = formatFullName(latestReq.requestedAdviser);
          const stageNote =
            latestReq.adviserStatus === "CONFORMED"
              ? "Awaiting Dean Approval"
              : latestReq.adviserStatus === "PENDING"
                ? "Awaiting Adviser Conforme"
                : "Declined by Adviser";
          parts.push(`Latest Adviser Request (${reqName}): ${stageNote}.`);
        }
      }

      const thesis = student?.thesisRecords[0];
      if (thesis) {
        const stageLabel = humanizeThesisStage(thesis.stage);
        const statusLabel = humanizeThesisStatus(thesis.status);
        activeStatusSummary = `${stageLabel} — ${statusLabel}`;
        parts.push(`Current Thesis Stage: ${stageLabel} (${statusLabel}).`);

        const approvedTitle = thesis.thesisTitles[0]?.titleText;
        if (approvedTitle) {
          parts.push(`Approved Title: "${approvedTitle.slice(0, 220)}".`);
        }

        const activeSchedule = thesis.defenseSchedules[0];
        if (activeSchedule) {
          const whenStr = [
            formatDateLabel(activeSchedule.defenseDate),
            formatTimeLabel(activeSchedule.defenseTime),
          ]
            .filter(Boolean)
            .join(" at ");
          const venueStr = activeSchedule.venueOrLink
            ? `, Venue: ${activeSchedule.venueOrLink}`
            : "";
          parts.push(
            `Upcoming Defense Session: ${humanizeThesisStage(activeSchedule.defenseType)} (${humanizeSessionStatus(activeSchedule.sessionStatus)}${whenStr ? `, ${whenStr}` : ""}${venueStr}).`,
          );
        }

        const latestPlag = thesis.plagiarismResults[0];
        if (latestPlag) {
          parts.push(
            `Plagiarism Check: ${latestPlag.isEligible ? "Cleared for Final Defense" : "Not Yet Cleared"}.`,
          );
        }
      } else if (latestComp?.status === "PASSED") {
        activeStatusSummary = "Eligible for Title Defense";
        parts.push(
          "Thesis Journey: Eligible to submit a Title Defense application.",
        );
      }

      return {
        role: "student",
        userContext: {
          userName,
          program: student?.program?.programName,
          pageTitle,
          activeStatusSummary,
          liveDetailsSummary: parts.join(" "),
        },
      };
    }

    if (verifiedRole === "faculty") {
      const [
        panelist,
        activeAdviseeCount,
        pendingAdviserRequestCount,
        upcomingDefenseCount,
      ] = await Promise.all([
        prisma.panelist.findUnique({
          where: { userId: user.id },
          select: { canEvaluateEssays: true, specialization: true },
        }),
        prisma.adviserAssignment.count({
          where: { adviserId: user.id, isActive: true },
        }),
        prisma.adviserRequest.count({
          where: {
            requestedAdviserId: user.id,
            adviserStatus: "PENDING",
          },
        }),
        prisma.panelAssignment.count({
          where: {
            userId: user.id,
            isActive: true,
            schedule: {
              sessionStatus: {
                in: ["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"],
              },
            },
          },
        }),
      ]);

      let pendingEssayCount = 0;
      if (panelist?.canEvaluateEssays) {
        pendingEssayCount = await prisma.entranceExamApplication.count({
          where: {
            status: "TAKEN",
            score: {
              essayEvaluatedAt: null,
            },
          },
        });
      }

      const parts = [
        `Active Advisees: ${activeAdviseeCount} of 5 maximum cap.`,
        `Pending Incoming Adviser Requests: ${pendingAdviserRequestCount}.`,
        `Active/Upcoming Assigned Defenses: ${upcomingDefenseCount}.`,
      ];
      if (panelist?.canEvaluateEssays) {
        parts.push(
          `Entrance Exam Essays Awaiting Evaluation: ${pendingEssayCount}.`,
        );
      }

      return {
        role: "faculty",
        userContext: {
          userName,
          pageTitle,
          activeStatusSummary: `${activeAdviseeCount} active advisees, ${upcomingDefenseCount} active defenses`,
          liveDetailsSummary: parts.join(" "),
        },
      };
    }

    if (verifiedRole === "admin") {
      const [
        pendingCorCount,
        pendingThesisAppsCount,
        approvedUnscheduledCount,
        pendingDeanAdviserReqCount,
      ] = await Promise.all([
        prisma.corUpload.count({ where: { status: "PENDING" } }),
        prisma.thesisRecord.count({ where: { status: "PENDING" } }),
        prisma.thesisRecord.count({ where: { status: "APPROVED" } }),
        prisma.adviserRequest.count({
          where: {
            adviserStatus: "CONFORMED",
            deanStatus: "PENDING",
          },
        }),
      ]);

      const parts = [
        `Pending COR Verifications: ${pendingCorCount}.`,
        `Pending Defense Applications: ${pendingThesisAppsCount}.`,
        `Approved Defenses Ready for Scheduling: ${approvedUnscheduledCount}.`,
        `Adviser Requests Awaiting Dean Approval: ${pendingDeanAdviserReqCount}.`,
      ];

      return {
        role: "admin",
        userContext: {
          userName,
          pageTitle,
          activeStatusSummary: `${pendingCorCount} pending CORs, ${pendingThesisAppsCount} pending defense applications`,
          liveDetailsSummary: parts.join(" "),
        },
      };
    }

    return {
      role: verifiedRole,
      userContext: { userName, pageTitle },
    };
  } catch (err) {
    console.warn("Failed to build live chatbot portal context:", err);
    return {
      role: normalizedRole,
      userContext: { pageTitle },
    };
  }
}
