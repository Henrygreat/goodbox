import { Router, Response } from "express";
import prisma from "../database";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";
import { CreateCellGroupRequest } from "../types";

const router = Router();

function toCellGroupResponse(cg: any) {
  return {
    id: cg.id,
    name: cg.name,
    description: cg.description,
    leader_id: cg.leaderId ?? null,
    created_at: cg.createdAt,

    leader_name: cg.leader?.name ?? null,
    leader_email: cg.leader?.email ?? null,

    member_count: cg._count?.members ?? 0,
  };
}

function toMemberLiteResponse(m: any) {
  return {
    id: m.id,
    first_name: m.firstName,
    last_name: m.lastName,
    email: m.email,
    phone: m.phone,
    status: m.status,
    journey_status: m.journeyStatus,
    cell_group_id: m.cellGroupId ?? null,
    assigned_leader_id: m.assignedLeaderId ?? null,
    birthday: m.birthday,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    last_follow_up: m.followUps?.[0]?.followUpDate ?? null,
  };
}

// Get all cell groups
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const cellGroups = await prisma.cellGroup.findMany({
    include: {
      leader: { select: { name: true, email: true } },
      _count: { select: { members: { where: { status: "active" } } } },
    },
    orderBy: { name: "asc" },
  });

  res.json(cellGroups.map(toCellGroupResponse));
});

// Get single cell group with members
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const cellGroup = await prisma.cellGroup.findUnique({
    where: { id: parseInt(id, 10) },
    include: {
      leader: { select: { name: true, email: true } },
      members: {
        where: { status: "active" },
        include: {
          followUps: { select: { followUpDate: true }, orderBy: { followUpDate: "desc" }, take: 1 },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
      _count: { select: { members: { where: { status: "active" } } } },
    },
  });

  if (!cellGroup) {
    return res.status(404).json({ error: "Cell group not found" });
  }

  res.json({
    ...toCellGroupResponse(cellGroup),
    members: cellGroup.members.map(toMemberLiteResponse),
  });
});

// Create cell group (admin only)
router.post("/", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  const data: CreateCellGroupRequest = req.body;

  if (!data.name) {
    return res.status(400).json({ error: "Cell group name is required" });
  }

  if (data.leader_id) {
    const leader = await prisma.user.findUnique({ where: { id: data.leader_id } });
    if (!leader) {
      return res.status(400).json({ error: "Leader not found" });
    }
  }

  const cellGroup = await prisma.cellGroup.create({
    data: {
      name: data.name,
      description: data.description || null,
      leaderId: data.leader_id || null,
    },
    include: {
      leader: { select: { name: true, email: true } },
      _count: { select: { members: { where: { status: "active" } } } },
    },
  });

  res.status(201).json(toCellGroupResponse(cellGroup));
});

// Update cell group (admin only)
router.put("/:id", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, leader_id } = req.body;

  const cellGroup = await prisma.cellGroup.findUnique({ where: { id: parseInt(id, 10) } });
  if (!cellGroup) {
    return res.status(404).json({ error: "Cell group not found" });
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description || null;

  if (leader_id !== undefined) {
    if (leader_id) {
      const leader = await prisma.user.findUnique({ where: { id: leader_id } });
      if (!leader) {
        return res.status(400).json({ error: "Leader not found" });
      }
    }
    updateData.leaderId = leader_id || null;
  }

  const updated = await prisma.cellGroup.update({
    where: { id: parseInt(id, 10) },
    data: updateData,
    include: {
      leader: { select: { name: true, email: true } },
      _count: { select: { members: { where: { status: "active" } } } },
    },
  });

  res.json(toCellGroupResponse(updated));
});

// Delete cell group (admin only)
router.delete("/:id", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const cellGroup = await prisma.cellGroup.findUnique({ where: { id: parseInt(id, 10) } });
  if (!cellGroup) {
    return res.status(404).json({ error: "Cell group not found" });
  }

  // Remove members from this group (don't delete them)
  await prisma.member.updateMany({
    where: { cellGroupId: parseInt(id, 10) },
    data: { cellGroupId: null },
  });

  await prisma.cellGroup.delete({ where: { id: parseInt(id, 10) } });

  res.json({ message: "Cell group deleted successfully" });
});

// Assign members to cell group (admin only)
router.post("/:id/members", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { member_ids } = req.body as { member_ids: number[] };

  if (!member_ids || !Array.isArray(member_ids)) {
    return res.status(400).json({ error: "member_ids array is required" });
  }

  const cellGroup = await prisma.cellGroup.findUnique({ where: { id: parseInt(id, 10) } });
  if (!cellGroup) {
    return res.status(404).json({ error: "Cell group not found" });
  }

  await prisma.member.updateMany({
    where: { id: { in: member_ids } },
    data: { cellGroupId: parseInt(id, 10) },
  });

  res.json({ message: `${member_ids.length} members assigned to cell group` });
});

export default router;