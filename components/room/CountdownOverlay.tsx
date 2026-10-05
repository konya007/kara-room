"use client";

/**
 * KaraRoom - Màn hình đếm ngược 5 giây (CountdownOverlay) trước khi phát hoặc tiếp tục bài hát.
 * Đồng bộ chính xác theo mốc đồng hồ NTP server, hiển thị hiệu ứng trực quan sinh động.
 */

import React, { useEffect, useState } from "react";
import { Mic, Play } from "lucide-react";
import { CountdownState } from "../../shared/types";
import { getClockSync } from "../../lib/socket";

interface CountdownOverlayProps {
  countdown: CountdownState | null;
  songTitle?: string;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ countdown, songTitle }) => {
  const [remainingSec, setRemainingSec] = useState<number>(() => {
    if (!countdown) return 0;
    const elapsed = (getClockSync().nowServerTime() - countdown.startAtServerMs) / 1000;
    return Math.max(0, Math.ceil(countdown.durationSec - elapsed));
  });

  useEffect(() => {
    if (!countdown || !countdown.active) return;

    const interval = setInterval(() => {
      const clock = getClockSync();
      const elapsed = (clock.nowServerTime() - countdown.startAtServerMs) / 1000;
      const left = Math.max(0, Math.ceil(countdown.durationSec - elapsed));
      setRemainingSec(left);
    }, 80);

    return () => clearInterval(interval);
  }, [countdown]);

  if (!countdown || !countdown.active) {
    return null;
  }

  const isResume = countdown.type === "resume";
  const progressPercent = Math.min(
    100,
    Math.max(0, ((countdown.durationSec - remainingSec) / countdown.durationSec) * 100)
  );

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-30 select-none animate-in fade-in duration-200">
      {/* Vòng tròn đếm ngược trung tâm */}
      <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
        {/* SVG Progress Ring */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="5"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="var(--accent, #FF3D81)"
            strokeWidth="6"
            strokeDasharray={264}
            strokeDashoffset={264 - (264 * progressPercent) / 100}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-150 ease-linear"
          />
        </svg>

        {/* Số đếm ở giữa */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {remainingSec > 0 ? (
            <span
              key={remainingSec}
              className="font-display font-black text-[54px] sm:text-[68px] text-white tracking-tight drop-shadow-[0_0_24px_rgba(255,61,129,0.8)] animate-in zoom-in-75 duration-200"
            >
              {remainingSec}
            </span>
          ) : (
            <div className="flex flex-col items-center animate-in zoom-in-90 duration-150">
              <Mic className="w-10 h-10 text-[var(--accent)] animate-bounce" />
              <span className="font-display font-bold text-[18px] sm:text-[22px] text-white mt-1">
                HÁT NÀO!
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Thông tin bài hát & Lời nhắc */}
      <div className="mt-5 text-center px-4 max-w-md space-y-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-raised)]/90 border border-[var(--border)] text-[12px] text-[var(--accent)] font-semibold">
          {isResume ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Tiếp tục bài hát sau {remainingSec}s</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Bắt đầu bài hát sau {remainingSec}s</span>
            </>
          )}
        </div>

        {songTitle && (
          <h4 className="font-display text-[15px] sm:text-[17px] font-bold text-white truncate">
            {songTitle}
          </h4>
        )}

        <p className="text-[13px] text-white/70">
          {isResume
            ? "Mọi người sẵn sàng, nhạc sẽ phát tiếp ngay bây giờ!"
            : "Chuẩn bị tư thế và bật micro để khoe giọng hát nào! 🎶"}
        </p>
      </div>
    </div>
  );
};
