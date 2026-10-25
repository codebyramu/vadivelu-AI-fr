import React, { useEffect, useState } from 'react';
import { Check, Info, AlertCircle, Volume2, Sparkles, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error' | 'audio' | 'sparkle';

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastNotificationProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  isDarkTheme: boolean;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  toasts,
  onDismiss,
  isDarkTheme,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none select-none">
      {toasts.map(toast => (
        <ToastPill
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
          isDarkTheme={isDarkTheme}
        />
      ))}
    </div>
  );
};

const ToastPill: React.FC<{
  toast: ToastItem;
  onDismiss: () => void;
  isDarkTheme: boolean;
}> = ({ toast, onDismiss, isDarkTheme }) => {
  const duration = toast.duration || 3200;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  const renderIcon = () => {
    switch (toast.type) {
      case 'success':
        return <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />;
      case 'audio':
        return <Volume2 className="w-3.5 h-3.5 shrink-0 animate-pulse" />;
      case 'sparkle':
        return <Sparkles className="w-3.5 h-3.5 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl border text-xs font-medium backdrop-blur-xl animate-toast transition-all ${
        isDarkTheme
          ? 'bg-neutral-900/90 text-white border-neutral-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)]'
          : 'bg-white/95 text-black border-neutral-200 shadow-[0_10px_30px_rgba(0,0,0,0.12)]'
      }`}
    >
      <div className="flex items-center justify-center">{renderIcon()}</div>
      <span className="tracking-tight">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="ml-1 p-0.5 rounded-full opacity-60 hover:opacity-100 transition"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Subtle bottom progress line */}
      <div
        className="absolute bottom-0 left-0 h-[1.5px] bg-current opacity-20 transition-all duration-75"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
