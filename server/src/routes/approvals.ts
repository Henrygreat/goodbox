import { Router, Response } from 'express';
import prisma from '../database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Get all pending approvals (admin only)
router.get('/', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const status = (req.query.status as string) || 'pending';

  const approvals = await prisma.pendingApproval.findMany({
    where: { status: status as any },
    include: {
      member: { select: { firstName: true, lastName: true, email: true, phone: true, broughtBy: true, maritalStatus: true } },
      requester: { select: { name: true } },
      reviewer: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(approvals.map(a => ({
    ...a,
    first_name: a.member.firstName,
    last_name: a.member.lastName,
    email: a.member.email,
    phone: a.member.phone,
    brought_by: a.member.broughtBy,
    marital_status: a.member.maritalStatus,
    requested_by_name: a.requester.name,
    reviewed_by_name: a.reviewer?.name
  })));
});

// Get approval by member ID
router.get('/member/:memberId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { memberId } = req.params;

  const approval = await prisma.pendingApproval.findFirst({
    where: { memberId: parseInt(memberId) },
    include: {
      requester: { select: { name: true } },
      reviewer: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!approval) {
    return res.status(404).json({ error: 'No approval record found' });
  }

  res.json({
    ...approval,
    requested_by_name: approval.requester.name,
    reviewed_by_name: approval.reviewer?.name
  });
});

// Approve member (admin only)
router.post('/:id/approve', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { assigned_leader_id, cell_group_id } = req.body;

  const approval = await prisma.pendingApproval.findFirst({
    where: { id: parseInt(id), status: 'pending' }
  });

  if (!approval) {
    return res.status(404).json({ error: 'Pending approval not found' });
  }

  // Update approval status
  await prisma.pendingApproval.update({
    where: { id: parseInt(id) },
    data: {
      status: 'approved',
      reviewedBy: req.user!.userId,
      reviewedAt: new Date()
    }
  });

  // Update member status to active
  const updateData: any = { status: 'active' };
  if (assigned_leader_id) updateData.assignedLeaderId = assigned_leader_id;
  if (cell_group_id) updateData.cellGroupId = cell_group_id;

  await prisma.member.update({
    where: { id: approval.memberId },
    data: updateData
  });

  // Notify the cell leader who requested
  const member = await prisma.member.findUnique({
    where: { id: approval.memberId },
    select: { firstName: true, lastName: true }
  });

  await prisma.notification.create({
    data: {
      userId: approval.requestedBy,
      title: 'Member Approved',
      message: `${member!.firstName} ${member!.lastName} has been approved and is now active.`,
      type: 'approval'
    }
  });

  res.json({ message: 'Member approved successfully' });
});

// Reject member (admin only)
router.post('/:id/reject', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const approval = await prisma.pendingApproval.findFirst({
    where: { id: parseInt(id), status: 'pending' }
  });

  if (!approval) {
    return res.status(404).json({ error: 'Pending approval not found' });
  }

  // Update approval status
  await prisma.pendingApproval.update({
    where: { id: parseInt(id) },
    data: {
      status: 'rejected',
      reviewedBy: req.user!.userId,
      reviewedAt: new Date()
    }
  });

  // Update member status to inactive
  await prisma.member.update({
    where: { id: approval.memberId },
    data: { status: 'inactive' }
  });

  // Notify the cell leader who requested
  const member = await prisma.member.findUnique({
    where: { id: approval.memberId },
    select: { firstName: true, lastName: true }
  });

  await prisma.notification.create({
    data: {
      userId: approval.requestedBy,
      title: 'Member Rejected',
      message: `${member!.firstName} ${member!.lastName} was not approved.${reason ? ` Reason: ${reason}` : ''}`,
      type: 'approval'
    }
  });

  res.json({ message: 'Member rejected' });
});

// Get approval statistics
router.get('/stats', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const [pending, approved, rejected] = await Promise.all([
    prisma.pendingApproval.count({ where: { status: 'pending' } }),
    prisma.pendingApproval.count({ where: { status: 'approved' } }),
    prisma.pendingApproval.count({ where: { status: 'rejected' } })
  ]);

  const recentApprovals = await prisma.pendingApproval.findMany({
    where: { status: { not: 'pending' } },
    include: {
      member: { select: { firstName: true, lastName: true } },
      requester: { select: { name: true } }
    },
    orderBy: { reviewedAt: 'desc' },
    take: 10
  });

  res.json({
    stats: { total: pending + approved + rejected, pending, approved, rejected },
    recentApprovals: recentApprovals.map(a => ({
      ...a,
      first_name: a.member.firstName,
      last_name: a.member.lastName,
      requested_by_name: a.requester.name
    }))
  });
});

export default router;
