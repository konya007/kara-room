/**
 * KaraRoom - Khung bao (Panel).
 * Bo góc chuẩn 16px, nền --surface hoặc --surface-raised, viền 1px --border.
 * Phân tầng bằng độ sâu màu, không dùng đổ bóng đen.
 */

import React from "react";
import { cn } from "../../lib/utils";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  className,
  raised = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-[var(--border)] p-4 transition-colors duration-150",
        raised ? "bg-[var(--surface-raised)]" : "bg-[var(--surface)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
