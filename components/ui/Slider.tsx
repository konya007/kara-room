/**
 * KaraRoom - Thanh trượt (Slider) điều chỉnh âm thanh.
 * Hỗ trợ hiển thị nhãn, giá trị đơn vị, và kiểu dáng tối màu tinh tế.
 */

import React from "react";
import { cn } from "../../lib/utils";

export interface SliderProps {
  label?: string;
  valueDisplay?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  valueDisplay,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  className,
}) => {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className={cn("w-full space-y-1.5 select-none", disabled && "opacity-40 pointer-events-none", className)}>
      {(label || valueDisplay) && (
        <div className="flex justify-between items-center text-[12px]">
          {label && <span className="text-[var(--text-muted)] font-medium">{label}</span>}
          {valueDisplay && (
            <span className="font-mono-tabular text-[var(--text)] font-semibold text-[12px]">
              {valueDisplay}
            </span>
          )}
        </div>
      )}
      <div className="relative flex items-center h-6">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-[var(--surface-raised)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)] focus:outline-none"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percentage}%, var(--surface-raised) ${percentage}%, var(--surface-raised) 100%)`,
          }}
        />
      </div>
    </div>
  );
};
