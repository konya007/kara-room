/**
 * KaraRoom - Bảng gỡ lỗi đồng bộ âm thanh và mạng (Debug Panel).
 * Kích hoạt khi URL có tham số ?debug=1.
 * Hiển thị: Độ lệch NTP clock, RTT, Độ trôi player (ms), Độ trễ ước lượng & bù của WebRTC, ICE state.
 */

import React, { useEffect, useState } from "react";
import { Activity, X, ChevronDown, ChevronUp } from "lucide-react";
import { getClockSync } from "../../lib/socket";
import { PeerLatencyStats } from "../../lib/rtc/transport";

interface DebugPanelProps {
  playerDriftMs: number;
  peerStats: PeerLatencyStats[];
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  playerDriftMs,
  peerStats,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [rttMs, setRttMs] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const clock = getClockSync();
      setClockOffsetMs(Math.round(clock.getOffsetMs()));
      setRttMs(Math.round(clock.getRttMs()));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-[var(--surface)]/95 border border-[var(--border)] rounded-[12px] p-3 text-[12px] font-mono-tabular shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold text-[var(--accent)]">
          <Activity className="w-3.5 h-3.5" />
          <span>HUD Debug Đồng Bộ (?debug=1)</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-[var(--text-muted)] hover:text-[var(--text)] p-0.5 cursor-pointer"
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {/* Đồng hồ & Socket */}
          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-[var(--border)]/50">
            <div>
              <span className="text-[var(--text-muted)]">NTP Offset:</span>
              <p className="font-semibold text-[var(--text)]">{clockOffsetMs > 0 ? `+${clockOffsetMs}` : clockOffsetMs} ms</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Socket RTT:</span>
              <p className="font-semibold text-[var(--text)]">{rttMs} ms</p>
            </div>
          </div>

          {/* Độ trôi Player */}
          <div className="pb-2 border-b border-[var(--border)]/50">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Độ trôi Player:</span>
              <span
                className={`font-bold ${
                  Math.abs(playerDriftMs) > 100
                    ? "text-[var(--danger)]"
                    : Math.abs(playerDriftMs) > 40
                    ? "text-[var(--score)]"
                    : "text-[var(--live)]"
                }`}
              >
                {playerDriftMs > 0 ? `+${playerDriftMs}` : playerDriftMs} ms
              </span>
            </div>
          </div>

          {/* Thống kê WebRTC từng luồng giọng */}
          <div>
            <span className="text-[var(--text-muted)] block mb-1">Luồng WebRTC ({peerStats.length}):</span>
            {peerStats.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] italic">Chưa có kết nối giọng P2P</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {peerStats.map((p) => (
                  <div key={p.userId} className="p-1.5 bg-[var(--surface-raised)] rounded-[6px] text-[11px] space-y-0.5">
                    <div className="flex justify-between font-semibold">
                      <span className="truncate w-24">Peer: {p.userId.slice(-6)}</span>
                      <span className="text-[var(--live)]">{p.iceState}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>RTT: {p.rttMs}ms | Jitter: {p.jitterBufferMs}ms</span>
                    </div>
                    <div className="flex justify-between text-[var(--text)]">
                      <span>Trễ ước lượng: <strong>{p.estimatedLatencyMs}ms</strong></span>
                      <span>Bù trễ: <strong>{p.compensationDelayMs}ms</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
