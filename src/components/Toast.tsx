import { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export default function Toast({ id, type, title, message, duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
    error: <XCircle className="h-5 w-5 text-red-400" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-400" />,
    info: <Info className="h-5 w-5 text-blue-400" />,
  };

  const styles = {
    success: 'bg-emerald-900/90 border-emerald-400/30',
    error: 'bg-red-900/90 border-red-400/30',
    warning: 'bg-amber-900/90 border-amber-400/30',
    info: 'bg-blue-900/90 border-blue-400/30',
  };

  return (
    <div
      className={`
        ${styles[type]}
        relative w-full max-w-sm rounded-lg border backdrop-blur-sm
        shadow-lg p-4 mb-3 animate-slide-in-right
        transition-all duration-300 ease-out
      `}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-cream-100">{title}</p>
          {message && (
            <p className="mt-1 text-xs text-cream-300/80 leading-relaxed">{message}</p>
          )}
        </div>
        <button
          onClick={() => onClose(id)}
          className="flex-shrink-0 text-cream-300 hover:text-cream-100 transition-colors"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
