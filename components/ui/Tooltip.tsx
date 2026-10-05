/**
 * KaraRoom - Chú thích gợi ý (Tooltip).
 * Xuất hiện mượt khi rê chuột qua phần tử cha.
 */

import React, { useState } from "react";
import { cn } from "../../lib/utils";

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  className,
}) => {
  const [visible, setVisible] = useState(false);

  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 px-2.5 py-1 text-[12px] text-[var(--text)] bg-[var(--surface-raised)]",
            "border border-[var(--border)] rounded-[6px] whitespace-nowrap pointer-events-none",
            "transition-opacity duration-150 ease-out shadow-sm",
            positionStyles[position]
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};
