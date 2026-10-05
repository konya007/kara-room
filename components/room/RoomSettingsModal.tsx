/**
 * KaraRoom - Hộp thoại cài đặt phòng (Dành riêng cho Host).
 * Cho phép tuỳ biến số người, số slot hát, chế độ chọn ca sĩ, và quyền thêm bài.
 */

import React, { useState } from "react";
import { Drawer } from "../ui/Drawer";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { RoomSettings, SingerSelectionMode } from "../../shared/types";

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettings;
  onSave: (patch: Partial<RoomSettings>) => void;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [maxUsers, setMaxUsers] = useState(settings.maxUsers);
  const [maxSingerSlots, setMaxSingerSlots] = useState(settings.maxSingerSlots);
  const [selectionMode, setSelectionMode] = useState<SingerSelectionMode>(settings.selectionMode);
  const [allowMemberAddSong, setAllowMemberAddSong] = useState(settings.allowMemberAddSong);

  const handleSave = () => {
    onSave({
      maxUsers,
      maxSingerSlots,
      selectionMode,
      allowMemberAddSong,
    });
    onClose();
  };

  const modeOptions: Array<{ mode: SingerSelectionMode; title: string; desc: string }> = [
    { mode: "free", title: "Tự do", desc: "Bất kỳ ai cũng có thể bấm vào slot trống để lên hát." },
    { mode: "random", title: "Ngẫu nhiên", desc: "Server tự bốc ngẫu nhiên từ những ai bật 'Muốn hát' mỗi khi qua bài mới." },
    { mode: "host_assigned", title: "Chỉ định", desc: "Chỉ có trưởng phòng mới có quyền xếp vị trí hát." },
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Cài đặt phòng Karaoke">
      <div className="space-y-6 text-[14px]">
        {/* Số người tối đa */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text)] font-medium">Số người tối đa trong phòng</span>
            <span className="font-mono-tabular font-bold text-[var(--accent)]">{maxUsers} người</span>
          </div>
          <input
            type="range"
            min={2}
            max={24}
            value={maxUsers}
            onChange={(e) => setMaxUsers(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-[var(--surface-raised)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
          />
        </div>

        {/* Số slot hát */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text)] font-medium">Số slot hát đồng thời</span>
            <span className="font-mono-tabular font-bold text-[var(--live)]">{maxSingerSlots} slot</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((slots) => (
              <button
                key={slots}
                type="button"
                onClick={() => setMaxSingerSlots(slots)}
                className={`h-11 rounded-[8px] border font-mono-tabular font-bold text-[14px] transition-all cursor-pointer ${
                  maxSingerSlots === slots
                    ? "bg-[var(--surface-raised)] border-[var(--live)] text-[var(--live)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                }`}
              >
                {slots}
              </button>
            ))}
          </div>
        </div>

        {/* Chế độ chọn người hát */}
        <div className="space-y-2">
          <span className="text-[var(--text)] font-medium">Chế độ phân slot hát</span>
          <div className="space-y-2">
            {modeOptions.map((opt) => (
              <div
                key={opt.mode}
                onClick={() => setSelectionMode(opt.mode)}
                className={`p-3 rounded-[8px] border cursor-pointer transition-all ${
                  selectionMode === opt.mode
                    ? "bg-[var(--surface-raised)] border-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--text-muted)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text)]">{opt.title}</span>
                  {selectionMode === opt.mode && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">{opt.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cho phép thành viên thêm bài */}
        <div className="pt-2 border-t border-[var(--border)]">
          <Toggle
            checked={allowMemberAddSong}
            onChange={setAllowMemberAddSong}
            label="Cho phép thành viên thêm bài"
            description="Nếu tắt, chỉ có trưởng phòng mới được tìm và thêm bài vào hàng chờ."
          />
        </div>

        <Button fullWidth variant="primary" size="lg" onClick={handleSave}>
          Lưu thay đổi
        </Button>
      </div>
    </Drawer>
  );
};
