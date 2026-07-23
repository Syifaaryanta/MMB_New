import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getInitials } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Database,
  User,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  UserCheck,
} from 'lucide-react';

import api from '@/lib/api';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, login, token, logout, checkSessionExpiration } = useAuthStore();
  const { language } = useSettingsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [focusedNavIdx, setFocusedNavIdx] = useState<number>(0);
  const [calendarFocused, setCalendarFocused] = useState(false);

  const [realtimeDate, setRealtimeDate] = useState('');
  const [realtimeClock, setRealtimeClock] = useState('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      const clockStr = now.toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setRealtimeDate(dateStr);
      setRealtimeClock(clockStr);
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, [language]);

  useEffect(() => {
    const handleFocusChange = (e: Event) => {
      setCalendarFocused((e as CustomEvent).detail);
    };
    window.addEventListener('calendar-focus-change', handleFocusChange);
    return () => {
      window.removeEventListener('calendar-focus-change', handleFocusChange);
    };
  }, []);

  // Collapse sidebar when navigating to menu pages, expand when on dashboard
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      setIsCollapsed(false);
    } else {
      setIsCollapsed(true);
    }
  }, [location.pathname, navigate]);

  // Define navigation items based on User Role and selected language
  const navItems = [
    {
      label: language === 'id' ? 'Dashboard' : 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'staff_gudang', 'staff_kantor', 'sales'],
    },
    {
      label: language === 'id' ? 'Gudang' : 'Inventory',
      path: '/gudang',
      icon: Package,
      roles: ['admin', 'staff_gudang'],
    },
    {
      label: language === 'id' ? 'Pembelian PO' : 'Purchases PO',
      path: '/pembelian',
      icon: ShoppingCart,
      roles: ['admin', 'staff_gudang', 'sales'],
    },
    {
      label: language === 'id' ? 'Penjualan SO' : 'Sales SO',
      path: '/penjualan',
      icon: TrendingUp,
      roles: ['admin', 'sales'],
    },
    {
      label: language === 'id' ? 'Penagihan AR' : 'Billing AR',
      path: '/penagihan',
      icon: DollarSign,
      roles: ['admin', 'sales'],
    },
    {
      label: language === 'id' ? 'Histori' : 'History',
      path: '/history',
      icon: History,
      roles: ['admin', 'sales', 'staff_kantor'],
    },
    {
      label: language === 'id' ? 'Laporan' : 'Reports',
      path: '/laporan',
      icon: ClipboardList,
      roles: ['admin', 'staff_kantor'],
    },
    {
      label: language === 'id' ? 'Master Data' : 'Master Data',
      path: '/master-data',
      icon: Database,
      roles: ['admin', 'staff_kantor', 'sales'],
    },
    {
      label: language === 'id' ? 'Kelola User' : 'Manage Users',
      path: '/kelola-user',
      icon: UserCheck,
      roles: ['super_admin'],
    },
  ];

  // Filter items matching user's role (super_admin sees all)
  const allowedNavItems = user
    ? navItems.filter((item) => user.role === 'super_admin' || item.roles.includes(user.role as any))
    : [];

  // Sync User Profile (e.g. role updates)
  useEffect(() => {
    if (token) {
      api.get('/auth/me').then((res) => {
        if (res.data && token) {
          login(res.data, token);
        }
      }).catch(() => {});
    }
  }, [token, login]);

  // Session Expiration Check (18:00 Auto Logout)
  useEffect(() => {
    const checkExpiration = () => {
      const isExpired = checkSessionExpiration();
      if (isExpired) {
        navigate('/login');
      }
    };
    checkExpiration();
    const interval = setInterval(checkExpiration, 10000);
    return () => clearInterval(interval);
  }, [checkSessionExpiration, navigate]);

  // Escape: Close mobile drawer or return to dashboard (sidebar will automatically expand)
  useHotkeys('esc', (e) => {
    if (isMobileOpen) {
      e.preventDefault();
      setIsMobileOpen(false);
      return;
    }
    if (location.pathname !== '/dashboard') {
      e.preventDefault();
      navigate('/dashboard');
    }
  }, { enableOnFormTags: false }, [location.pathname]);

  // Ctrl+P / Cmd+P: Navigate to User Profile
  useHotkeys('ctrl+p, cmd+p', (e) => {
    e.preventDefault();
    navigate('/profile');
  }, { enableOnFormTags: true });

  // Dashboard-specific Arrow keys and Enter to navigate Sidebar
  useHotkeys('down', (e) => {
    e.preventDefault();
    if (allowedNavItems.length > 0) {
      setFocusedNavIdx((prev) => (prev + 1) % allowedNavItems.length);
    }
  }, { enableOnFormTags: false, enabled: location.pathname === '/dashboard' && !calendarFocused }, [calendarFocused, allowedNavItems]);

  useHotkeys('up', (e) => {
    e.preventDefault();
    if (allowedNavItems.length > 0) {
      setFocusedNavIdx((prev) => (prev - 1 + allowedNavItems.length) % allowedNavItems.length);
    }
  }, { enableOnFormTags: false, enabled: location.pathname === '/dashboard' && !calendarFocused }, [calendarFocused, allowedNavItems]);

  useHotkeys('enter', (e) => {
    e.preventDefault();
    if (allowedNavItems.length > 0) {
      const targetPath = allowedNavItems[focusedNavIdx]?.path;
      if (targetPath) {
        navigate(targetPath);
      }
    }
  }, { enableOnFormTags: false, enabled: location.pathname === '/dashboard' && !calendarFocused }, [calendarFocused, allowedNavItems, focusedNavIdx]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-700 via-blue-800 to-indigo-900 border-r border-blue-600/20 text-blue-100">
      {/* Brand Logo Header */}
      <div className={`flex items-center p-4 border-b border-blue-600/30 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-blue-700 shadow-md shrink-0">
            M
          </div>
          {!isCollapsed && (
            <span className="font-bold text-lg bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              MMB System
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 py-4 space-y-2 overflow-y-auto ${isCollapsed ? 'px-0' : 'px-3'}`}>
        {allowedNavItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          const isFocused = location.pathname === '/dashboard' && idx === focusedNavIdx;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''} ${
                isCollapsed 
                  ? 'w-10 h-10 !p-0 rounded-xl mx-auto justify-center' 
                  : ''
              } ${isFocused ? 'border-2 border-white bg-white/10 shadow-lg shadow-white/5 ring-1 ring-white/30' : ''}`}
              title={isCollapsed ? item.label : undefined}
              onClick={() => setIsMobileOpen(false)}
            >
              <Icon size={20} className={isActive || isFocused ? 'text-white' : 'text-blue-300'} />
              {!isCollapsed && <span className={isActive || isFocused ? 'font-bold text-white' : 'font-medium'}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className={`p-4 border-t border-blue-600/30 flex flex-col gap-3 ${isCollapsed ? 'items-center px-0' : ''}`}>
        {isCollapsed ? (
          <>
            <Link
              to="/profile"
              className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-xs font-bold text-white hover:bg-white/25 transition-all shadow-md shrink-0"
              title={language === 'id' ? 'Profil Pengguna (Ctrl+P)' : 'User Profile (Ctrl+P)'}
            >
              {getInitials(user.username || user.nama).toUpperCase()}
            </Link>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-full hover:bg-red-500/20 hover:text-red-200 text-blue-200 flex items-center justify-center transition-all shrink-0"
              title={language === 'id' ? 'Keluar' : 'Logout'}
            >
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <>
            <Link
              to="/profile"
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 text-blue-100 transition-colors"
              title={language === 'id' ? 'Profil Pengguna (Ctrl+P)' : 'User Profile (Ctrl+P)'}
            >
              <div className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {getInitials(user.username || user.nama).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.username || user.nama}</p>
                <p className="text-xs text-blue-300 truncate capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-red-500/20 hover:text-red-200 text-blue-200 transition-colors"
              title={language === 'id' ? 'Keluar' : 'Logout'}
            >
              <LogOut size={20} />
              <span className="font-medium text-sm">{language === 'id' ? 'Keluar' : 'Logout'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-900 text-slate-800 font-sans print:h-auto print:overflow-visible print:bg-white print:text-black">
      {/* Sidebar for Desktop */}
      <aside className={`hidden md:block transition-all duration-300 h-full print:hidden ${isCollapsed ? 'w-16' : 'w-64'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden print:hidden">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsMobileOpen(false)} />
          {/* Content */}
          <div className="relative flex flex-col w-64 max-w-xs h-full bg-gradient-to-b from-blue-700 to-indigo-900 animate-slide-left z-10">
            <button
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={18} />
            </button>
            <div className="flex-1 h-full">{sidebarContent}</div>
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden print:h-auto print:overflow-visible">
        {/* Header */}
        <header className="h-16 border-b border-surface-700 bg-surface-800/80 backdrop-blur-md flex items-center justify-between px-6 z-10 print:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-surface-600 transition-colors"
            >
              <Menu size={20} className="text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-surface-600 border border-surface-700 text-slate-600 px-2 py-0.5 rounded-md font-mono font-semibold">
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Real-time Clock & Date */}
            <div className="hidden sm:flex items-center gap-3">
              {/* Attractive Real-time Clock */}
              <div className="bg-surface-900/60 border border-surface-700/80 px-4 py-1.5 rounded-full text-slate-400 font-mono text-xs flex items-center gap-2.5 shadow-inner">
                <span className="font-semibold text-slate-350 text-[11px]">{realtimeDate}</span>
                <span className="text-surface-700 font-black">|</span>
                <span className="font-extrabold text-blue-500 tracking-wider bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15">{realtimeClock}</span>
              </div>

              {/* Small Keyboard Shortcut Badge */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-surface-900/25 border border-surface-700/40 rounded-lg px-2.5 py-1" title="Tekan Ctrl+Shift+P untuk Profil">
              </div>
            </div>

            {/* Profile trigger */}
            <Link
              to="/profile"
              className="flex items-center gap-3 hover:opacity-85 transition-opacity"
            >
              <span className="hidden sm:inline text-sm font-semibold text-slate-800">{user.username || user.nama}</span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md border border-primary-400/20">
                {getInitials(user.username || user.nama)}
              </div>
            </Link>
          </div>
        </header>

        {/* Content Page wrapper */}
        <div id="main-portal-target" className="relative flex-1 overflow-hidden print:overflow-visible">
          <main className="h-full overflow-y-auto p-6 md:p-8 animate-fade-in print:p-0 print:overflow-visible print:bg-white print:text-black">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
