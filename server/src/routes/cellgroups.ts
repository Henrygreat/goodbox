import { Router, Response } from 'express';
import prisma from '../database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { CreateCellGroupRequest } from '../types';

const router = Router();

// Get all cell groups
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const cellGroups = await prisma.cellGroup.findMany({
    include: {
      leader: { select: { name: true, email: true } },
      _count: { select: { members: { where: { status: 'active' } } } }
    },
    orderBy: { name: 'asc' }
  });

  res.json(cellGroups.map(cg => ({
    ...cg,
    leader_name: cg.leader?.name,
    leader_email: cg.leader?.email,
    member_count: cg._count.members
  })));
});

// Get single cell group with members
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const cellGroup = await prisma.cellGroup.findUnique({
    where: { id: parseInt(id) },
    include: {
      leader: { select: { name: true, email: true } },
      members: {
        where: { status: 'active' },
        include: {
          followUps: { orderBy: { followUpDate: 'desc' }, take: 1 }
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
      }
    }
  });

  if (!cellGroup) {
    return res.status(404).json({ error: 'Cell group not found' });
  }

  res.json({
    ...cellGroup,
    leader_name: cellGroup.leader?.name,
    leader_email: cellGroup.leader?.email,
    members: cellGroup.members.map(m => ({
      ...m,
      last_follow_up: m.followUps[0]?.followUpDate || null
    }))
  });
});

// Create cell group (admin only)
router.post('/', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const data: CreateCellGroupRequest = req.body;

  if (!data.name) {
    return res.status(400).json({ error: 'Cell group name is required' });
  }

  // Verify leader exists if provided
  if (data.leader_id) {
    const leader = await prisma.user.findUnique({ where: { id: data.leader_id } });
    if (!leader) {
      return res.status(400).json({ error: 'Leader not found' });
    }
  }

  const cellGroup = await prisma.cellGroup.create({
    data: {
      name: data.name,
      description: data.description || null,
      leaderId: data.leader_id || null
    },
    include: { leader: { select: { name: true } } }
  });

  res.status(201).json({ ...cellGroup, leader_name: cellGroup.leader?.name });
});

// Update cell group (admin only)
router.put('/:id', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, leader_id } = req.body;

  const cellGroup = await prisma.cellGroup.findUnique({ where: { id: parseInt(id) } });
  if (!cellGroup) {
    return res.status(404).json({ error: 'Cell group not found' });
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description || null;
  if (leader_id !== undefined) {
    if (leader_id) {
      const leader = await prisma.user.findUnique({ where: { id: leader_id } });
      if (!leader) {
        return res.status(400).json({ error: 'Leader not found' });
      }
    }
    updateData.leaderId = leader_id || null;
  }

  const updated = await prisma.cellGroup.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: { leader: { select: { name: true } } }
  });

  res.json({ ...updated, leader_name: updated.leader?.name });
});

// Delete cell group (admin only)
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const cellGroup = await prisma.cellGroup.findUnique({ where: { id: parseInt(id) } });
  if (!cellGroup) {
    return res.status(404).json({ error: 'Cell group not found' });
  }

  // Remove members from this group (don't delete them)
  await prisma.member.updateMany({
    where: { cellGroupId: parseInt(id) },
    data: { cellGroupId: null }
  });

  await prisma.cellGroup.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Cell group deleted successfully' });
});

// Assign members to cell group
router.post('/:id/members', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { member_ids } = req.body as { member_ids: number[] };

  if (!member_ids || !Array.isArray(member_ids)) {
    return res.status(400).json({ error: 'member_ids array is required' });
  }

  const cellGroup = await prisma.cellGroup.findUnique({ where: { id: parseInt(id) } });
  if (!cellGroup) {
    return res.status(404).json({ error: 'Cell group not found' });
  }

  await prisma.member.updateMany({
    where: { id: { in: member_ids } },
    data: { cellGroupId: parseInt(id) }
  });

  res.json({ message: `${member_ids.length} members assigned to cell group` });
});

export default router;
