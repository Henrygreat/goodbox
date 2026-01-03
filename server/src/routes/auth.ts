import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../database';
import { generateToken, authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { LoginRequest } from '../types';

const router = Router();

// Login
router.post('/login', async (req, res: Response) => {
  const { email, password }: LoginRequest = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

// Create cell leader (admin only)
router.post('/users', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const { email, password, name, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      phone: phone || null,
      role: 'cell_leader'
    },
    select: { id: true, email: true, name: true, phone: true, role: true }
  });

  res.status(201).json(user);
});

// Get all cell leaders (admin only)
router.get('/users', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { role: 'cell_leader' },
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    orderBy: { name: 'asc' }
  });

  res.json(users);
});

// Update user
router.put('/users/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, phone, password } = req.body;

  // Users can update their own profile, admins can update anyone
  if (req.user!.userId !== parseInt(id) && req.user!.role !== 'super_admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone || null;
  if (password) updateData.passwordHash = bcrypt.hashSync(password, 10);

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const user = await prisma.user.update({
    where: { id: parseInt(id) },
    data: updateData,
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true }
  });

  res.json(user);
});

// Delete cell leader (admin only)
router.delete('/users/:id', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: parseInt(id) },
    select: { role: true }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.role === 'super_admin') {
    return res.status(400).json({ error: 'Cannot delete super admin' });
  }

  await prisma.user.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'User deleted successfully' });
});

export default router;
