import { Router, Response } from 'express';
import prisma from '../database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { ServiceType } from '../types';

const router = Router();

// Get attendance for a member
router.get('/member/:memberId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { memberId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

  const attendance = await prisma.attendance.findMany({
    where: { memberId: parseInt(memberId) },
    orderBy: { serviceDate: 'desc' },
    take: limit
  });

  res.json(attendance);
});

// Get attendance for a specific date
router.get('/date/:date', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { date } = req.params;
  const { service_type } = req.query;

  const where: any = { serviceDate: new Date(date) };
  if (service_type) where.serviceType = service_type;

  const attendance = await prisma.attendance.findMany({
    where,
    include: {
      member: {
        select: { firstName: true, lastName: true, cellGroupId: true, cellGroup: { select: { name: true } } }
      }
    },
    orderBy: { member: { firstName: 'asc' } }
  });

  res.json(attendance.map(a => ({
    ...a,
    first_name: a.member.firstName,
    last_name: a.member.lastName,
    cell_group_id: a.member.cellGroupId,
    cell_group_name: a.member.cellGroup?.name
  })));
});

// Mark attendance
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { member_id, service_date, service_type, attended } = req.body;

  if (!member_id || !service_date || !service_type) {
    return res.status(400).json({ error: 'Member ID, service date, and service type are required' });
  }

  const validTypes: ServiceType[] = ['sunday', 'midweek', 'cell_meeting'];
  if (!validTypes.includes(service_type)) {
    return res.status(400).json({ error: 'Invalid service type' });
  }

  await prisma.attendance.upsert({
    where: {
      memberId_serviceDate_serviceType: {
        memberId: member_id,
        serviceDate: new Date(service_date),
        serviceType: service_type
      }
    },
    update: { attended: attended !== false },
    create: {
      memberId: member_id,
      serviceDate: new Date(service_date),
      serviceType: service_type,
      attended: attended !== false
    }
  });

  // Update member journey status if they're regularly attending
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const attendanceCount = await prisma.attendance.count({
    where: {
      memberId: member_id,
      attended: true,
      serviceDate: { gte: thirtyDaysAgo }
    }
  });

  if (attendanceCount >= 3) {
    const member = await prisma.member.findUnique({
      where: { id: member_id },
      select: { journeyStatus: true }
    });

    if (member && ['new', 'contacted'].includes(member.journeyStatus)) {
      await prisma.member.update({
        where: { id: member_id },
        data: { journeyStatus: 'engaged' }
      });
    }
  }

  res.json({ message: 'Attendance recorded' });
});

// Bulk mark attendance for a service
router.post('/bulk', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { service_date, service_type, attendees } = req.body as {
    service_date: string;
    service_type: ServiceType;
    attendees: { member_id: number; attended: boolean }[];
  };

  if (!service_date || !service_type || !attendees) {
    return res.status(400).json({ error: 'Service date, type, and attendees are required' });
  }

  const serviceDate = new Date(service_date);

  for (const record of attendees) {
    await prisma.attendance.upsert({
      where: {
        memberId_serviceDate_serviceType: {
          memberId: record.member_id,
          serviceDate,
          serviceType: service_type
        }
      },
      update: { attended: record.attended },
      create: {
        memberId: record.member_id,
        serviceDate,
        serviceType: service_type,
        attended: record.attended
      }
    });
  }

  res.json({ message: `Attendance recorded for ${attendees.length} members` });
});

// Get attendance statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { start_date, end_date } = req.query;

  const startDate = start_date ? new Date(start_date as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = end_date ? new Date(end_date as string) : new Date();

  // Overall attendance by service type
  const byServiceType = await prisma.attendance.groupBy({
    by: ['serviceType'],
    where: { serviceDate: { gte: startDate, lte: endDate } },
    _count: { id: true },
    _sum: { attended: true }
  });

  // Low attendance members
  const members = await prisma.member.findMany({
    where: { status: 'active' },
    include: {
      attendance: {
        where: { serviceDate: { gte: startDate, lte: endDate } }
      }
    }
  });

  const lowAttendance = members
    .map(m => ({
      id: m.id,
      first_name: m.firstName,
      last_name: m.lastName,
      total_services: m.attendance.length,
      attended_count: m.attendance.filter(a => a.attended).length,
      attendance_rate: m.attendance.length > 0
        ? Math.round((m.attendance.filter(a => a.attended).length / m.attendance.length) * 100)
        : null
    }))
    .filter(m => m.attendance_rate === null || m.attendance_rate < 50)
    .slice(0, 20);

  res.json({
    period: { start_date: startDate, end_date: endDate },
    byServiceType: byServiceType.map(s => ({
      service_type: s.serviceType,
      total_records: s._count.id,
      total_attended: s._sum.attended || 0,
      attendance_rate: s._count.id > 0 ? Math.round(((s._sum.attended || 0) / s._count.id) * 100) : 0
    })),
    lowAttendance
  });
});

export default router;
