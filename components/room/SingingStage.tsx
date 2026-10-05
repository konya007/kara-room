/**
 * KaraRoom - Sân khấu hàng hát (SingingStage).
 * Hiển thị các slot hát (1-4 slot), avatar với vòng sáng --live nhịp theo âm lượng mic,
 * nút Lên hát / Xuống / Mời xuống, và các nút điều khiển mic nhanh.
 */

import React from "react";
import { Mic, MicOff, Sliders, Headphones, UserMinus, Plus, Volume2 } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Badge } from "../ui/Badge";
import { RoomState } from "../../shared/types";

interface SingingStageProps {
  roomState: RoomState;
  currentUserId: string;
  isMicActive: boolean;
  isMonitorActive: boolean;
  localVolumeLevel: number;
  vocalVolume?: number;
  onUpdateVocalVolume?: (vol: number) => void;
  onTakeSlot: (slotIndex: number) => void;
  onLeaveSlot: (slotIndex?: number) => void;
  onEvictSlot: (slotIndex: number) => void;
  onToggleMic: () => void;
  onToggleMonitor: () => void;
  onOpenVoicePanel: () => void;
}

export const SingingStage: React.FC<SingingStageProps> = ({
  roomState,
  currentUserId,
  isMicActive,
  isMonitorActive,
  localVolumeLevel,
  vocalVolume,
  onUpdateVocalVolume,
  onTakeSlot,
  onLeaveSlot,
  onEvictSlot,
  onToggleMic,
  onToggleMonitor,
  onOpenVoicePanel,
}) => {
  const currentUser = roomState.users[currentUserId];
  const isHost = Boolean(currentUser?.isHost);
  const mySlot = roomState.singerSlots.find((s) => s.userId === currentUserId);
  const isUserSinging = Boolean(mySlot);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] p-4 space-y-4">
      {/* Tiêu đề khu vực hát & Nút chỉnh giọng */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-[16px] text-[var(--text)]">
            Hàng hát
          </span>
          <Badge variant={roomState.settings.selectionMode === "free" ? "live" : "muted"}>
            {roomState.settings.selectionMode === "free"
              ? "Tự do"
              : roomState.settings.selectionMode === "random"
              ? "Bốc ngẫu nhiên"
              : "Chỉ định"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Chỉnh nhanh âm lượng giọng hát phòng */}
          {onUpdateVocalVolume && vocalVolume !== undefined && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--border)] text-[12px]"
              title={`Âm lượng giọng ca sĩ: ${Math.round(vocalVolume * 100)}%`}
            >
              <Volume2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Giọng:</span>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={vocalVolume}
                onChange={(e) => onUpdateVocalVolume(parseFloat(e.target.value))}
                className="w-16 h-1 accent-[var(--accent)] bg-white/20 rounded cursor-pointer"
              />
              <span className="text-[11px] font-mono-tabular text-[var(--text)] w-7 text-right">
                {Math.round(vocalVolume * 100)}%
              </span>
            </div>
          )}

          {/* Nút bật/tắt Monitor (Nghe giọng bản thân) */}
          {isUserSinging && (
            <IconButton
              label={isMonitorActive ? "Tắt nghe giọng bản thân" : "Bật nghe giọng bản thân"}
              variant={isMonitorActive ? "live" : "secondary"}
              size="sm"
              onClick={onToggleMonitor}
            >
              <Headphones className="w-4 h-4" />
            </IconButton>
          )}

          {/* Nút bật/tắt Mic */}
          {isUserSinging && (
            <IconButton
              label={isMicActive ? "Tắt Mic" : "Bật Mic"}
              variant={isMicActive ? "live" : "danger"}
              size="sm"
              onClick={onToggleMic}
            >
              {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </IconButton>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenVoicePanel}
            className="text-[12px] h-[36px]"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Chỉnh giọng</span>
          </Button>
        </div>
      </div>

      {/* Danh sách các Slot hát */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {roomState.singerSlots.map((slot) => {
          const singerUser = slot.userId ? roomState.users[slot.userId] : null;
          const isMe = slot.userId === currentUserId;

          if (singerUser) {
            const isLocal = isMe;
            const volume = isLocal ? localVolumeLevel : 0.4;

            return (
              <div
                key={slot.slotIndex}
                className="relative bg-[var(--surface-raised)] border border-[var(--border)] rounded-[12px] p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Avatar
                    name={singerUser.nickname}
                    size="md"
                    isLive={true}
                    volumeLevel={volume}
                  />
                  <div className="truncate">
                    <p className="font-semibold text-[14px] text-[var(--text)] truncate">
                      {singerUser.nickname} {isMe ? "(Bạn)" : ""}
                    </p>
                    <span className="text-[12px] text-[var(--live)] font-mono-tabular">
                      Đang hát
                    </span>
                  </div>
                </div>

                {/* Hành động: Người hát tự xuống hoặc Host mời xuống */}
                <div className="shrink-0 flex items-center gap-1">
                  {isMe ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLeaveSlot(slot.slotIndex)}
                      className="text-[12px] h-8 px-2.5 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                    >
                      Xuống
                    </Button>
                  ) : isHost ? (
                    <IconButton
                      label="Mời người này xuống"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEvictSlot(slot.slotIndex)}
                      className="hover:text-[var(--danger)] h-8 w-8 min-h-8 min-w-8"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </IconButton>
                  ) : null}
                </div>
              </div>
            );
          }

          // Slot trống
          return (
            <div
              key={slot.slotIndex}
              className="border border-dashed border-[var(--border)] rounded-[12px] p-3 flex items-center justify-between gap-2 bg-[var(--surface)]/50"
            >
              <div className="flex items-center gap-2 text-[var(--text-muted)] text-[13px]">
                <div className="w-9 h-9 rounded-full border border-dashed border-[var(--border)] flex items-center justify-center text-[12px] font-mono-tabular">
                  #{slot.slotIndex + 1}
                </div>
                <span>Slot trống</span>
              </div>

              {roomState.settings.selectionMode === "free" && !isUserSinging ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onTakeSlot(slot.slotIndex)}
                  className="h-8 px-3 text-[12px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Lên hát</span>
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
