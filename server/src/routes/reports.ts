import { Router, Response } from "express";
import prisma from "../database";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";

const router = Router();

// Dashboard stats
router.get("/dashboard", authenticateToken, async (req: AuthRequest, res: Response) => {
  const isAdmin = req.user!.role === "super_admin";

  const activeMembers = await prisma.member.count({
    where: {
      status: "active",
      ...(isAdmin ? {} : { assignedLeaderId: req.user!.userId }),
    },
  });

  const pendingApprovals = isAdmin
    ? await prisma.pendingApproval.count({ where: { status: "pending" } })
    : 0;

  // Members needing follow-up
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const membersWithFollowups = await prisma.member.findMany({
    where: {
      status: "active",
      ...(isAdmin ? {} : { assignedLeaderId: req.user!.userId }),
    },
    include: {
      followUps: { orderBy: { followUpDate: "desc" }, take: 1 },
    },
  });

  const needFollowUp = membersWithFollowups.filter((m) => {
    if (m.followUps.length === 0) return true;
    return m.followUps[0].followUpDate < sevenDaysAgo;
  }).length;

  // Upcoming birthdays
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const allMembers = await prisma.member.findMany({
    where: {
      birthday: { not: null },
      status: "active",
      ...(isAdmin ? {} : { assignedLeaderId: req.user!.userId }),
    },
  });

  const upcomingBirthdays = allMembers.filter((m) => {
    if (!m.birthday) return false;
    const bday = new Date(m.birthday);
    const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    return thisYearBday >= today && thisYearBday <= sevenDaysFromNow;
  }).length;

  const response: any = {
    activeMembers,
    pendingApprovals,
    needFollowUp,
    upcomingBirthdays,
  };

  if (isAdmin) {
    const [totalMembers, totalCellGroups, totalLeaders, membersWithoutCell] = await Promise.all([
      prisma.member.count(),
      prisma.cellGroup.count(),
      prisma.user.count({ where: { role: "cell_leader" } }),
      prisma.member.count({ where: { status: "active", cellGroupId: null } }),
    ]);

    response.totalMembers = totalMembers;
    response.totalCellGroups = totalCellGroups;
    response.totalLeaders = totalLeaders;
    response.membersWithoutCell = membersWithoutCell;
  }

  res.json(response);
});

// Members by status report (admin only)
router.get(
  "/members-by-status",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const byStatus = await prisma.member.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const byJourneyStatus = await prisma.member.groupBy({
      by: ["journeyStatus"],
      where: { status: "active" },
      _count: { _all: true },
    });

    res.json({
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byJourneyStatus: byJourneyStatus.map((s) => ({
        journey_status: s.journeyStatus,
        count: s._count._all,
      })),
    });
  }
);

// Follow-up completion rates by leader (admin only)
router.get(
  "/followup-rates",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const leaders = await prisma.user.findMany({
      where: { role: "cell_leader" },
      include: {
        assignedMembers: { where: { status: "active" } },
        followUps: { where: { followUpDate: { gte: cutoffDate } } },
      },
    });

    const leaderStats = leaders.map((leader) => {
      const uniqueMembersContacted = new Set(leader.followUps.map((f) => f.memberId)).size;
      return {
        id: leader.id,
        name: leader.name,
        assigned_members: leader.assignedMembers.length,
        follow_ups_count: leader.followUps.length,
        members_contacted: uniqueMembersContacted,
      };
    });

    res.json(leaderStats);
  }
);

// Cell group health report (admin only)
router.get(
  "/cell-group-health",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const cellGroups = await prisma.cellGroup.findMany({
      include: {
        leader: { select: { name: true } },
        members: {
          where: { status: "active" },
          include: { followUps: { orderBy: { followUpDate: "desc" }, take: 1 } },
        },
      },
    });

    const cellGroupStats = cellGroups.map((group) => {
      const lastActivity =
        group.members
          .flatMap((m) => m.followUps)
          .sort((a, b) => b.followUpDate.getTime() - a.followUpDate.getTime())[0]?.followUpDate ??
        null;

      return {
        id: group.id,
        name: group.name,
        leader_name: group.leader?.name || null,
        member_count: group.members.length,
        last_activity: lastActivity,
      };
    });

    res.json(cellGroupStats);
  }
);

// New members trend (admin only)
router.get(
  "/new-members-trend",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const months = parseInt(req.query.months as string) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const members = await prisma.member.findMany({
      where: { dateJoined: { gte: startDate } },
      select: { dateJoined: true },
    });

    const monthlyData: Record<string, number> = {};
    members.forEach((m) => {
      const month = m.dateJoined.toISOString().slice(0, 7); // YYYY-MM
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });

    const trend = Object.entries(monthlyData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json(trend);
  }
);

// Foundation school completion report (admin only)
router.get(
  "/foundation-school",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const [completed, notCompleted] = await Promise.all([
      prisma.member.count({ where: { status: "active", foundationSchoolCompleted: true } }),
      prisma.member.count({ where: { status: "active", foundationSchoolCompleted: false } }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCompletions = await prisma.member.findMany({
      where: {
        foundationSchoolCompleted: true,
        foundationSchoolDate: { gte: thirtyDaysAgo },
      },
      select: { id: true, firstName: true, lastName: true, foundationSchoolDate: true },
      orderBy: { foundationSchoolDate: "desc" },
      take: 10,
    });

    const needsFoundation = await prisma.member.findMany({
      where: {
        status: "active",
        foundationSchoolCompleted: false,
        dateJoined: { lte: thirtyDaysAgo },
      },
      include: {
        cellGroup: { select: { name: true } },
        assignedLeader: { select: { name: true } },
      },
      orderBy: { dateJoined: "asc" },
      take: 20,
    });

    res.json({
      completed,
      notCompleted,
      completionRate:
        completed + notCompleted > 0 ? Math.round((completed / (completed + notCompleted)) * 100) : 0,
      recentCompletions: recentCompletions.map((m) => ({
        id: m.id,
        first_name: m.firstName,
        last_name: m.lastName,
        foundation_school_date: m.foundationSchoolDate,
      })),
      needsFoundation: needsFoundation.map((m) => ({
        id: m.id,
        first_name: m.firstName,
        last_name: m.lastName,
        date_joined: m.dateJoined,
        cell_group_name: m.cellGroup?.name,
        leader_name: m.assignedLeader?.name,
      })),
    });
  }
);

export default router;