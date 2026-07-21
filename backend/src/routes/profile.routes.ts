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
      select: { id: true, email: true, username: true, nama: true, role: true, aktif: true, created_at: true },
      orderBy: { nama: 'asc' },
    });
    const formatted = profiles.map((p) => ({
      ...p,
      username: p.username || p.email.split('@')[0],
    }));
    res.json(formatted);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/profiles - Admin only: create user
profileRouter.post('/', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, username, password, nama, role } = req.body;
    if (!username || !password || !role) {
      res.status(400).json({ error: 'Username, Password, dan Role wajib diisi' });
      return;
    }
    const userEmail = email || `${username.trim()}@mmb.com`;
    const userNama = nama || username.trim();
    const hashed = await bcrypt.hash(password, 10);
    const profile = await prisma.profile.create({
      data: {
        id: uuidv4(),
        email: userEmail,
        username: username.trim(),
        password: hashed,
        nama: userNama,
        role,
      },
      select: { id: true, email: true, username: true, nama: true, role: true, aktif: true },
    });
    res.status(201).json(profile);
  } catch (e: any) {
    if (e.code === 'P2002') res.status(409).json({ error: 'Username sudah terdaftar' });
    else res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/profiles/:id - Admin only: update user
profileRouter.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, nama, role, aktif, password } = req.body;
    const data: any = {};
    if (nama) data.nama = nama;
    if (role) data.role = role;
    if (typeof aktif === 'boolean') data.aktif = aktif;
    if (username) data.username = username.trim();
    if (password && password.trim() !== '') data.password = await bcrypt.hash(password.trim(), 10);

    const profile = await prisma.profile.update({
      where: { id: req.params.id as string },
      data,
      select: { id: true, email: true, username: true, nama: true, role: true, aktif: true },
    });
    res.json(profile);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/profiles/:id - Admin only: delete user
profileRouter.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    if (req.user!.id === targetId) {
      res.status(400).json({ error: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif' });
      return;
    }

    const existing = await prisma.profile.findUnique({ where: { id: targetId } });
    if (!existing) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    await prisma.profile.delete({ where: { id: targetId } });
    res.json({ message: `User @${existing.username || existing.email} berhasil dihapus` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus user. Pastikan user tidak terikat transaksi.' });
  }
});
