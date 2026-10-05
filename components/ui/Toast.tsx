/**
 * KaraRoom - Thông báo nổi (Toast).
 * Tự động biến mất sau 3 giây hoặc người dùng tắt thủ công.
 */

import React, { useEffect } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ToastProps {
  id?: string;
  type?: "success" | "error" | "warning" | "info";
  message: string;
  onClose: () => void;
  durationMs?: number;
}

export const Toast: React.FC<ToastProps> = ({
  type = "info",
  message,
  onClose,
  durationMs = 3500,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[var(--live)] shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-[var(--danger)] shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-[var(--score)] shrink-0" />,
    info: <Info className="w-5 h-5 text-[var(--accent)] shrink-0" />,
  };

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 px-4 py-3 bg-[var(--surface-raised)] border border-[var(--border)]",
        "rounded-[8px] text-[14px] text-[var(--text)] transition-all duration-200 ease-out shadow-lg",
        "pointer-events-auto max-w-sm w-full"
      )}
    >
      {icons[type]}
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng thông báo"
        className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
