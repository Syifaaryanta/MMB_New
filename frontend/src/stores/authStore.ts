import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  nama: string;
  role: 'admin' | 'staff_gudang' | 'staff_kantor' | 'sales';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Load initial state from localStorage
  const savedToken = localStorage.getItem('mmb_token');
  const savedUser = localStorage.getItem('mmb_user');

  let initialUser: User | null = null;
  if (savedUser) {
    try {
      initialUser = JSON.parse(savedUser);
    } catch {
      localStorage.removeItem('mmb_user');
    }
  }

  return {
    user: initialUser,
    token: savedToken,
    isAuthenticated: !!savedToken && !!initialUser,
    login: (user, token) => {
      localStorage.setItem('mmb_token', token);
      localStorage.setItem('mmb_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true });
    },
    logout: () => {
      localStorage.removeItem('mmb_token');
      localStorage.removeItem('mmb_user');
      set({ user: null, token: null, isAuthenticated: false });
    },
  };
});
