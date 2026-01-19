import { Router, Response } from "express";
import prisma from "../database";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { CreateFollowUpRequest } from "../types";

const router = Router();

function toFollowUpResponse(fu: any) {
  return {
    id: fu.id,
    member_id: fu.memberId,
    leader_id: fu.leaderId,
    type: fu.type,
    notes: fu.notes,
    follow_up_date: fu.followUpDate,
    created_at: fu.createdAt,
  };
}

// Get follow-ups for a member
router.get(
  "/member/:memberId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const memberId = parseInt(req.params.memberId, 10);

    // Optional security: cell leaders can only view their assigned members
    if (req.user!.role === "cell_leader") {
      const m = await prisma.member.findUnique({
        where: { id: memberId },
        select: { assignedLeaderId: true },
      });
      if (!m) return res.status(404).json({ error: "Member not found" });
      if (m.assignedLeaderId !== req.user!.userId) {
        return res.status(403).json({ error: "You can only view your assigned members" });
      }
    }

    const followUps = await prisma.followUp.findMany({
      where: { memberId },
      include: { leader: { select: { name: true } } },
      orderBy: { followUpDate: "desc" },
    });

    res.json(
      followUps.map((fu) => ({
        ...toFollowUpResponse(fu),
        leader_name: fu.leader?.name ?? null,
      }))
    );
  }
);

// Get all follow-ups by a leader
router.get(
  "/leader/:leaderId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const leaderId = parseInt(req.params.leaderId, 10);

    if (req.user!.role === "cell_leader" && req.user!.userId !== leaderId) {
      return res.status(403).json({ error: "You can only view your own follow-ups" });
    }

    const followUps = await prisma.followUp.findMany({
      where: { leaderId },
      include: { member: { select: { firstName: true, lastName: true } } },
      orderBy: { followUpDate: "desc" },
    });

    res.json(
      followUps.map((fu) => ({
        ...toFollowUpResponse(fu),
        first_name: fu.member.firstName,
        last_name: fu.member.lastName,
      }))
    );
  }
);

// Get members needing follow-up (no contact in X days)
router.get(
  "/pending",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const days = parseInt(req.query.days as string, 10) || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const where: any = { status: "active" };

    if (req.user!.role === "cell_leader") {
      where.assignedLeaderId = req.user!.userId;
    }

    const members = await prisma.member.findMany({
      where,
      include: {
        assignedLeader: { select: { name: true } },
        cellGroup: { select: { name: true } },
        followUps: { orderBy: { followUpDate: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    const needFollowUp = members.filter((m) => {
      if (m.followUps.length === 0) return true;
      return m.followUps[0].followUpDate < cutoffDate;
    });

    res.json(
      needFollowUp.map((m) => ({
        id: m.id,
        first_name: m.firstName,
        last_name: m.lastName,
        email: m.email,
        phone: m.phone,
        status: m.status,
        journey_status: m.journeyStatus,
        cell_group_id: m.cellGroupId,
        cell_group_name: m.cellGroup?.name ?? null,
        leader_name: m.assignedLeader?.name ?? null,
        last_follow_up: m.followUps[0]?.followUpDate ?? null,
      }))
    );
  }
);

// Create follow-up
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const data: CreateFollowUpRequest = req.body;

  if (!data.member_id || !data.type || !data.follow_up_date) {
    return res.status(400).json({
      error: "Member ID, type, and follow-up date are required",
    });
  }

  const member = await prisma.member.findUnique({
    where: { id: data.member_id },
    select: { id: true, assignedLeaderId: true, journeyStatus: true },
  });

  if (!member) return res.status(404).json({ error: "Member not found" });

  if (req.user!.role === "cell_leader" && member.assignedLeaderId !== req.user!.userId) {
    return res.status(403).json({ error: "You can only add follow-ups for your assigned members" });
  }

  const followUp = await prisma.followUp.create({
    data: {
      memberId: data.member_id,
      leaderId: req.user!.userId,
      type: data.type,
      notes: data.notes || null,
      followUpDate: new Date(data.follow_up_date),
    },
    include: { leader: { select: { name: true } } },
  });

  if (member.journeyStatus === "new") {
    await prisma.member.update({
      where: { id: data.member_id },
      data: { journeyStatus: "contacted" },
    });
  }

  res.status(201).json({
    ...toFollowUpResponse(followUp),
    leader_name: followUp.leader?.name ?? null,
  });
});

// Update follow-up
router.put("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { type, notes, follow_up_date } = req.body;

  const followUp = await prisma.followUp.findUnique({ where: { id } });
  if (!followUp) return res.status(404).json({ error: "Follow-up not found" });

  if (req.user!.role !== "super_admin" && followUp.leaderId !== req.user!.userId) {
    return res.status(403).json({ error: "You can only edit your own follow-ups" });
  }

  const updateData: any = {};
  if (type) updateData.type = type;
  if (notes !== undefined) updateData.notes = notes || null;
  if (follow_up_date) updateData.followUpDate = new Date(follow_up_date);

  const updated = await prisma.followUp.update({
    where: { id },
    data: updateData,
    include: { leader: { select: { name: true } } },
  });

  res.json({
    ...toFollowUpResponse(updated),
    leader_name: updated.leader?.name ?? null,
  });
});

// Delete follow-up
router.delete("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);

  const followUp = await prisma.followUp.findUnique({ where: { id } });
  if (!followUp) return res.status(404).json({ error: "Follow-up not found" });

  if (req.user!.role !== "super_admin" && followUp.leaderId !== req.user!.userId) {
    return res.status(403).json({ error: "You can only delete your own follow-ups" });
  }

  await prisma.followUp.delete({ where: { id } });
  res.json({ message: "Follow-up deleted successfully" });
});

export default router;