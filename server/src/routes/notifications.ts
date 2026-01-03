import { Router, Response } from 'express';
import prisma from '../database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user's notifications
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const unreadOnly = req.query.unread_only === 'true';

  const where: any = { userId: req.user!.userId };
  if (unreadOnly) where.read = false;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.json(notifications);
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res: Response) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.userId, read: false }
  });

  res.json({ count });
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const notification = await prisma.notification.findFirst({
    where: { id: parseInt(id), userId: req.user!.userId }
  });

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  await prisma.notification.update({
    where: { id: parseInt(id) },
    data: { read: true }
  });

  res.json({ message: 'Notification marked as read' });
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.userId, read: false },
    data: { read: true }
  });

  res.json({ message: 'All notifications marked as read' });
});

// Delete notification
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const notification = await prisma.notification.findFirst({
    where: { id: parseInt(id), userId: req.user!.userId }
  });

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  await prisma.notification.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Notification deleted' });
});

// Check and create birthday notifications
router.post('/check-birthdays', authenticateToken, async (req: AuthRequest, res: Response) => {
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);

  // Get members with birthdays
  const members = await prisma.member.findMany({
    where: {
      birthday: { not: null },
      status: 'active'
    },
    include: {
      assignedLeader: { select: { id: true } }
    }
  });

  // Filter for upcoming birthdays
  const upcomingBirthdays = members.filter(m => {
    if (!m.birthday) return false;
    const bday = new Date(m.birthday);
    const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    return thisYearBday >= today && thisYearBday <= sevenDaysFromNow;
  });

  let notificationsCreated = 0;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  for (const member of upcomingBirthdays) {
    const bday = new Date(member.birthday!);
    const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    const daysUntil = Math.ceil((thisYearBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Get all users who should be notified
    const admins = await prisma.user.findMany({ where: { role: 'super_admin' } });
    const usersToNotify = [...new Set([
      ...admins.map(a => a.id),
      ...(member.assignedLeaderId ? [member.assignedLeaderId] : [])
    ])];

    for (const userId of usersToNotify) {
      // Check if notification already exists
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'birthday',
          message: { contains: `${member.firstName} ${member.lastName}` },
          createdAt: { gte: sevenDaysAgo }
        }
      });

      if (!existing) {
        const message = daysUntil === 0
          ? `Today is ${member.firstName} ${member.lastName}'s birthday!`
          : `${member.firstName} ${member.lastName}'s birthday is in ${daysUntil} day${daysUntil > 1 ? 's' : ''}.`;

        await prisma.notification.create({
          data: {
            userId,
            title: 'Upcoming Birthday',
            message,
            type: 'birthday'
          }
        });
        notificationsCreated++;
      }
    }
  }

  res.json({
    message: `Birthday check complete. ${notificationsCreated} notifications created.`,
    upcomingBirthdays: upcomingBirthdays.length
  });
});

export default router;
