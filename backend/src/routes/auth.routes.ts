import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email dan password wajib diisi' });
      return;
    }

    const user = await prisma.profile.findUnique({ where: { email } });
    if (!user || !user.aktif) {
      res.status(401).json({ error: 'Email atau Password Salah' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Email atau Password Salah' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, nama: user.nama, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.profile.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, nama: true, role: true, created_at: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/change-password
authRouter.post('/change-password', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.profile.findUnique({ where: { id: req.user!.id } });
    if (!user) { res.status(404).json({ error: 'User tidak ditemukan' }); return; }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) { res.status(400).json({ error: 'Password saat ini tidak sesuai' }); return; }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.profile.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ message: 'Password berhasil diubah' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});
