/**
 * KaraRoom - Thanh đầu trang của phòng (Header).
 * Hiển thị mã phòng (Unbounded font), nút sao chép mã/link, số người tham gia và cài đặt.
 */

import React, { useState } from "react";
import { Copy, Check, Users, Settings, LogOut } from "lucide-react";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Badge } from "../ui/Badge";
import { RoomState } from "../../shared/types";

interface RoomHeaderProps {
  roomState: RoomState;
  currentUserId: string;
  onOpenSettings: () => void;
  onLeaveRoom: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomState,
  currentUserId,
  onOpenSettings,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentUser = roomState.users[currentUserId];
  const isHost = Boolean(currentUser?.isHost);
  const onlineCount = Object.values(roomState.users).filter((u) => u.isOnline).length;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomState.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/?room=${roomState.code}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  return (
    <header className="h-[60px] border-b border-[var(--border)] bg-[var(--surface)] px-4 flex items-center justify-between shrink-0">
      {/* Khối bên trái: Tên ứng dụng và Mã phòng */}
      <div className="flex items-center gap-3">
        <span className="font-display font-black text-[18px] text-[var(--text)] tracking-wider">
          Kara<span className="text-[var(--accent)]">Room</span>
        </span>

        <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />

        <div className="flex items-center gap-1.5 bg-[var(--surface-raised)] border border-[var(--border)] px-2.5 py-1 rounded-[8px]">
          <span className="text-[12px] text-[var(--text-muted)] font-medium">Phòng:</span>
          <span className="font-mono-tabular font-bold text-[14px] text-[var(--text)] tracking-widest">
            {roomState.code}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Sao chép mã phòng"
            title="Sao chép mã phòng"
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 transition-colors cursor-pointer"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-[var(--live)]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Khối bên phải: Nút sao chép link, Số người, Cài đặt, Rời phòng */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyLink}
          className="hidden md:inline-flex"
        >
          {copiedLink ? <Check className="w-4 h-4 text-[var(--live)]" /> : <Copy className="w-4 h-4" />}
          <span>{copiedLink ? "Đã chép link" : "Mời bạn bè"}</span>
        </Button>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--surface-raised)] rounded-[8px] border border-[var(--border)] text-[12px]">
          <Users className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="font-mono-tabular text-[var(--text)] font-semibold">
            {onlineCount}/{roomState.settings.maxUsers}
          </span>
        </div>

        {isHost && (
          <IconButton
            label="Cài đặt phòng"
            variant="secondary"
            size="md"
            onClick={onOpenSettings}
          >
            <Settings className="w-4 h-4 text-[var(--text)]" />
          </IconButton>
        )}

        <IconButton
          label="Rời phòng"
          variant="ghost"
          size="md"
          onClick={onLeaveRoom}
          className="hover:text-[var(--danger)]"
        >
          <LogOut className="w-4 h-4" />
        </IconButton>
      </div>
    </header>
  );
};
