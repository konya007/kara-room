/**
 * KaraRoom - Danh sách thành viên và Hàng nghe (AudienceList).
 * Hiển thị danh sách người trong phòng, trạng thái online, cờ 'Muốn hát',
 * và các tác vụ phân quyền của Trưởng phòng.
 */

import React from "react";
import { Crown, Mic, UserCheck } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { RoomState, User } from "../../shared/types";

interface AudienceListProps {
  roomState: RoomState;
  currentUserId: string;
  onToggleWantToSing: (want: boolean) => void;
  onAssignToSlot?: (targetUserId: string, slotIndex: number) => void;
}

export const AudienceList: React.FC<AudienceListProps> = ({
  roomState,
  currentUserId,
  onToggleWantToSing,
  onAssignToSlot,
}) => {
  const users = Object.values(roomState.users);
  const currentUser = roomState.users[currentUserId];
  const isHost = Boolean(currentUser?.isHost);

  // Tập hợp ID những người đang hát
  const singerUserIds = new Set(
    roomState.singerSlots.map((s) => s.userId).filter(Boolean)
  );

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] p-4 flex flex-col h-full space-y-4">
      {/* Header hàng nghe */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-[16px] text-[var(--text)]">
            Thành viên ({users.length})
          </span>
        </div>

        {/* Nút bật 'Muốn hát' khi ở chế độ ngẫu nhiên */}
        {roomState.settings.selectionMode === "random" && currentUser && (
          <Button
            variant={currentUser.wantToSing ? "primary" : "secondary"}
            size="sm"
            onClick={() => onToggleWantToSing(!currentUser.wantToSing)}
            className="text-[12px] h-8 px-2.5"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{currentUser.wantToSing ? "Đã bật Muốn hát" : "Muốn hát"}</span>
          </Button>
        )}
      </div>

      {/* Danh sách người dùng cuộn */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {users.map((u: User) => {
          const isMe = u.id === currentUserId;
          const isSinging = singerUserIds.has(u.id);

          return (
            <div
              key={u.id}
              className={`p-2.5 rounded-[10px] border transition-colors flex items-center justify-between gap-2 ${
                isMe
                  ? "bg-[var(--surface-raised)] border-[var(--border)]"
                  : "bg-[var(--surface)] border-[var(--border)]/50 hover:border-[var(--border)]"
              } ${!u.isOnline ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={u.nickname} size="sm" isLive={isSinging} />
                <div className="truncate">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[13px] font-medium text-[var(--text)] truncate">
                      {u.nickname}
                    </span>
                    {isMe && (
                      <span className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                        (Bạn)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {u.isHost && (
                      <Badge variant="accent" className="text-[10px] py-0 px-1.5">
                        <Crown className="w-2.5 h-2.5" /> Host
                      </Badge>
                    )}
                    {isSinging && (
                      <Badge variant="live" className="text-[10px] py-0 px-1.5">
                        Đang hát
                      </Badge>
                    )}
                    {!isSinging && u.wantToSing && (
                      <Badge variant="score" className="text-[10px] py-0 px-1.5">
                        Muốn hát
                      </Badge>
                    )}
                    {!u.isOnline && (
                      <Badge variant="danger" className="text-[10px] py-0 px-1.5">
                        Mất kết nối
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Tác vụ của Trưởng phòng: xếp vào slot nếu slot trống */}
              {isHost && !isSinging && u.isOnline && onAssignToSlot && (
                <div className="shrink-0 flex items-center gap-1">
                  {roomState.singerSlots.map((slot) => {
                    if (slot.userId) return null;
                    return (
                      <button
                        key={slot.slotIndex}
                        type="button"
                        onClick={() => onAssignToSlot(u.id, slot.slotIndex)}
                        title={`Xếp vào Slot ${slot.slotIndex + 1}`}
                        className="px-2 py-1 text-[11px] font-mono-tabular font-bold bg-[var(--surface-raised)] border border-[var(--border)] rounded-[6px] hover:border-[var(--live)] hover:text-[var(--live)] transition-colors cursor-pointer"
                      >
                        +S{slot.slotIndex + 1}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
