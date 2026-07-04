import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    nama: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token tidak ditemukan' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      id: string;
      email: string;
      role: string;
    };

    const user = await prisma.profile.findUnique({
      where: { id: decoded.id, aktif: true },
      select: { id: true, email: true, nama: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User tidak ditemukan atau tidak aktif' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Tidak terautentikasi' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Tidak memiliki akses untuk fitur ini' });
      return;
    }
    next();
  };
};

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  STAFF_GUDANG: 'staff_gudang',
  STAFF_KANTOR: 'staff_kantor',
  SALES: 'sales',
} as const;
