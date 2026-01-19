import { Router, Response } from "express";
import prisma from "../database";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";

const router = Router();

function toApprovalResponse(a: any) {
  return {
    id: a.id,
    member_id: a.memberId,
    requested_by: a.requestedBy,
    status: a.status,
    reviewed_by: a.reviewedBy,
    reviewed_at: a.reviewedAt,
    created_at: a.createdAt,

    // member fields (flattened)
    first_name: a.member?.firstName ?? null,
    last_name: a.member?.lastName ?? null,
    email: a.member?.email ?? null,
    phone: a.member?.phone ?? null,
    brought_by: a.member?.broughtBy ?? null,
    marital_status: a.member?.maritalStatus ?? null,

    // names
    requested_by_name: a.requester?.name ?? null,
    reviewed_by_name: a.reviewer?.name ?? null,
  };
}

// Get all pending approvals (admin only)
router.get(
  "/",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const status = (req.query.status as string) || "pending";

    const approvals = await prisma.pendingApproval.findMany({
      where: { status: status as any },
      include: {
        member: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            broughtBy: true,
            maritalStatus: true,
          },
        },
        requester: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(approvals.map(toApprovalResponse));
  }
);

// ✅ IMPORTANT: stats must be BEFORE /member/:memberId
router.get(
  "/stats",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const [pending, approved, rejected] = await Promise.all([
      prisma.pendingApproval.count({ where: { status: "pending" } }),
      prisma.pendingApproval.count({ where: { status: "approved" } }),
      prisma.pendingApproval.count({ where: { status: "rejected" } }),
    ]);

    const recentApprovals = await prisma.pendingApproval.findMany({
      where: { status: { not: "pending" } },
      include: {
        member: { select: { firstName: true, lastName: true } },
        requester: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 10,
    });

    res.json({
      stats: { total: pending + approved + rejected, pending, approved, rejected },
      recent_approvals: recentApprovals.map((a) => ({
        id: a.id,
        status: a.status,
        reviewed_at: a.reviewedAt,
        requested_by_name: a.requester?.name ?? null,
        reviewed_by_name: a.reviewer?.name ?? null,
        first_name: a.member?.firstName ?? null,
        last_name: a.member?.lastName ?? null,
      })),
    });
  }
);

// Get approval by member ID
router.get(
  "/member/:memberId",
  authenticateToken,
  // optional: lock down approvals to admin only
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const memberId = parseInt(req.params.memberId, 10);

    const approval = await prisma.pendingApproval.findFirst({
      where: { memberId },
      include: {
        member: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            broughtBy: true,
            maritalStatus: true,
          },
        },
        requester: { select: { name: true } },
        reviewer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!approval) {
      return res.status(404).json({ error: "No approval record found" });
    }

    res.json(toApprovalResponse(approval));
  }
);

// Approve member (admin only)
router.post(
  "/:id/approve",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { assigned_leader_id, cell_group_id } = req.body as {
      assigned_leader_id?: number;
      cell_group_id?: number;
    };

    const approval = await prisma.pendingApproval.findFirst({
      where: { id, status: "pending" },
    });

    if (!approval) {
      return res.status(404).json({ error: "Pending approval not found" });
    }

    await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: "approved",
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
      },
    });

    const updateData: any = { status: "active" };
    if (assigned_leader_id !== undefined) updateData.assignedLeaderId = assigned_leader_id || null;
    if (cell_group_id !== undefined) updateData.cellGroupId = cell_group_id || null;

    const member = await prisma.member.update({
      where: { id: approval.memberId },
      data: updateData,
      select: { firstName: true, lastName: true },
    });

    await prisma.notification.create({
      data: {
        userId: approval.requestedBy,
        title: "Member Approved",
        message: `${member.firstName} ${member.lastName} has been approved and is now active.`,
        type: "approval",
      },
    });

    res.json({ message: "Member approved successfully" });
  }
);

// Reject member (admin only)
router.post(
  "/:id/reject",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason?: string };

    const approval = await prisma.pendingApproval.findFirst({
      where: { id, status: "pending" },
    });

    if (!approval) {
      return res.status(404).json({ error: "Pending approval not found" });
    }

    await prisma.pendingApproval.update({
      where: { id },
      data: {
        status: "rejected",
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
      },
    });

    const member = await prisma.member.update({
      where: { id: approval.memberId },
      data: { status: "inactive" },
      select: { firstName: true, lastName: true },
    });

    await prisma.notification.create({
      data: {
        userId: approval.requestedBy,
        title: "Member Rejected",
        message: `${member.firstName} ${member.lastName} was not approved.${
          reason ? ` Reason: ${reason}` : ""
        }`,
        type: "approval",
      },
    });

    res.json({ message: "Member rejected" });
  }
);

export default router;