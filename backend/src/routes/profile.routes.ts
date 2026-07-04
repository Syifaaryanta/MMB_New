import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, ROLES } from '../middleware/auth.middleware';

export const profileRouter = Router();

// GET /api/profiles - Admin only: get all users
profileRouter.get('/', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profiles = await prisma.profile.findMany({
      select: { id: true, email: true, nama: true, role: true, aktif: true, created_at: true },
      orderBy: { nama: 'asc' },
    });
    res.json(profiles);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/profiles - Admin only: create user
profileRouter.post('/', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, nama, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const profile = await prisma.profile.create({
      data: { id: uuidv4(), email, password: hashed, nama, role },
      select: { id: true, email: true, nama: true, role: true, aktif: true },
    });
    res.status(201).json(profile);
  } catch (e: any) {
    if (e.code === 'P2002') res.status(409).json({ error: 'Email sudah terdaftar' });
    else res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/profiles/:id - Admin only: update user
profileRouter.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { nama, role, aktif, password } = req.body;
    const data: any = { nama, role, aktif };
    if (password) data.password = await bcrypt.hash(password, 10);
    const profile = await prisma.profile.update({
      where: { id: req.params.id as string },
      data,
      select: { id: true, email: true, nama: true, role: true, aktif: true },
    });
    res.json(profile);
  } catch { res.status(500).json({ error: 'Server error' }); }
});
