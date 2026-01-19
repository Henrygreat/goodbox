import { Router, Response } from "express";
import prisma from "../database";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { ServiceType } from "../types";

const router = Router();

/**
 * Convert YYYY-MM-DD to a UTC day range so timezone doesn't break filtering.
 */
function toUtcDayRange(dateStr: string) {
  // dateStr expected: YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999));
  return { start, end };
}

/**
 * Ensure consistent snake_case output for attendance rows.
 */
function toAttendanceResponse(a: any) {
  return {
    id: a.id,
    member_id: a.memberId,
    service_date: a.serviceDate,
    service_type: a.serviceType,
    attended: a.attended,
    created_at: a.createdAt,
  };
}

// Get attendance for a member
router.get(
  "/member/:memberId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { memberId } = req.params;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;

    const attendance = await prisma.attendance.findMany({
      where: { memberId: parseInt(memberId, 10) },
      orderBy: { serviceDate: "desc" },
      take: limit,
    });

    res.json(attendance.map(toAttendanceResponse));
  }
);

// Get attendance for a specific date (YYYY-MM-DD)
router.get(
  "/date/:date",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { date } = req.params;
    const { service_type } = req.query;

    const { start, end } = toUtcDayRange(date);

    const where: any = { serviceDate: { gte: start, lte: end } };
    if (service_type) where.serviceType = service_type as ServiceType;

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        member: {
          select: {
            firstName: true,
            lastName: true,
            cellGroupId: true,
            cellGroup: { select: { name: true } },
          },
        },
      },
      orderBy: { member: { firstName: "asc" } },
    });

    res.json(
      attendance.map((a) => ({
        ...toAttendanceResponse(a),
        first_name: a.member.firstName,
        last_name: a.member.lastName,
        cell_group_id: a.member.cellGroupId,
        cell_group_name: a.member.cellGroup?.name ?? null,
      }))
    );
  }
);

// Mark attendance
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { member_id, service_date, service_type, attended } = req.body as {
    member_id?: number;
    service_date?: string; // YYYY-MM-DD recommended
    service_type?: ServiceType;
    attended?: boolean;
  };

  if (!member_id || !service_date || !service_type) {
    return res
      .status(400)
      .json({ error: "Member ID, service date, and service type are required" });
  }

  const validTypes: ServiceType[] = ["sunday", "midweek", "cell_meeting"];
  if (!validTypes.includes(service_type)) {
    return res.status(400).json({ error: "Invalid service type" });
  }

  // store attendance as a date (UTC midnight) to avoid duplicates due to time parts
  const { start } = toUtcDayRange(service_date);
  const serviceDate = start;

  const row = await prisma.attendance.upsert({
    where: {
      memberId_serviceDate_serviceType: {
        memberId: member_id,
        serviceDate,
        serviceType: service_type,
      },
    },
    update: { attended: attended !== false },
    create: {
      memberId: member_id,
      serviceDate,
      serviceType: service_type,
      attended: attended !== false,
    },
  });

  // Update member journey status if they're regularly attending
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const attendanceCount = await prisma.attendance.count({
    where: {
      memberId: member_id,
      attended: true,
      serviceDate: { gte: thirtyDaysAgo },
    },
  });

  if (attendanceCount >= 3) {
    const member = await prisma.member.findUnique({
      where: { id: member_id },
      select: { journeyStatus: true },
    });

    if (member && ["new", "contacted"].includes(member.journeyStatus)) {
      await prisma.member.update({
        where: { id: member_id },
        data: { journeyStatus: "engaged" },
      });
    }
  }

  res.json({ message: "Attendance recorded", attendance: toAttendanceResponse(row) });
});

// Bulk mark attendance for a service
router.post(
  "/bulk",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { service_date, service_type, attendees } = req.body as {
      service_date: string; // YYYY-MM-DD recommended
      service_type: ServiceType;
      attendees: { member_id: number; attended: boolean }[];
    };

    if (!service_date || !service_type || !attendees) {
      return res
        .status(400)
        .json({ error: "Service date, type, and attendees are required" });
    }

    const validTypes: ServiceType[] = ["sunday", "midweek", "cell_meeting"];
    if (!validTypes.includes(service_type)) {
      return res.status(400).json({ error: "Invalid service type" });
    }

    const { start } = toUtcDayRange(service_date);
    const serviceDate = start;

    for (const record of attendees) {
      await prisma.attendance.upsert({
        where: {
          memberId_serviceDate_serviceType: {
            memberId: record.member_id,
            serviceDate,
            serviceType: service_type,
          },
        },
        update: { attended: record.attended },
        create: {
          memberId: record.member_id,
          serviceDate,
          serviceType: service_type,
          attended: record.attended,
        },
      });
    }

    res.json({ message: `Attendance recorded for ${attendees.length} members` });
  }
);

// Get attendance statistics
router.get(
  "/stats",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { start_date, end_date } = req.query;

    const startDate = start_date
      ? new Date(start_date as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const endDate = end_date ? new Date(end_date as string) : new Date();

    const where = { serviceDate: { gte: startDate, lte: endDate } };

    const totals = await prisma.attendance.groupBy({
      by: ["serviceType"],
      where,
      _count: { _all: true },
    });

    const attendedTotals = await prisma.attendance.groupBy({
      by: ["serviceType"],
      where: { ...where, attended: true },
      _count: { _all: true },
    });

    const attendedMap = new Map(
      attendedTotals.map((s) => [s.serviceType, s._count._all])
    );

    const byServiceType = totals.map((s) => {
      const total = s._count._all;
      const attendedCount = attendedMap.get(s.serviceType) ?? 0;

      return {
        service_type: s.serviceType,
        total_records: total,
        total_attended: attendedCount,
        attendance_rate: total > 0 ? Math.round((attendedCount / total) * 100) : 0,
      };
    });

    const members = await prisma.member.findMany({
      where: { status: "active" },
      include: {
        attendance: { where },
      },
    });

    const lowAttendance = members
      .map((m) => {
        const attendedCount = m.attendance.filter((a) => a.attended).length;
        const totalServices = m.attendance.length;

        return {
          id: m.id,
          first_name: m.firstName,
          last_name: m.lastName,
          total_services: totalServices,
          attended_count: attendedCount,
          attendance_rate:
            totalServices > 0 ? Math.round((attendedCount / totalServices) * 100) : null,
        };
      })
      .filter((m) => m.attendance_rate === null || m.attendance_rate < 50)
      .slice(0, 20);

    res.json({
      period: { start_date: startDate, end_date: endDate },
      byServiceType,
      lowAttendance,
    });
  }
);

export default router;