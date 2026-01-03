import { Router, Response } from 'express';
import prisma from '../database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { CreateMemberRequest, MemberJourneyStatus } from '../types';

const router = Router();

// Get all members
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { status, cell_group_id, search, journey_status } = req.query;

  const where: any = {};

  // Cell leaders only see their assigned members or active members
  if (req.user!.role === 'cell_leader') {
    where.OR = [
      { assignedLeaderId: req.user!.userId },
      { status: 'active' }
    ];
  }

  if (status) where.status = status;
  if (cell_group_id) where.cellGroupId = parseInt(cell_group_id as string);
  if (journey_status) where.journeyStatus = journey_status;

  if (search) {
    const searchTerm = search as string;
    where.OR = [
      { firstName: { contains: searchTerm, mode: 'insensitive' } },
      { lastName: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { phone: { contains: searchTerm } }
    ];
  }

  const members = await prisma.member.findMany({
    where,
    include: {
      assignedLeader: { select: { name: true } },
      cellGroup: { select: { name: true } },
      followUps: { select: { followUpDate: true }, orderBy: { followUpDate: 'desc' }, take: 1 },
      _count: { select: { followUps: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const formattedMembers = members.map(m => ({
    ...m,
    leader_name: m.assignedLeader?.name,
    cell_group_name: m.cellGroup?.name,
    follow_up_count: m._count.followUps,
    last_follow_up: m.followUps[0]?.followUpDate || null
  }));

  res.json(formattedMembers);
});

// Get single member
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const member = await prisma.member.findUnique({
    where: { id: parseInt(id) },
    include: {
      assignedLeader: { select: { name: true } },
      cellGroup: { select: { name: true } }
    }
  });

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  res.json({
    ...member,
    leader_name: member.assignedLeader?.name,
    cell_group_name: member.cellGroup?.name
  });
});

// Create member (with approval workflow for cell leaders)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const data: CreateMemberRequest = req.body;

  if (!data.first_name || !data.last_name) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  const isAdmin = req.user!.role === 'super_admin';
  const initialStatus = isAdmin ? 'active' : 'pending_approval';

  const member = await prisma.member.create({
    data: {
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      birthday: data.birthday ? new Date(data.birthday) : null,
      maritalStatus: data.marital_status || 'undisclosed',
      broughtBy: data.brought_by || null,
      cellGroupId: data.cell_group_id || null,
      assignedLeaderId: isAdmin ? null : req.user!.userId,
      status: initialStatus,
      notes: data.notes || null
    }
  });

  // Create pending approval record for cell leader submissions
  if (!isAdmin) {
    await prisma.pendingApproval.create({
      data: {
        memberId: member.id,
        requestedBy: req.user!.userId
      }
    });

    // Notify all admins
    const admins = await prisma.user.findMany({ where: { role: 'super_admin' } });
    await prisma.notification.createMany({
      data: admins.map(admin => ({
        userId: admin.id,
        title: 'New Member Pending Approval',
        message: `${data.first_name} ${data.last_name} has been added and requires approval.`,
        type: 'approval' as const
      }))
    });
  }

  res.status(201).json(member);
});

// Update member
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const member = await prisma.member.findUnique({ where: { id: parseInt(id) } });
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // Cell leaders can only update their assigned members
  if (req.user!.role === 'cell_leader' && member.assignedLeaderId !== req.user!.userId) {
    return res.status(403).json({ error: 'You can only update your assigned members' });
  }

  const updateData: any = {};

  if (data.first_name) updateData.firstName = data.first_name;
  if (data.last_name) updateData.lastName = data.last_name;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.birthday !== undefined) updateData.birthday = data.birthday ? new Date(data.birthday) : null;
  if (data.marital_status) updateData.maritalStatus = data.marital_status;
  if (data.brought_by !== undefined) updateData.broughtBy = data.brought_by || null;
  if (data.cell_group_id !== undefined) updateData.cellGroupId = data.cell_group_id || null;
  if (data.foundation_school_completed !== undefined) updateData.foundationSchoolCompleted = data.foundation_school_completed;
  if (data.foundation_school_date !== undefined) updateData.foundationSchoolDate = data.foundation_school_date ? new Date(data.foundation_school_date) : null;
  if (data.journey_status) updateData.journeyStatus = data.journey_status;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  // Only admins can change status and assignment
  if (req.user!.role === 'super_admin') {
    if (data.status) updateData.status = data.status;
    if (data.assigned_leader_id !== undefined) updateData.assignedLeaderId = data.assigned_leader_id || null;
  }

  const updatedMember = await prisma.member.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: {
      assignedLeader: { select: { name: true } },
      cellGroup: { select: { name: true } }
    }
  });

  res.json({
    ...updatedMember,
    leader_name: updatedMember.assignedLeader?.name,
    cell_group_name: updatedMember.cellGroup?.name
  });
});

// Delete member (admin only)
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const member = await prisma.member.findUnique({ where: { id: parseInt(id) } });
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  await prisma.member.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Member deleted successfully' });
});

// Update journey status
router.patch('/:id/journey', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { journey_status } = req.body as { journey_status: MemberJourneyStatus };

  const validStatuses: MemberJourneyStatus[] = ['new', 'contacted', 'engaged', 'foundation', 'active_member', 'potential_leader'];
  if (!validStatuses.includes(journey_status)) {
    return res.status(400).json({ error: 'Invalid journey status' });
  }

  await prisma.member.update({
    where: { id: parseInt(id) },
    data: { journeyStatus: journey_status }
  });

  res.json({ message: 'Journey status updated' });
});

// Get members with upcoming birthdays
router.get('/birthdays/upcoming', authenticateToken, async (req: AuthRequest, res: Response) => {
  const days = parseInt(req.query.days as string) || 7;
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const members = await prisma.member.findMany({
    where: {
      birthday: { not: null },
      status: 'active'
    }
  });

  // Filter by birthday within range (comparing month and day)
  const upcomingBirthdays = members.filter(m => {
    if (!m.birthday) return false;
    const bday = new Date(m.birthday);
    const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    return thisYearBday >= today && thisYearBday <= futureDate;
  });

  res.json(upcomingBirthdays);
});

export default router;
