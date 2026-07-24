import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SoCreatedEvent {
  action: 'create';
  id: string;
  no_order: string;
  customer_nama: string;
  subtotal: number;
  created_by_name: string;
  timestamp: string;
}

interface SoUpdatedEvent {
  action: 'update' | 'complete' | 'delete';
  id: string;
  no_order: string;
  customer_nama: string;
  timestamp: string;
}

interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  time: string;
}

interface RealtimeContextType {
  isConnected: boolean;
  onSoChanged: (callback: (data?: any) => void) => () => void;
  notifications: NotificationToast[];
  removeNotification: (id: string) => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  onSoChanged: () => () => { },
  notifications: [],
  removeNotification: () => { },
});

export const RealtimeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);
  const [soListeners, setSoListeners] = useState<Set<(data?: any) => void>>(new Set());

  useEffect(() => {
    // Determine socket connection URL (dynamically adapt to host IP for LAN access)
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const socketUrl = host === 'localhost' || host === '127.0.0.1'
      ? `${protocol}//${host}:3001`
      : `${protocol}//${host}:3001`;

    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Connected to Realtime WebSocket server:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('⚡ Disconnected from Realtime WebSocket server');
      setIsConnected(false);
    });

    socketInstance.on('so_created', (data: any) => {
      console.log('⚡ Received so_created event:', data);

      const username = data.created_by_username || data.created_by_name || 'admin';

      // Add notification toast for SO Creation
      const newNotif: NotificationToast = {
        id: Date.now().toString(),
        title: ' Sales Order (SO) Baru!',
        message: `${username} baru membuat SO ${data.no_order} untuk ${data.customer_nama}`,
        type: 'success',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };

      setNotifications((prev) => [newNotif, ...prev].slice(0, 5));

      // Trigger all registered SO listeners to auto-update tables
      soListeners.forEach((cb) => cb(data));
    });

    socketInstance.on('so_updated', (data: SoUpdatedEvent) => {
      console.log('⚡ Received so_updated event:', data);

      let notifTitle = '📋 Update Sales Order';
      let notifMsg = `SO No. ${data.no_order} (${data.customer_nama}) telah diperbarui.`;
      let type: 'info' | 'success' | 'warning' = 'info';

      if (data.action === 'complete') {
        notifTitle = '✅ Sales Order Selesai';
        notifMsg = `SO No. ${data.no_order} (${data.customer_nama}) telah diselesaikan.`;
        type = 'success';
      } else if (data.action === 'delete') {
        notifTitle = '⚠️ Sales Order Dibatalkan';
        notifMsg = `SO No. ${data.no_order} (${data.customer_nama}) telah dibatalkan.`;
        type = 'warning';
      }

      const newNotif: NotificationToast = {
        id: Date.now().toString(),
        title: notifTitle,
        message: notifMsg,
        type,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };

      setNotifications((prev) => [newNotif, ...prev].slice(0, 5));

      // Trigger all registered SO listeners
      soListeners.forEach((cb) => cb(data));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const onSoChanged = (callback: (data?: any) => void) => {
    setSoListeners((prev) => {
      const next = new Set(prev);
      next.add(callback);
      return next;
    });

    return () => {
      setSoListeners((prev) => {
        const next = new Set(prev);
        next.delete(callback);
        return next;
      });
    };
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        onSoChanged,
        notifications,
        removeNotification,
      }}
    >
      {children}
      {/* Toast Notification Container for Multi-Computer Sync */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-stretch p-3.5 rounded-xl shadow-2xl border backdrop-blur-md transition-all transform translate-y-0 bg-slate-950/95 ${
              n.type === 'success'
                ? 'border-emerald-500/40 shadow-emerald-950/40 ring-1 ring-emerald-500/20'
                : n.type === 'warning'
                ? 'border-amber-500/40 shadow-amber-950/40 ring-1 ring-amber-500/20'
                : 'border-blue-500/40 shadow-blue-950/40 ring-1 ring-blue-500/20'
            }`}
          >
            {/* Left Glowing Accent Bar */}
            <div
              className={`w-1.5 rounded-full mr-3 shrink-0 ${
                n.type === 'success'
                  ? 'bg-gradient-to-b from-emerald-400 to-green-600 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                  : n.type === 'warning'
                  ? 'bg-gradient-to-b from-amber-400 to-yellow-600 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : 'bg-gradient-to-b from-blue-400 to-indigo-600 shadow-[0_0_8px_rgba(96,165,250,0.6)]'
              }`}
            />

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-xs tracking-wide bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent uppercase">
                  {n.title}
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                  {n.time}
                </span>
              </div>
              <p className="text-xs text-slate-100 font-medium leading-relaxed">
                {n.message}
              </p>
            </div>

            <button
              onClick={() => removeNotification(n.id)}
              className="ml-2 self-start text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-colors text-xs"
              title="Tutup Notifikasi"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);
