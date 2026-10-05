/**
 * KaraRoom - Giao diện trang chủ (HomeView).
 * Nhập biệt danh, tạo phòng mới hoặc vào phòng bằng mã 6 ký tự.
 */

import React, { useState } from "react";
import Link from "next/link";
import { Mic, Music, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";

interface HomeViewProps {
  nickname: string;
  onChangeNickname: (val: string) => void;
  roomCodeInput: string;
  onChangeRoomCode: (val: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const HomeView: React.FC<HomeViewProps> = ({
  nickname,
  onChangeNickname,
  roomCodeInput,
  onChangeRoomCode,
  onCreateRoom,
  onJoinRoom,
  isLoading,
  errorMessage,
}) => {
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const validateNickname = (): boolean => {
    if (!nickname.trim()) {
      setNicknameError("Vui lòng nhập biệt danh để tiếp tục.");
      return false;
    }
    setNicknameError(null);
    return true;
  };

  const handleCreate = () => {
    if (validateNickname()) {
      onCreateRoom();
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateNickname()) {
      onJoinRoom();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Navbar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)]">
            <Mic className="w-5 h-5" />
          </div>
          <span className="font-display font-black text-[20px] tracking-wider text-[var(--text)]">
            Kara<span className="text-[var(--accent)]">Room</span>
          </span>
        </div>
        <Link
          href="/styleguide"
          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors underline"
        >
          Design System (/styleguide)
        </Link>
      </header>

      {/* Hero & Card trung tâm */}
      <main className="max-w-md w-full mx-auto my-auto space-y-6 py-6">
        <div className="text-center space-y-2">
          <Badge variant="live" className="mb-1">
            Độ trễ thấp • Khớp nhịp 400ms
          </Badge>
          <h1 className="font-display font-extrabold text-[28px] sm:text-[36px] tracking-tight leading-tight">
            Hát Karaoke Online Khớp Nhạc
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] leading-relaxed">
            Phòng hát thời gian thực cho nhóm bạn. Nhạc YouTube và giọng hát truyền riêng nhưng hòa quyện tại tai nghe từng người.
          </p>
        </div>

        <Panel className="p-6 space-y-5 bg-[var(--surface)] border border-[var(--border)] shadow-xl">
          {/* Nhập Biệt Danh */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-[var(--text)]">
              Biệt danh của bạn
            </label>
            <Input
              value={nickname}
              onChange={(e) => {
                onChangeNickname(e.target.value);
                if (nicknameError) setNicknameError(null);
              }}
              placeholder="VD: Tuấn Hát Hay, Mai Ly..."
              error={nicknameError || undefined}
              maxLength={25}
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-[var(--danger)]/15 border border-[var(--danger)]/40 rounded-[8px] text-[13px] text-[var(--danger)] font-medium">
              {errorMessage}
            </div>
          )}

          {/* Nút Tạo phòng mới */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            onClick={handleCreate}
            className="text-[15px] font-bold"
          >
            Tạo phòng mới ngay
          </Button>

          {/* Hoặc Vào bằng mã */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <span className="relative bg-[var(--surface)] px-3 text-[12px] text-[var(--text-muted)] uppercase tracking-wider">
              Hoặc nhập mã phòng
            </span>
          </div>

          <form onSubmit={handleJoin} className="flex gap-2">
            <Input
              value={roomCodeInput}
              onChange={(e) => onChangeRoomCode(e.target.value.toUpperCase())}
              placeholder="MÃ 6 KÝ TỰ"
              maxLength={10}
              className="font-mono-tabular font-bold tracking-widest uppercase text-center"
            />
            <Button
              type="submit"
              variant="secondary"
              loading={isLoading}
              className="shrink-0 font-semibold"
            >
              Vào phòng <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        </Panel>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 gap-3 text-[12px] text-[var(--text-muted)]">
          <div className="flex items-center gap-2 p-2.5 rounded-[8px] bg-[var(--surface)]/50 border border-[var(--border)]">
            <Zap className="w-4 h-4 text-[var(--live)] shrink-0" />
            <span>Đồng hồ NTP bù trôi</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-[8px] bg-[var(--surface)]/50 border border-[var(--border)]">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span>WebRTC P2P mã hóa Opus</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[12px] text-[var(--text-muted)]">
        KaraRoom © 2026 • Máy chủ phòng hát riêng • Tối đa 12 người/phòng
      </footer>
    </div>
  );
};
