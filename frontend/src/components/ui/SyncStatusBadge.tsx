import React from 'react';
import { useRealtime } from '@/context/RealtimeContext';
import { Wifi, WifiOff } from 'lucide-react';

export const SyncStatusBadge: React.FC = () => {
  const { isConnected } = useRealtime();

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
        isConnected
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse'
      }`}
      title={
        isConnected
          ? 'Sinkronisasi Otomatis Multi-Komputer Aktif'
          : 'Menghubungkan ke Server Sinkronisasi...'
      }
    >
      {isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-700">Sync Aktif</span>
        </>
      ) : (
        <>
          <WifiOff size={12} className="text-amber-500" />
          <span className="font-semibold text-amber-700">Connecting...</span>
        </>
      )}
    </div>
  );
};
