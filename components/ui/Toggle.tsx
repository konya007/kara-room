/**
 * KaraRoom - Công tắc bật/tắt (Toggle Switch).
 * Bo tròn chuẩn, chuyển động 150ms ease-out, hỗ trợ phím bấm accessible.
 */

import React from "react";
import { cn } from "../../lib/utils";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}) => {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 cursor-pointer select-none py-1",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
        className
      )}
    >
      {(label || description) && (
        <div className="flex flex-col text-left">
          {label && <span className="text-[14px] text-[var(--text)] font-medium">{label}</span>}
          {description && (
            <span className="text-[12px] text-[var(--text-muted)] leading-tight mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-[var(--border)] transition-colors duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          checked ? "bg-[var(--accent)] border-transparent" : "bg-[var(--surface-raised)]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition duration-150 ease-out shadow-sm",
            checked ? "translate-x-6 bg-[var(--bg)]" : "translate-x-1 bg-[var(--text-muted)]"
          )}
        />
      </button>
    </label>
  );
};
