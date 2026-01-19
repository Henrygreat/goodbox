import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';

const router = Router();

// Change own password (AUTH REQUIRED)
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const isValid = bcrypt.compareSync(currentPassword, user.passwordHash);
  if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ message: 'Password updated' });
});

// Forgot password (PUBLIC)
router.post('/forgot-password', async (req, res: Response) => {
  const { email } = req.body as { email?: string };

  // Always return generic message to prevent user enumeration
  const genericMessage = 'If that email exists, a reset link has been sent.';

  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Invalidate old unused tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    try {
      await sendPasswordResetEmail(user.email, rawToken, user.name);
    } catch (e) {
      // Don’t leak details to client; token still exists.
      console.error('[forgot-password] email send failed:', e);
    }
  }

  res.json({ message: genericMessage });
});

// Reset password (PUBLIC)
router.post('/reset-password', async (req, res: Response) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!resetToken) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    }),
    // Optional: invalidate any other outstanding tokens for this user
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() }
    })
  ]);

  res.json({ message: 'Password reset successful' });
});

// Admin reset another user's password (AUTH REQUIRED, super_admin only)
// ✅ Route is /auth/users/:id/reset-password
router.post(
  '/users/:id/reset-password',
  authenticateToken,
  requireRole('super_admin'),
  async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Invalidate old unused tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    let emailSent = false;
    try {
      emailSent = await sendPasswordResetEmail(user.email, rawToken, user.name);
    } catch (e) {
      console.error('[admin reset-password] email send failed:', e);
    }

    res.json({
      message: 'Reset initiated',
      emailSent,
      note: emailSent ? undefined : 'SMTP not configured or email failed - check server logs for reset link'
    });
  }
);

export default router;