import prisma from "../config/database";

export class DashboardRepository {
  // KPI: Total Active Students
  async getTotalActiveStudents() {
    return prisma.student.count({
      where: {
        admissionStatus: "ENROLLED",
      },
    });
  }

  // KPI: Pending Defense Applications
  async getPendingDefenses() {
    return prisma.thesisRecord.count({
      where: {
        status: "PENDING",
      },
    });
  }

  // KPI: Pending COR verifications
  async getPendingCORs() {
    return prisma.corRecord.count({
      where: {
        isAdminVerified: false,
      },
    });
  }

  // KPI: Repository entries
  async getRepositoryCount() {
    return prisma.eLibrary.count({
      where: {
        isPublic: true,
      },
    });
  }

  // Pipeline Stages
  async getPipelineStages() {
    const title = await prisma.thesisRecord.count({
      where: { stage: "TITLE" },
    });

    const proposal = await prisma.thesisRecord.count({
      where: {
        stage: "PROPOSAL",
      },
    });

    const final = await prisma.thesisRecord.count({
      where: {
        stage: "FINAL",
      },
    });

    const repository = await prisma.eLibrary.count({
      where: {
        isPublic: true,
      },
    });

    return [
      { label: "Title Defense", count: title, color: "bg-blue-500" },
      { label: "Proposal Defense", count: proposal, color: "bg-amber-500" },
      { label: "Final Defense", count: final, color: "bg-green-500" },
      {
        label: "Repository",
        count: repository,
        color: "bg-(--earist-primary)",
      },
    ];
  }

  // Pending Actions
  async getPendingActions() {
    const actions = [];

    // Pending waivers
    const waivers = await prisma.applicantBridgingWaiver.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
      take: 5,
    });

    for (const w of waivers) {
      actions.push({
        action: "Validate bridging waiver",
        detail: `${w.student.user.firstName} ${w.student.user.lastName}`,
        href: "/admin/exam/waiver",
        priority: "high",
        time: w.createdAt.toISOString(),
      });
    }

    // Pending CORs
    const cors = await prisma.corRecord.findMany({
      where: {
        isAdminVerified: false,
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
      take: 5,
    });
    for (const c of cors) {
      actions.push({
        action: "Verify COR upload",
        detail: `${c.student.user.firstName} ${c.student.user.lastName}`,
        href: "/admin/exam/cor",
        priority: "high",
        time: c.createdAt.toISOString(),
      });
    }

    // Pending Thesis Apps
    const thesis = await prisma.thesisRecord.findMany({
      where: { status: "PENDING" },
      include: { student: { include: { user: true } } },
      take: 5,
    });
    for (const t of thesis) {
      actions.push({
        action: `Review ${t.stage} Defense application`,
        detail: `${t.student.user.firstName} ${t.student.user.lastName}`,
        href: "/admin/thesis/applications",
        priority: "medium",
        time: t.createdAt.toISOString(),
      });
    }
    // Sort by newest first and return top 5
    return actions
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);
  }
  // Recent Activity
  async getRecentActivity() {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { actor: true },
      take: 6,
    });
    return logs.map((log) => ({
      actor: log.actor
        ? `${log.actor.firstName} ${log.actor.lastName}`
        : "System",
      action: log.actionType,
      target: log.description || log.targetTable || "System Action",
      time: log.createdAt.toISOString(),
    }));
  }
}
