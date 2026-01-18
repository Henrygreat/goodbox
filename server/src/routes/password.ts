import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';

const router = Router();

// Change own password (AUTH REQUIRED)
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isValid = bcrypt.compareSync(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  res.json({ message: 'Password updated' });
});

// Forgot password (PUBLIC)
router.post('/forgot-password', async (req, res: Response) => {
  const { email } = req.body;

  // Always return generic message to prevent user enumeration
  const genericMessage = 'If that email exists, a reset link has been sent.';

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Generate secure random token (32 bytes = 256 bits)
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Store SHA-256 hash of token in database
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    // Token expires in 60 minutes
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Create token record
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    // Send email (or log warning if SMTP not configured)
    await sendPasswordResetEmail(user.email, rawToken, user.name);
  }

  res.json({ message: genericMessage });
});

// Reset password (PUBLIC)
router.post('/reset-password', async (req, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  // Hash the incoming token
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find valid token
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { user: true }
  });

  if (!resetToken) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  // Update user password
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { passwordHash }
  });

  // Mark token as used
  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { usedAt: new Date() }
  });

  res.json({ message: 'Password reset successful' });
});

// Admin reset another user's password (AUTH REQUIRED, super_admin only)
router.post(
  '/admin/users/:id/reset-password',
  authenticateToken,
  requireRole('super_admin'),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(id);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Create token record
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    // Send email (or log warning if SMTP not configured)
    const emailSent = await sendPasswordResetEmail(user.email, rawToken, user.name);

    res.json({
      message: 'Reset initiated',
      emailSent,
      note: emailSent ? undefined : 'SMTP not configured - check server logs for reset link'
    });
  }
);

export default router;
