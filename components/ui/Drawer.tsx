/**
 * KaraRoom - Ngăn kéo nội dung (Drawer / Modal).
 * Trượt từ dưới lên trên mobile hoặc hộp thoại trên desktop, chuyển động 250ms.
 */

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { IconButton } from "./IconButton";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Lớp nền mờ tối */}
      <div
        className="fixed inset-0 bg-black/75 transition-opacity duration-250 ease-out"
        onClick={onClose}
      />

      {/* Thân Drawer */}
      <div
        className={cn(
          "relative z-10 w-full sm:max-w-lg bg-[var(--surface)] border border-[var(--border)]",
          "rounded-t-[20px] sm:rounded-[16px] max-h-[90vh] flex flex-col overflow-hidden",
          "animate-in slide-in-from-bottom duration-250 ease-out",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          {title ? (
            <h3 className="font-display font-bold text-[18px] text-[var(--text)] tracking-wide">
              {title}
            </h3>
          ) : <div />}
          <IconButton label="Đóng" variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--text)]" />
          </IconButton>
        </div>

        {/* Nội dung cuộn được */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-70px)]">
          {children}
        </div>
      </div>
    </div>
  );
};
