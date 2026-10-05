/**
 * KaraRoom - Ảnh đại diện (Avatar).
 * Bo tròn hoàn toàn, tạo màu nền độc nhất từ tên người dùng.
 * Vòng sáng --live nhịp theo mức âm lượng mic khi đang hát.
 */

import React from "react";
import { cn } from "../../lib/utils";

export interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  isLive?: boolean;
  volumeLevel?: number; // 0.0 - 1.0
  className?: string;
}

// Bảng màu nền avatar tương phản với text sáng
const AVATAR_BG_COLORS = [
  "#2C3E50",
  "#8E44AD",
  "#2980B9",
  "#D35400",
  "#16A085",
  "#27AE60",
  "#C0392B",
  "#7F8C8D",
];

function getInitialAndColor(name: string): { initials: string; bgColor: string } {
  const trimmed = name.trim();
  const initials = trimmed ? trimmed.slice(0, 2).toUpperCase() : "?";
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash) % AVATAR_BG_COLORS.length;
  return { initials, bgColor: AVATAR_BG_COLORS[colorIndex] };
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = "md",
  isLive = false,
  volumeLevel = 0,
  className,
}) => {
  const { initials, bgColor } = getInitialAndColor(name);

  const sizeStyles = {
    sm: "w-8 h-8 text-[12px]",
    md: "w-10 h-10 text-[14px]",
    lg: "w-14 h-14 text-[18px]",
    xl: "w-20 h-20 text-[24px]",
  };

  // Cường độ phát sáng theo mức âm mic (0.0 đến 1.0)
  const glowSpread = isLive ? Math.round(2 + volumeLevel * 14) : 0;
  const glowStyle = isLive
    ? {
        boxShadow: `0 0 ${glowSpread}px var(--live), inset 0 0 2px var(--live)`,
        borderColor: "var(--live)",
      }
    : undefined;

  return (
    <div
      style={{
        backgroundColor: bgColor,
        ...glowStyle,
      }}
      className={cn(
        "rounded-full flex items-center justify-center font-display font-bold text-white shrink-0 select-none border border-[var(--border)] transition-all duration-75",
        sizeStyles[size],
        isLive ? "border-[var(--live)]" : "",
        className
      )}
    >
      <span>{initials}</span>
    </div>
  );
};
