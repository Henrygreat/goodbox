import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import prisma from "../database";
import {
  generateToken,
  authenticateToken,
  AuthRequest,
  requireRole,
} from "../middleware/auth";
import { LoginRequest } from "../types";

const router = Router();

// ---------- helpers ----------
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function validatePassword(pw: string) {
  // Keep it simple but effective
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  return null;
}

function makeResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function sendResetEmail(to: string, resetUrl: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const from = process.env.SMTP_FROM || "no-reply@loveworldtelford.org";

  if (!host || !user || !pass) {
    // SMTP not configured - don't throw, just signal false
    return { sent: false, reason: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject: "Password reset",
    text: `Reset your password using this link: ${resetUrl}`,
    html: `<p>Reset your password using this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });

  return { sent: true };
}

// ---------- Login ----------
router.post("/login", async (req, res: Response) => {
  const { email, password }: LoginRequest = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// ---------- Get current user ----------
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json(user);
});

// ---------- Create cell leader (admin only) ----------
router.post(
  "/users",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "Email, password, and name are required" });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone: phone || null,
        role: "cell_leader",
      },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });

    res.status(201).json(user);
  }
);

// ---------- Get all cell leaders (admin only) ----------
router.get(
  "/users",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({
      where: { role: "cell_leader" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    res.json(users);
  }
);

// ---------- Update user profile (NO password here) ----------
router.put("/users/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, phone } = req.body;

  // Users can update their own profile, admins can update anyone
  if (req.user!.userId !== parseInt(id, 10) && req.user!.role !== "super_admin") {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone || null;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const user = await prisma.user.update({
    where: { id: parseInt(id, 10) },
    data: updateData,
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
  });

  res.json(user);
});

// ---------- Delete cell leader (admin only) ----------
router.delete(
  "/users/:id",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
      select: { role: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "super_admin") {
      return res.status(400).json({ error: "Cannot delete super admin" });
    }

    await prisma.user.delete({ where: { id: parseInt(id, 10) } });
    res.json({ message: "User deleted successfully" });
  }
);

// =======================================================
// PASSWORD FLOWS
// =======================================================

// User changes OWN password (must know current password)
router.post(
  "/change-password",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }

    const pwErr = validatePassword(newPassword);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const ok = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    const passwordHash = bcrypt.hashSync(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ message: "Password changed successfully" });
  }
);

// Forgot password (email token)
router.post("/forgot-password", async (req, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "Email is required" });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  // Always return success (don’t leak if email exists)
  if (!user) return res.json({ message: "If the email exists, a reset link has been sent." });

  const token = makeResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const frontendBase = process.env.FRONTEND_BASE_URL || process.env.COOLIFY_FQDN || "";
  const resetUrl = frontendBase
    ? `${frontendBase.replace(/\/$/, "")}/reset-password?token=${token}`
    : `https://YOUR-FRONTEND/reset-password?token=${token}`;

  try {
    await sendResetEmail(user.email, resetUrl);
  } catch {
    // swallow errors to avoid breaking UX
  }

  res.json({ message: "If the email exists, a reset link has been sent." });
});

// Reset password using token
router.post("/reset-password", async (req, res: Response) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    return res.status(400).json({ error: "token and newPassword are required" });
  }

  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  });

  if (!record) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  res.json({ message: "Password reset successfully" });
});

// Admin resets another user's password (email token)
router.post(
  "/admin/users/:id/reset-password",
  authenticateToken,
  requireRole("super_admin"),
  async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id, 10);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const token = makeResetToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendBase = process.env.FRONTEND_BASE_URL || process.env.COOLIFY_FQDN || "";
    const resetUrl = frontendBase
      ? `${frontendBase.replace(/\/$/, "")}/reset-password?token=${token}`
      : `https://YOUR-FRONTEND/reset-password?token=${token}`;

    let emailSent = false;
    let note: string | undefined;

    try {
      const r = await sendResetEmail(user.email, resetUrl);
      emailSent = r.sent;
      if (!r.sent) note = r.reason;
    } catch {
      note = "Failed to send email";
    }

    res.json({ message: "Reset initiated", emailSent, note });
  }
);

export default router;