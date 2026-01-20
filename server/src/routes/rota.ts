import { Router, Response } from "express";
import prisma from "../database";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";
import { ServiceType, RotaRole } from "@prisma/client";

const router = Router();

function parseDateOnlyToUtc(dateStr: string): Date {
  // dateStr is "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) throw new Error("Invalid service_date");
  // Use UTC midnight so it’s stable across timezones
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

// GET /rota?service_type=sunday&from=2026-01-01&to=2026-02-01
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { service_type, from, to } = req.query as {
    service_type?: ServiceType;
    from?: string;
    to?: string;
  };

  const where: any = {};

  if (service_type) where.serviceType = service_type;

  if (from || to) {
    where.serviceDate = {};
    if (from) where.serviceDate.gte = parseDateOnlyToUtc(from);
    if (to) where.serviceDate.lte = parseDateOnlyToUtc(to);
  }

  const rotas = await prisma.rota.findMany({
    where,
    include: {
      assignments: {
        include: { user: { select: { id: true, name: true } } },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { serviceDate: "desc" },
  });

  // Return snake_case for frontend
  res.json(
    rotas.map((r) => ({
      id: r.id,
      service_date: r.serviceDate.toISOString().slice(0, 10),
      service_type: r.serviceType,
      notes: r.notes,
      created_by: r.createdBy
        ? { id: r.createdBy.id, name: r.createdBy.name, email: r.createdBy.email }
        : null,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
      assignments: r.assignments.map((a) => ({
        id: a.id,
        role: a.role,
        user_id: a.userId ?? null,
        user_name: a.user?.name ?? null,
        name: a.name ?? null,
      })),
    }))
  );
});

// GET /rota/:id
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const rota = await prisma.rota.findUnique({
    where: { id },
    include: {
      assignments: { include: { user: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!rota) return res.status(404).json({ error: "Rota not found" });

  res.json({
    id: rota.id,
    service_date: rota.serviceDate.toISOString().slice(0, 10),
    service_type: rota.serviceType,
    notes: rota.notes,
    created_by: rota.createdBy
      ? { id: rota.createdBy.id, name: rota.createdBy.name, email: rota.createdBy.email }
      : null,
    created_at: rota.createdAt,
    updated_at: rota.updatedAt,
    assignments: rota.assignments.map((a) => ({
      id: a.id,
      role: a.role,
      user_id: a.userId ?? null,
      user_name: a.user?.name ?? null,
      name: a.name ?? null,
    })),
  });
});

// POST /rota  (admin only)
router.post("/", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  const { service_date, service_type, notes, assignments } = req.body as {
    service_date?: string;
    service_type?: ServiceType;
    notes?: string;
    assignments?: { role: RotaRole; user_id?: number; name?: string }[];
  };

  if (!service_date || !service_type) {
    return res.status(400).json({ error: "service_date and service_type are required" });
  }

  const validServiceTypes: ServiceType[] = ["sunday", "wednesday"];
  if (!validServiceTypes.includes(service_type)) {
    return res.status(400).json({ error: "Invalid service_type" });
  }

  const validRoles: RotaRole[] = ["opening_prayer", "rhapsody_reading", "closing_announcements"];

  const payloadAssignments = Array.isArray(assignments) ? assignments : [];

  // Validate + normalize assignments:
  // - only keep ones that have user_id OR name
  // - role must be valid
  // - prevent duplicates by role
  const seenRoles = new Set<RotaRole>();
  const cleaned = [];

  for (const a of payloadAssignments) {
    if (!a?.role || !validRoles.includes(a.role)) continue;

    const userId = typeof a.user_id === "number" ? a.user_id : undefined;
    const typedName = typeof a.name === "string" ? a.name.trim() : "";

    if (!userId && !typedName) continue; // ignore empty rows

    if (seenRoles.has(a.role)) {
      return res.status(400).json({ error: `Duplicate assignment for role: ${a.role}` });
    }
    seenRoles.add(a.role);

    // If user_id present, ignore name (optional)
    cleaned.push({
      role: a.role,
      userId: userId ?? null,
      name: userId ? null : typedName || null,
    });
  }

  const serviceDate = parseDateOnlyToUtc(service_date);

  try {
    const rota = await prisma.rota.create({
      data: {
        serviceDate,
        serviceType: service_type,
        notes: notes?.trim() ? notes.trim() : null,
        createdById: req.user!.userId,
        assignments: {
          create: cleaned,
        },
      },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json({
      id: rota.id,
      service_date: rota.serviceDate.toISOString().slice(0, 10),
      service_type: rota.serviceType,
      notes: rota.notes,
      assignments: rota.assignments.map((a) => ({
        id: a.id,
        role: a.role,
        user_id: a.userId ?? null,
        user_name: a.user?.name ?? null,
        name: a.name ?? null,
      })),
    });
  } catch (e: any) {
    // unique constraint on (serviceDate, serviceType)
    if (String(e?.code) === "P2002") {
      return res.status(409).json({ error: "Rota already exists for this date and service type" });
    }
    console.error("[rota create] error:", e);
    return res.status(500).json({ error: "Failed to create rota" });
  }
});

// PUT /rota/:id  (admin only)
router.put("/:id", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const existing = await prisma.rota.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Rota not found" });

  const { service_date, service_type, notes, assignments } = req.body as {
    service_date?: string;
    service_type?: ServiceType;
    notes?: string;
    assignments?: { role: RotaRole; user_id?: number; name?: string }[];
  };

  const dataToUpdate: any = {};

  if (service_date) dataToUpdate.serviceDate = parseDateOnlyToUtc(service_date);

  if (service_type) {
    const validServiceTypes: ServiceType[] = ["sunday", "wednesday"];
    if (!validServiceTypes.includes(service_type)) {
      return res.status(400).json({ error: "Invalid service_type" });
    }
    dataToUpdate.serviceType = service_type;
  }

  if (notes !== undefined) {
    dataToUpdate.notes = notes?.trim() ? notes.trim() : null;
  }

  const validRoles: RotaRole[] = ["opening_prayer", "rhapsody_reading", "closing_announcements"];

  let cleanedAssignments: { role: RotaRole; userId: number | null; name: string | null }[] | null = null;

  if (assignments !== undefined) {
    const payloadAssignments = Array.isArray(assignments) ? assignments : [];
    const seenRoles = new Set<RotaRole>();
    cleanedAssignments = [];

    for (const a of payloadAssignments) {
      if (!a?.role || !validRoles.includes(a.role)) continue;

      const userId = typeof a.user_id === "number" ? a.user_id : undefined;
      const typedName = typeof a.name === "string" ? a.name.trim() : "";

      if (!userId && !typedName) continue;

      if (seenRoles.has(a.role)) {
        return res.status(400).json({ error: `Duplicate assignment for role: ${a.role}` });
      }
      seenRoles.add(a.role);

      cleanedAssignments.push({
        role: a.role,
        userId: userId ?? null,
        name: userId ? null : typedName || null,
      });
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // If assignments provided, replace all assignments
      if (cleanedAssignments) {
        await tx.rotaAssignment.deleteMany({ where: { rotaId: id } });
        if (cleanedAssignments.length > 0) {
          await tx.rotaAssignment.createMany({
            data: cleanedAssignments.map((a) => ({
              rotaId: id,
              role: a.role,
              userId: a.userId ?? null,
            })),
          });
        }
      }

      return tx.rota.update({
        where: { id },
        data: dataToUpdate,
        include: {
          assignments: { include: { user: { select: { id: true, name: true } } } },
        },
      });
    });

    res.json({
      id: updated.id,
      service_date: updated.serviceDate.toISOString().slice(0, 10),
      service_type: updated.serviceType,
      notes: updated.notes,
      assignments: updated.assignments.map((a) => ({
        id: a.id,
        role: a.role,
        user_id: a.userId ?? null,
        user_name: a.user?.name ?? null,
        name: a.name ?? null,
      })),
    });
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return res.status(409).json({ error: "Rota already exists for this date and service type" });
    }
    console.error("[rota update] error:", e);
    return res.status(500).json({ error: "Failed to update rota" });
  }
});

// DELETE /rota/:id (admin only)
router.delete("/:id", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const existing = await prisma.rota.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Rota not found" });

  await prisma.rota.delete({ where: { id } });
  res.json({ message: "Rota deleted" });
});

export default router;