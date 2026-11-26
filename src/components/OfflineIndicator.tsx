import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-3 left-3 sm:left-auto sm:right-4 z-[90] flex items-center justify-center sm:justify-start gap-2 rounded-2xl bg-amber-600/95 backdrop-blur-md border border-amber-400/50 px-4 py-2.5 text-xs font-bold text-white shadow-xl">
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
      <span>الوضع بدون إنترنت — تعمل النسخة الاحتياطية المحلية والمصحف المحفوظ بنجاح</span>
    </div>
  );
};
