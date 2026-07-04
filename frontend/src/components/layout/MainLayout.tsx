import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuthStore } from '@/stores/authStore';
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
  ClipboardList
} from 'lucide-react';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [focusedNavIdx, setFocusedNavIdx] = useState<number>(0);
  const [calendarFocused, setCalendarFocused] = useState(false);

  React.useEffect(() => {
    const handleFocusChange = (e: Event) => {
      setCalendarFocused((e as CustomEvent).detail);
    };
    window.addEventListener('calendar-focus-change', handleFocusChange);
    return () => {
      window.removeEventListener('calendar-focus-change', handleFocusChange);
    };
  }, []);

  // Define navigation items based on User Role
  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'staff_gudang', 'staff_kantor', 'sales'],
    },
    {
      label: 'Gudang',
      path: '/gudang',
      icon: Package,
      roles: ['admin', 'staff_gudang'],
    },
    {
      label: 'Pembelian PO',
      path: '/pembelian',
      icon: ShoppingCart,
      roles: ['admin', 'sales'],
    },
    {
      label: 'Penjualan SO',
      path: '/penjualan',
      icon: TrendingUp,
      roles: ['admin', 'sales'],
    },
    {
      label: 'Penagihan AR',
      path: '/penagihan',
      icon: DollarSign,
      roles: ['admin', 'sales'],
    },
    {
      label: 'Laporan',
      path: '/laporan',
      icon: ClipboardList,
      roles: ['admin', 'staff_kantor'],
    },
    {
      label: 'Master Data',
      path: '/master-data',
      icon: Database,
      roles: ['admin', 'staff_gudang', 'staff_kantor', 'sales'],
    },
  ];

  // Filter items matching user's role
  const allowedNavItems = user ? navItems.filter((item) => item.roles.includes(user.role)) : [];

  // Global Keyboard Shortcuts
  // Escape: Hanya untuk menutup mobile drawer jika sedang terbuka
  // Sidebar desktop dikontrol lewat tombol chevron (bukan Esc)
  // Setiap halaman bebas menggunakan Esc untuk kebutuhan masing-masing (reset filter, tutup modal, dll)
  useHotkeys('esc', (e) => {
    if (isMobileOpen) {
      e.preventDefault();
      setIsMobileOpen(false);
    }
    // Jika mobile drawer tidak terbuka, biarkan halaman menangani Esc sendiri
  }, { enableOnFormTags: true });

  // Ctrl+Shift+P: Navigate to User Profile
  useHotkeys('ctrl+shift+p', (e) => {
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
      <div className="flex items-center justify-between p-4 border-b border-blue-600/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-bold text-blue-700 shadow-md">
            M
          </div>
          {!isCollapsed && (
            <span className="font-bold text-lg bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              MMB System
            </span>
          )}
        </div>
        {/* Toggle Collapse Desktop button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
          title="Toggle Sidebar (klik tombol ini)"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {allowedNavItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          const isFocused = location.pathname === '/dashboard' && idx === focusedNavIdx;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-0' : ''} ${
                isFocused ? 'border-2 border-white bg-white/10 shadow-lg shadow-white/5 ring-1 ring-white/30' : ''
              }`}
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
      <div className="p-4 border-t border-blue-600/30 flex flex-col gap-2">
        <Link
          to="/profile"
          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 text-blue-100 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="User Profile (Ctrl+Shift+P)"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-sm font-semibold text-white">
            {getInitials(user.nama)}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.nama}</p>
              <p className="text-xs text-blue-300 truncate capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          )}
        </Link>
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-red-500/20 hover:text-red-200 text-blue-200 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Keluar"
        >
          <LogOut size={20} />
          {!isCollapsed && <span className="font-medium text-sm">Keluar</span>}
        </button>
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

          <div className="flex items-center gap-4">
            {/* Quick Status / Shortcuts Help info */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span>Shortcut Global:</span>
              <kbd className="px-1.5 py-0.5 bg-surface-600 border border-surface-700 rounded font-mono text-[10px] text-slate-600">Ctrl+Shift+P</kbd>
              <span>Profil</span>
            </div>

            {/* Profile trigger */}
            <Link
              to="/profile"
              className="flex items-center gap-3 hover:opacity-85 transition-opacity"
            >
              <span className="hidden sm:inline text-sm font-semibold text-slate-800">{user.nama}</span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md border border-primary-400/20">
                {getInitials(user.nama)}
              </div>
            </Link>
          </div>
        </header>

        {/* Content Page wrapper */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 animate-fade-in print:p-0 print:overflow-visible print:bg-white print:text-black">
          {children}
        </main>
      </div>
    </div>
  );
};
