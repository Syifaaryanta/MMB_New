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
    const usernameInput = req.body.username || req.body.email;
    const { password } = req.body;
    if (!usernameInput || !password) {
      res.status(400).json({ error: 'Username dan password wajib diisi' });
      return;
    }

    const user = await prisma.profile.findFirst({
      where: {
        OR: [
          { username: usernameInput },
          { email: usernameInput },
        ],
      },
    });
    if (!user || !user.aktif) {
      res.status(401).json({ error: 'Username atau Password Salah' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Username atau Password Salah' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        nama: user.nama,
        role: user.role,
      },
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
      select: { id: true, email: true, username: true, nama: true, role: true, created_at: true },
    });
    if (user) {
      (user as any).username = user.username || user.email.split('@')[0];
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/update-profile
authRouter.put('/update-profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, nama, role, currentPassword, newPassword } = req.body;
    const user = await prisma.profile.findUnique({ where: { id: req.user!.id } });
    if (!user) { res.status(404).json({ error: 'User tidak ditemukan' }); return; }

    const updateData: any = {};

    if (nama && nama.trim() !== '') {
      updateData.nama = nama.trim();
    }

    // Only super_admin can update role
    if (role && user.role === 'super_admin') {
      const validRoles = ['super_admin', 'admin', 'staff_gudang', 'staff_kantor', 'sales'];
      if (validRoles.includes(role)) {
        updateData.role = role;
      }
    }

    if (username && username.trim() !== '') {
      const trimmedUsername = username.trim();
      const existing = await prisma.profile.findFirst({
        where: {
          username: trimmedUsername,
          NOT: { id: user.id },
        },
      });
      if (existing) {
        res.status(400).json({ error: 'Username sudah digunakan oleh akun lain' });
        return;
      }
      updateData.username = trimmedUsername;
    }

    if (newPassword && newPassword.trim() !== '') {
      if (!currentPassword) {
        res.status(400).json({ error: 'Password saat ini wajib diisi jika ingin mengubah password' });
        return;
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        res.status(400).json({ error: 'Password saat ini tidak sesuai' });
        return;
      }
      updateData.password = await bcrypt.hash(newPassword.trim(), 10);
    }

    const updatedUser = await prisma.profile.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, email: true, username: true, nama: true, role: true },
    });

    res.json({
      message: 'Profil berhasil diperbarui',
      user: {
        ...updatedUser,
        username: updatedUser.username || updatedUser.email.split('@')[0],
      },
    });
  } catch (err: any) {
    console.error(err);
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
