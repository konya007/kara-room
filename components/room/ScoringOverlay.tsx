/**
 * KaraRoom - Màn hình công bố điểm số sau khi hết bài (ScoringOverlay).
 * Hiển thị điểm số số lớn cỡ 72px với màu --score, hiệu ứng đếm số chạy lên trong 2.5s,
 * tự động qua bài tiếp theo sau 10 giây. Tôn trọng prefers-reduced-motion.
 */

import React, { useEffect, useState } from "react";
import { Trophy, Sparkles } from "lucide-react";
import { ScoreResult } from "../../shared/types";

interface ScoringOverlayProps {
  scoring: ScoreResult | null;
}

export const ScoringOverlay: React.FC<ScoringOverlayProps> = ({ scoring }) => {
  const [displayScore, setDisplayScore] = useState(0);
  const [remainingSec, setRemainingSec] = useState(10);

  const scoringKey = scoring ? `${scoring.announcedAt}-${scoring.songTitle}-${scoring.score}` : null;

  useEffect(() => {
    if (!scoring) return;

    let animId: number;
    const targetScore = scoring.score;
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      animId = requestAnimationFrame(() => {
        setDisplayScore(targetScore);
      });
    } else {
      const durationMs = 2000;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayScore(Math.round(eased * targetScore));

        if (progress < 1) {
          animId = requestAnimationFrame(animate);
        }
      };

      animId = requestAnimationFrame(animate);
    }

    const calcRemaining = () => {
      const duration = scoring.durationSec || 10;
      const elapsedSec = Math.max(0, (Date.now() - scoring.announcedAt) / 1000);
      return Math.max(0, Math.ceil(duration - elapsedSec));
    };

    setRemainingSec(calcRemaining());

    const interval = setInterval(() => {
      setRemainingSec(calcRemaining());
    }, 1000);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      clearInterval(interval);
    };
  }, [scoringKey]);

  if (!scoring) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-[20px] p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Thanh đếm ngược 10 giây ở đỉnh */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[var(--surface-raised)]">
          <div
            className="h-full bg-[var(--score)] transition-all duration-1000 ease-linear"
            style={{ width: `${(remainingSec / 10) * 100}%` }}
          />
        </div>

        {/* Biểu tượng Cup */}
        <div className="w-20 h-20 rounded-full bg-[var(--surface-raised)] border border-[var(--score)]/40 mx-auto flex items-center justify-center text-[var(--score)]">
          <Trophy className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <span className="text-[13px] font-semibold uppercase tracking-widest text-[var(--score)] flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Kết quả chấm điểm
          </span>
          <h2 className="font-display font-bold text-[20px] text-[var(--text)] line-clamp-1">
            {scoring.songTitle}
          </h2>
          <p className="text-[14px] text-[var(--text-muted)]">
            Ca sĩ: {scoring.singers.map((s) => s.nickname).join(", ")}
          </p>
        </div>

        {/* Điểm số: Unbounded cỡ 72px với font-mono-tabular màu --score */}
        <div className="py-2">
          <div className="text-[72px] font-display font-black leading-none text-[var(--score)] font-mono-tabular">
            {displayScore}
          </div>
          <span className="text-[13px] text-[var(--text-muted)] tracking-wider uppercase font-medium">
            Điểm đánh giá
          </span>
        </div>

        <p className="text-[13px] text-[var(--text-muted)]">
          Tự động qua bài tiếp theo sau{" "}
          <strong className="text-[var(--text)] font-mono-tabular">{remainingSec}s</strong>...
        </p>
      </div>
    </div>
  );
};
