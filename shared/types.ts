/**
 * KaraRoom - Định nghĩa kiểu dữ liệu và Zod Schema dùng chung giữa Client và Server.
 * Định nghĩa một lần duy nhất tại đây để đảm bảo tính nhất quán (Single Source of Truth).
 */

import { z } from "zod";

/** Chế độ chọn người hát trong phòng */
export type SingerSelectionMode = "free" | "random" | "host_assigned";

export const SingerSelectionModeSchema = z.enum(["free", "random", "host_assigned"]);

/** Thông tin của một người tham gia phòng */
export interface User {
  id: string; // UUID định danh người dùng (lưu localStorage)
  nickname: string;
  socketId: string;
  joinedAt: number; // Timestamp lúc vào phòng
  isHost: boolean;
  isOnline: boolean;
  wantToSing: boolean; // Chế độ "Muốn hát" (áp dụng cho chế độ bốc ngẫu nhiên)
  disconnectedAt?: number; // Thời điểm mất kết nối (nếu đang trong thời gian ân hạn)
}

/** Một bài hát trong hàng chờ */
export interface SongItem {
  id: string; // UUID bài trong queue
  videoId: string; // YouTube Video ID
  title: string;
  durationSec: number;
  thumbnail: string;
  addedByUserId: string;
  addedByName: string;
}

/** Trạng thái đếm ngược chuẩn bị 5 giây trước khi phát hoặc tiếp tục bài hát */
export interface CountdownState {
  active: boolean;
  startAtServerMs: number;
  durationSec: number;
  type: "start" | "resume";
}

/** Timeline phát nhạc do server nắm quyền phát ngôn (Server-Authoritative) */
export interface Timeline {
  videoId: string | null;
  positionSec: number;
  serverTimeMs: number;
  playing: boolean;
  countdown?: CountdownState | null;
}

/** Một slot trong hàng hát */
export interface SingerSlot {
  slotIndex: number;
  userId: string | null;
}

/** Cài đặt của phòng karaoke */
export interface RoomSettings {
  maxUsers: number;
  maxSingerSlots: number;
  selectionMode: SingerSelectionMode;
  allowMemberAddSong: boolean;
}

/** Kết quả chấm điểm khi hết bài */
export interface ScoreResult {
  score: number;
  songTitle: string;
  singers: Array<{ userId: string; nickname: string }>;
  announcedAt: number;
  durationSec: number;
}

/** Toàn bộ trạng thái của một phòng */
export interface RoomState {
  code: string;
  createdAt: number;
  hostUserId: string;
  settings: RoomSettings;
  users: Record<string, User>;
  singerSlots: SingerSlot[];
  queue: SongItem[];
  currentSong: SongItem | null;
  timeline: Timeline;
  scoring: ScoreResult | null;
}

// === ZOD SCHEMAS CHO CÁC SỰ KIỆN TỪ CLIENT ===

export const JoinRoomPayloadSchema = z.object({
  roomCode: z.string().trim().min(3).max(10).toUpperCase(),
  userId: z.string().min(1),
  nickname: z.string().trim().min(1).max(30),
});
export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

export const CreateRoomPayloadSchema = z.object({
  userId: z.string().min(1),
  nickname: z.string().trim().min(1).max(30),
});
export type CreateRoomPayload = z.infer<typeof CreateRoomPayloadSchema>;

export const UpdateRoomSettingsPayloadSchema = z.object({
  maxUsers: z.number().int().min(2).max(30).optional(),
  maxSingerSlots: z.number().int().min(1).max(4).optional(),
  selectionMode: SingerSelectionModeSchema.optional(),
  allowMemberAddSong: z.boolean().optional(),
});
export type UpdateRoomSettingsPayload = z.infer<typeof UpdateRoomSettingsPayloadSchema>;

export const AddSongPayloadSchema = z.object({
  videoId: z.string().trim().min(5).max(30),
  title: z.string().trim().min(1).max(200),
  durationSec: z.number().min(0).max(7200),
  thumbnail: z.string().url().or(z.string().length(0)),
});
export type AddSongPayload = z.infer<typeof AddSongPayloadSchema>;

export const RemoveSongPayloadSchema = z.object({
  songId: z.string().min(1),
});
export type RemoveSongPayload = z.infer<typeof RemoveSongPayloadSchema>;

export const ReorderQueuePayloadSchema = z.object({
  newOrderSongIds: z.array(z.string().min(1)),
});
export type ReorderQueuePayload = z.infer<typeof ReorderQueuePayloadSchema>;

export const SkipSongPayloadSchema = z.object({
  reason: z.enum(["user_requested", "playback_error", "unembeddable"]).default("user_requested"),
});
export type SkipSongPayload = z.infer<typeof SkipSongPayloadSchema>;

export const TakeSlotPayloadSchema = z.object({
  slotIndex: z.number().int().min(0).max(3),
});
export type TakeSlotPayload = z.infer<typeof TakeSlotPayloadSchema>;

export const LeaveSlotPayloadSchema = z.object({
  slotIndex: z.number().int().min(0).max(3).optional(),
});
export type LeaveSlotPayload = z.infer<typeof LeaveSlotPayloadSchema>;

export const AssignSingerSlotPayloadSchema = z.object({
  targetUserId: z.string().min(1),
  slotIndex: z.number().int().min(0).max(3),
});
export type AssignSingerSlotPayload = z.infer<typeof AssignSingerSlotPayloadSchema>;

export const EvictFromSlotPayloadSchema = z.object({
  slotIndex: z.number().int().min(0).max(3),
});
export type EvictFromSlotPayload = z.infer<typeof EvictFromSlotPayloadSchema>;

export const SetWantToSingPayloadSchema = z.object({
  wantToSing: z.boolean(),
});
export type SetWantToSingPayload = z.infer<typeof SetWantToSingPayloadSchema>;

export const ReportSingingActivityPayloadSchema = z.object({
  voiceActiveRatio: z.number().min(0).max(1),
});
export type ReportSingingActivityPayload = z.infer<typeof ReportSingingActivityPayloadSchema>;

export const SyncPingPayloadSchema = z.object({
  clientTimeMs: z.number(),
});
export type SyncPingPayload = z.infer<typeof SyncPingPayloadSchema>;

export const SyncPongPayloadSchema = z.object({
  clientTimeMs: z.number(),
  serverTimeMs: z.number(),
});
export type SyncPongPayload = z.infer<typeof SyncPongPayloadSchema>;

// === WebRTC Signaling Schemas ===

export const RtcSignalPayloadSchema = z.object({
  targetUserId: z.string().min(1),
  signal: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("offer"),
      sdp: z.string(),
    }),
    z.object({
      type: z.literal("answer"),
      sdp: z.string(),
    }),
    z.object({
      type: z.literal("candidate"),
      candidate: z.object({
        candidate: z.string(),
        sdpMid: z.string().nullable().optional(),
        sdpMLineIndex: z.number().nullable().optional(),
      }),
    }),
    z.object({
      type: z.literal("request-stream"),
    }),
  ]),
});
export type RtcSignalPayload = z.infer<typeof RtcSignalPayloadSchema>;

export interface RtcSignalRelay {
  fromUserId: string;
  signal: RtcSignalPayload["signal"];
}

export const PlaybackControlPayloadSchema = z.object({}).optional();
export type PlaybackControlPayload = z.infer<typeof PlaybackControlPayloadSchema>;
