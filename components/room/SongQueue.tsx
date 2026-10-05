/**
 * KaraRoom - Danh sách hàng chờ bài hát (SongQueue).
 * Kéo thả đổi thứ tự bài (dnd-kit), thêm bài mới, xoá bài và bỏ qua bài đang phát.
 */

import React, { useState } from "react";
import { Plus, SkipForward, Trash2, GripVertical, Music, Disc3 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RoomState, SongItem } from "../../shared/types";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Badge } from "../ui/Badge";
import { SongSearchModal } from "./SongSearchModal";

interface SongQueueProps {
  roomState: RoomState;
  currentUserId: string;
  onAddSong: (song: { videoId: string; title: string; durationSec: number; thumbnail: string }) => void;
  onRemoveSong: (songId: string) => void;
  onReorderQueue: (newOrderIds: string[]) => void;
  onSkipSong: () => void;
}

interface SortableItemProps {
  song: SongItem;
  canDelete: boolean;
  canReorder: boolean;
  onDelete: (id: string) => void;
}

const SortableSongRow: React.FC<SortableItemProps> = ({
  song,
  canDelete,
  canReorder,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.id,
    disabled: !canReorder,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-2.5 rounded-[10px] bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-between gap-2.5 transition-colors"
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        {canReorder && (
          <button
            type="button"
            aria-label="Kéo thả đổi thứ tự"
            {...attributes}
            {...listeners}
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 cursor-grab active:cursor-grabbing shrink-0"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        <div className="w-12 h-8 rounded-[4px] bg-black overflow-hidden shrink-0">
          <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
        </div>

        <div className="truncate flex-1">
          <p className="text-[13px] font-medium text-[var(--text)] truncate">{song.title}</p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">
            Thêm bởi: <span className="text-[var(--text)]">{song.addedByName}</span>
          </p>
        </div>
      </div>

      {canDelete && (
        <IconButton
          label="Xoá bài"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(song.id)}
          className="hover:text-[var(--danger)] h-8 w-8 min-h-8 min-w-8 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </IconButton>
      )}
    </div>
  );
};

export const SongQueue: React.FC<SongQueueProps> = ({
  roomState,
  currentUserId,
  onAddSong,
  onRemoveSong,
  onReorderQueue,
  onSkipSong,
}) => {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const currentUser = roomState.users[currentUserId];
  const isHost = Boolean(currentUser?.isHost);
  const canAdd = roomState.settings.allowMemberAddSong || isHost;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = roomState.queue.findIndex((s) => s.id === active.id);
      const newIndex = roomState.queue.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(roomState.queue, oldIndex, newIndex);
      onReorderQueue(reordered.map((s) => s.id));
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] p-4 flex flex-col h-full space-y-4">
      {/* Header và nút Thêm bài */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <span className="font-display font-bold text-[16px] text-[var(--text)]">
          Hàng chờ ({roomState.queue.length})
        </span>

        {canAdd && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSearchModalOpen(true)}
            className="text-[12px] h-8 px-2.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm bài</span>
          </Button>
        )}
      </div>

      {/* Bài đang phát hiện tại */}
      {roomState.currentSong && (
        <div className="p-3 rounded-[12px] bg-[var(--surface-raised)] border border-[var(--accent)]/50 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="accent" className="text-[11px] gap-1">
              <Disc3 className="w-3 h-3 animate-spin" /> Đang phát
            </Badge>

            {isHost && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkipSong}
                className="text-[12px] h-7 px-2 hover:text-[var(--accent)]"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Bỏ qua</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-14 h-9 rounded-[4px] bg-black overflow-hidden shrink-0">
              <img
                src={roomState.currentSong.thumbnail}
                alt={roomState.currentSong.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="truncate flex-1">
              <p className="text-[13px] font-semibold text-[var(--text)] truncate">
                {roomState.currentSong.title}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                Thêm bởi: {roomState.currentSong.addedByName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Danh sách bài chờ */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {roomState.queue.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4 space-y-2 text-[var(--text-muted)]">
            <Music className="w-8 h-8 opacity-40" />
            <p className="text-[13px] leading-relaxed">
              Chưa có bài nào. Tìm một bài để bắt đầu.
            </p>
            {canAdd && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSearchModalOpen(true)}
                className="text-[12px] mt-1"
              >
                Tìm bài hát ngay
              </Button>
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={roomState.queue.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {roomState.queue.map((song) => {
                const canDelete = isHost || song.addedByUserId === currentUserId;
                return (
                  <SortableSongRow
                    key={song.id}
                    song={song}
                    canDelete={canDelete}
                    canReorder={isHost}
                    onDelete={onRemoveSong}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Modal tìm bài */}
      <SongSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onAddSong={onAddSong}
      />
    </div>
  );
};
