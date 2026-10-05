/**
 * KaraRoom - Màn hình chào và xin quyền tương tác (User Gesture).
 * Trình duyệt hiện đại chặn phát âm thanh tự động (Autoplay Policy),
 * nên người dùng cần bấm "Vào phòng" để kích hoạt AudioContext và YouTube Player.
 */

import React from "react";
import { Mic, Music2, Radio } from "lucide-react";
import { Button } from "../ui/Button";

interface EnterRoomModalProps {
  roomCode: string;
  onEnter: () => void;
}

export const EnterRoomModal: React.FC<EnterRoomModalProps> = ({
  roomCode,
  onEnter,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-[16px] p-6 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[var(--surface-raised)] border border-[var(--border)] mx-auto flex items-center justify-center text-[var(--accent)]">
          <Radio className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="font-display font-bold text-[24px] text-[var(--text)]">
            Phòng #{roomCode}
          </h2>
          <p className="text-[14px] text-[var(--text-muted)] leading-relaxed">
            Chào mừng bạn đến với KaraRoom! Hãy bấm nút bên dưới để mở kết nối âm thanh và đồng bộ bài hát thời gian thực.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 py-2 text-left text-[12px] text-[var(--text-muted)] border-y border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Music2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span>Đồng bộ YouTube 400ms</span>
          </div>
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-[var(--live)] shrink-0" />
            <span>Giọng hát WebRTC Opus</span>
          </div>
        </div>

        <Button
          fullWidth
          variant="primary"
          size="lg"
          onClick={onEnter}
          className="text-[16px]"
        >
          Vào phòng
        </Button>
      </div>
    </div>
  );
};
