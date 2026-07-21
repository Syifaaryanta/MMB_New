import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  username: string;
  nama: string;
  role: 'super_admin' | 'admin' | 'staff_gudang' | 'staff_kantor' | 'sales';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  checkSessionExpiration: () => boolean;
}

export function isSessionExpired(loginTimestamp?: string | number | null): boolean {
  if (!loginTimestamp) return false;
  const loginTime = Number(loginTimestamp);
  if (isNaN(loginTime) || loginTime <= 0) return false;

  const loginDate = new Date(loginTime);
  const cutoffDate = new Date(loginDate);

  if (loginDate.getHours() < 18) {
    // Cutoff is 18:00 today
    cutoffDate.setHours(18, 0, 0, 0);
  } else {
    // Cutoff is 18:00 tomorrow
    cutoffDate.setDate(cutoffDate.getDate() + 1);
    cutoffDate.setHours(18, 0, 0, 0);
  }

  return Date.now() >= cutoffDate.getTime();
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Load initial state from localStorage
  const savedToken = localStorage.getItem('mmb_token');
  const savedUser = localStorage.getItem('mmb_user');
  const savedLoginTime = localStorage.getItem('mmb_login_time');

  let initialUser: User | null = null;
  if (savedUser) {
    try {
      initialUser = JSON.parse(savedUser);
    } catch {
      localStorage.removeItem('mmb_user');
    }
  }

  // Check initial 18:00 expiration
  const expired = isSessionExpired(savedLoginTime);
  if (expired && savedToken) {
    localStorage.removeItem('mmb_token');
    localStorage.removeItem('mmb_user');
    localStorage.removeItem('mmb_login_time');
  }

  const validToken = expired ? null : savedToken;
  const validUser = expired ? null : initialUser;

  return {
    user: validUser,
    token: validToken,
    isAuthenticated: !!validToken && !!validUser,

    login: (user, token) => {
      const now = Date.now();
      localStorage.setItem('mmb_token', token);
      localStorage.setItem('mmb_user', JSON.stringify(user));
      localStorage.setItem('mmb_login_time', String(now));
      set({ user, token, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem('mmb_token');
      localStorage.removeItem('mmb_user');
      localStorage.removeItem('mmb_login_time');
      set({ user: null, token: null, isAuthenticated: false });
    },

    checkSessionExpiration: () => {
      const loginTime = localStorage.getItem('mmb_login_time');
      if (isSessionExpired(loginTime)) {
        get().logout();
        return true;
      }
      return false;
    },
  };
});
