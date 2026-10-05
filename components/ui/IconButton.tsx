/**
 * KaraRoom - Nút biểu tượng (IconButton).
 * Đảm bảo kích thước tối thiểu 44x44px cho cảm ứng điện thoại.
 */

import React from "react";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "live";
  size?: "sm" | "md" | "lg";
  label: string; // Bắt buộc aria-label để đảm bảo accessibility
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      className,
      variant = "ghost",
      size = "md",
      label,
      disabled = false,
      type = "button",
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      primary: "bg-[var(--accent)] text-[var(--bg)] hover:brightness-110",
      secondary: "bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--text-muted)]",
      ghost: "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)]",
      danger: "bg-[var(--danger)] text-[var(--bg)] hover:brightness-110",
      live: "bg-[var(--live)] text-[var(--bg)] hover:brightness-110",
    };

    const sizeStyles = {
      sm: "w-[36px] h-[36px] min-w-[36px] min-h-[36px] p-1.5",
      md: "w-[44px] h-[44px] min-w-[44px] min-h-[44px] p-2.5",
      lg: "w-[48px] h-[48px] min-w-[48px] min-h-[48px] p-3",
    };

    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-[8px] transition-all duration-150 ease-out select-none cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
