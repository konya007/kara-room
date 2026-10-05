/**
 * KaraRoom - Nút bấm (Button) dùng chung.
 * Variants: primary (--accent), secondary (--surface-raised), ghost, danger (--danger).
 * Đầy đủ trạng thái: hover, focus-visible, disabled, loading. Vùng chạm tối thiểu 44px.
 */

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = "secondary",
      size = "md",
      loading = false,
      disabled = false,
      fullWidth = false,
      type = "button",
      ...props
    },
    ref
  ) => {
    // Quy tắc: chữ trên nền --accent, --danger có màu tương phản rõ
    const variantStyles = {
      primary:
        "bg-[var(--accent)] text-[var(--bg)] font-semibold hover:brightness-110 active:brightness-95 border-transparent shadow-none",
      secondary:
        "bg-[var(--surface-raised)] text-[var(--text)] hover:border-[var(--text-muted)] border border-[var(--border)] active:brightness-90",
      ghost:
        "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)] border-transparent",
      danger:
        "bg-[var(--danger)] text-[var(--bg)] font-semibold hover:brightness-110 active:brightness-95 border-transparent",
    };

    const sizeStyles = {
      sm: "h-[36px] min-h-[36px] px-3 text-[12px] gap-1.5",
      md: "h-[44px] min-h-[44px] px-4 text-[14px] gap-2",
      lg: "h-[48px] min-h-[48px] px-6 text-[16px] gap-2.5 font-medium",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-[8px] transition-all duration-150 ease-out select-none cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth ? "w-full" : "",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
