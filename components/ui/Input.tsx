/**
 * KaraRoom - Ô nhập liệu (Input).
 * Bo góc 8px, viền 1px --border, focus-visible với viền sáng rõ.
 */

import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightElement, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[var(--text-muted)] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={cn(
              "w-full h-[44px] min-h-[44px] bg-[var(--surface)] text-[var(--text)] text-[14px] rounded-[8px] border border-[var(--border)] px-3.5",
              "placeholder:text-[var(--text-muted)] transition-all duration-150 ease-out",
              "hover:border-[var(--text-muted)]",
              "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              leftIcon ? "pl-10" : "",
              rightElement ? "pr-12" : "",
              error ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]" : "",
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-2 flex items-center">{rightElement}</div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-[12px] text-[var(--danger)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
