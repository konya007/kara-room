/**
 * KaraRoom - Huy hiệu (Badge) thông tin.
 * Dùng cho nhãn Trưởng phòng, Đang hát, Muốn hát, v.v.
 */

import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "live" | "score" | "danger" | "muted";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  className,
}) => {
  const variantStyles = {
    default: "bg-[var(--surface-raised)] text-[var(--text)] border-[var(--border)]",
    accent: "bg-[var(--accent)] text-[var(--bg)] font-bold border-transparent",
    live: "bg-[var(--live)] text-[var(--bg)] font-bold border-transparent",
    score: "bg-[var(--score)] text-[var(--bg)] font-bold border-transparent",
    danger: "bg-[var(--danger)] text-[var(--bg)] font-bold border-transparent",
    muted: "bg-transparent text-[var(--text-muted)] border-[var(--border)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[12px] font-medium border leading-none select-none",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
