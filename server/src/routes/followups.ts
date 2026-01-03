import { Router, Response } from 'express';
import prisma from '../database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { CreateFollowUpRequest } from '../types';

const router = Router();

// Get follow-ups for a member
router.get('/member/:memberId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { memberId } = req.params;

  const followUps = await prisma.followUp.findMany({
    where: { memberId: parseInt(memberId) },
    include: { leader: { select: { name: true } } },
    orderBy: { followUpDate: 'desc' }
  });

  res.json(followUps.map(fu => ({ ...fu, leader_name: fu.leader.name })));
});

// Get all follow-ups by a leader
router.get('/leader/:leaderId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { leaderId } = req.params;

  // Cell leaders can only see their own follow-ups
  if (req.user!.role === 'cell_leader' && req.user!.userId !== parseInt(leaderId)) {
    return res.status(403).json({ error: 'You can only view your own follow-ups' });
  }

  const followUps = await prisma.followUp.findMany({
    where: { leaderId: parseInt(leaderId) },
    include: { member: { select: { firstName: true, lastName: true } } },
    orderBy: { followUpDate: 'desc' }
  });

  res.json(followUps.map(fu => ({
    ...fu,
    first_name: fu.member.firstName,
    last_name: fu.member.lastName
  })));
});

// Get members needing follow-up (no contact in X days)
router.get('/pending', authenticateToken, async (req: AuthRequest, res: Response) => {
  const days = parseInt(req.query.days as string) || 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const where: any = { status: 'active' };

  // Cell leaders only see their assigned members
  if (req.user!.role === 'cell_leader') {
    where.assignedLeaderId = req.user!.userId;
  }

  const members = await prisma.member.findMany({
    where,
    include: {
      assignedLeader: { select: { name: true } },
      followUps: { orderBy: { followUpDate: 'desc' }, take: 1 }
    }
  });

  // Filter members who haven't been contacted recently
  const needFollowUp = members.filter(m => {
    if (m.followUps.length === 0) return true;
    return m.followUps[0].followUpDate < cutoffDate;
  });

  res.json(needFollowUp.map(m => ({
    ...m,
    leader_name: m.assignedLeader?.name,
    last_follow_up: m.followUps[0]?.followUpDate || null
  })));
});

// Create follow-up
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const data: CreateFollowUpRequest = req.body;

  if (!data.member_id || !data.type || !data.follow_up_date) {
    return res.status(400).json({ error: 'Member ID, type, and follow-up date are required' });
  }

  // Verify member exists
  const member = await prisma.member.findUnique({
    where: { id: data.member_id },
    select: { id: true, assignedLeaderId: true, journeyStatus: true }
  });

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // Cell leaders can only add follow-ups for their assigned members
  if (req.user!.role === 'cell_leader' && member.assignedLeaderId !== req.user!.userId) {
    return res.status(403).json({ error: 'You can only add follow-ups for your assigned members' });
  }

  const followUp = await prisma.followUp.create({
    data: {
      memberId: data.member_id,
      leaderId: req.user!.userId,
      type: data.type,
      notes: data.notes || null,
      followUpDate: new Date(data.follow_up_date)
    },
    include: { leader: { select: { name: true } } }
  });

  // Update member journey status if this is their first follow-up
  if (member.journeyStatus === 'new') {
    await prisma.member.update({
      where: { id: data.member_id },
      data: { journeyStatus: 'contacted' }
    });
  }

  res.status(201).json({ ...followUp, leader_name: followUp.leader.name });
});

// Update follow-up
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { type, notes, follow_up_date } = req.body;

  const followUp = await prisma.followUp.findUnique({ where: { id: parseInt(id) } });

  if (!followUp) {
    return res.status(404).json({ error: 'Follow-up not found' });
  }

  // Only the leader who created it or admin can edit
  if (req.user!.role !== 'super_admin' && followUp.leaderId !== req.user!.userId) {
    return res.status(403).json({ error: 'You can only edit your own follow-ups' });
  }

  const updateData: any = {};
  if (type) updateData.type = type;
  if (notes !== undefined) updateData.notes = notes || null;
  if (follow_up_date) updateData.followUpDate = new Date(follow_up_date);

  const updated = await prisma.followUp.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: { leader: { select: { name: true } } }
  });

  res.json({ ...updated, leader_name: updated.leader.name });
});

// Delete follow-up
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const followUp = await prisma.followUp.findUnique({ where: { id: parseInt(id) } });

  if (!followUp) {
    return res.status(404).json({ error: 'Follow-up not found' });
  }

  // Only the leader who created it or admin can delete
  if (req.user!.role !== 'super_admin' && followUp.leaderId !== req.user!.userId) {
    return res.status(403).json({ error: 'You can only delete your own follow-ups' });
  }

  await prisma.followUp.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Follow-up deleted successfully' });
});

export default router;
