/**
 * KaraRoom - Xử lý các sự kiện Socket.IO đến từ Client.
 * Mọi payload đều được xác thực nghiêm ngặt bằng Zod Schema trước khi đưa vào RoomManager.
 */

import { Server, Socket } from "socket.io";
import { SOCKET_EVENTS } from "../shared/events";
import {
  AddSongPayloadSchema,
  AssignSingerSlotPayloadSchema,
  CreateRoomPayloadSchema,
  EvictFromSlotPayloadSchema,
  JoinRoomPayloadSchema,
  LeaveSlotPayloadSchema,
  RemoveSongPayloadSchema,
  ReorderQueuePayloadSchema,
  ReportSingingActivityPayloadSchema,
  RtcSignalPayloadSchema,
  RtcSignalRelay,
  SkipSongPayloadSchema,
  SyncPingPayloadSchema,
  TakeSlotPayloadSchema,
  UpdateRoomSettingsPayloadSchema,
} from "../shared/types";
import { RoomManager } from "./room-manager";

export function registerSocketHandlers(io: Server, roomManager: RoomManager) {
  // Khi roomManager phát hiện state thay đổi, bắn broadcast cho toàn phòng
  roomManager.setListener((roomCode, state) => {
    io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE, state);
  });

  io.on("connection", (socket: Socket) => {
    // 1. Tạo phòng mới
    socket.on(SOCKET_EVENTS.ROOM_CREATE, (data: unknown) => {
      const parsed = CreateRoomPayloadSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: "Dữ liệu tạo phòng không hợp lệ." });
        return;
      }

      // Tạo mã phòng 6 ký tự ngẫu nhiên (chữ in hoa và số)
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const state = roomManager.createRoom(code, {
        id: parsed.data.userId,
        nickname: parsed.data.nickname,
        socketId: socket.id,
      });

      socket.join(code);
      socket.emit(SOCKET_EVENTS.ROOM_STATE, state);
    });

    // 2. Vào phòng
    socket.on(SOCKET_EVENTS.ROOM_JOIN, (data: unknown) => {
      const parsed = JoinRoomPayloadSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: "Mã phòng hoặc thông tin không hợp lệ." });
        return;
      }

      const { roomCode, userId, nickname } = parsed.data;
      const res = roomManager.joinRoom(roomCode, {
        id: userId,
        nickname,
        socketId: socket.id,
      });

      if (res.error || !res.state) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error || "Không thể vào phòng." });
        return;
      }

      socket.join(roomCode);
      socket.emit(SOCKET_EVENTS.ROOM_STATE, res.state);
    });

    // 3. Thoát phòng thủ công
    socket.on(SOCKET_EVENTS.ROOM_LEAVE, () => {
      roomManager.handleSocketDisconnect(socket.id);
    });

    // 4. Đồng bộ đồng hồ NTP
    socket.on(SOCKET_EVENTS.SYNC_PING, (data: unknown) => {
      const parsed = SyncPingPayloadSchema.safeParse(data);
      if (!parsed.success) return;

      socket.emit(SOCKET_EVENTS.SYNC_PONG, {
        clientTimeMs: parsed.data.clientTimeMs,
        serverTimeMs: Date.now(),
      });
    });

    // 5. Cập nhật cài đặt phòng
    socket.on(SOCKET_EVENTS.ROOM_SETTINGS_UPDATE, (data: unknown) => {
      const parsed = UpdateRoomSettingsPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!parsed.success || !room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      const res = roomManager.updateSettings(room.code, user.id, parsed.data);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 6. Thêm bài hát vào hàng chờ
    socket.on(SOCKET_EVENTS.QUEUE_ADD, (data: unknown) => {
      const parsed = AddSongPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!parsed.success || !room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      const res = roomManager.addSong(room.code, user.id, parsed.data);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 7. Xoá bài hát khỏi hàng chờ
    socket.on(SOCKET_EVENTS.QUEUE_REMOVE, (data: unknown) => {
      const parsed = RemoveSongPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!parsed.success || !room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      const res = roomManager.removeSong(room.code, user.id, parsed.data.songId);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 8. Đổi thứ tự hàng chờ
    socket.on(SOCKET_EVENTS.QUEUE_REORDER, (data: unknown) => {
      const parsed = ReorderQueuePayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!parsed.success || !room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      const res = roomManager.reorderQueue(room.code, user.id, parsed.data.newOrderSongIds);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 9. Bỏ qua bài đang phát
    socket.on(SOCKET_EVENTS.SONG_SKIP, (data: unknown) => {
      const parsed = SkipSongPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      const reason = parsed.success ? parsed.data.reason : "user_requested";
      const res = roomManager.skipSong(room.code, user.id, reason);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 9b. Tạm dừng phát nhạc (Pause)
    socket.on(SOCKET_EVENTS.PLAYBACK_PAUSE, () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;
      const res = roomManager.pausePlayback(room.code, user.id);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 9c. Tiếp tục phát nhạc (Resume)
    socket.on(SOCKET_EVENTS.PLAYBACK_RESUME, () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;
      const res = roomManager.resumePlayback(room.code, user.id);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 10. Bài hát kết thúc tự nhiên
    socket.on(SOCKET_EVENTS.SONG_ENDED, () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !room.currentSong) return;
      roomManager.advanceSong(room.code);
    });

    // 11. Báo cáo mức độ hát để tính điểm
    socket.on(SOCKET_EVENTS.SCORE_REPORT_ACTIVITY, (data: unknown) => {
      const parsed = ReportSingingActivityPayloadSchema.safeParse(data);
      if (!parsed.success) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      roomManager.advanceSong(room.code, parsed.data.voiceActiveRatio);
    });

    // 12. Slot: lên slot hát
    socket.on(SOCKET_EVENTS.SLOT_TAKE, (data: unknown) => {
      const parsed = TakeSlotPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!parsed.success || !room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      const res = roomManager.takeSlot(room.code, user.id, parsed.data.slotIndex);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 13. Slot: xuống slot hát
    socket.on(SOCKET_EVENTS.SLOT_LEAVE, (data: unknown) => {
      const parsed = LeaveSlotPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      roomManager.leaveSlot(room.code, user.id, parsed.success ? parsed.data.slotIndex : undefined);
    });

    // 14. Slot: Host chỉ định slot
    socket.on(SOCKET_EVENTS.SLOT_ASSIGN, (data: unknown) => {
      const parsed = AssignSingerSlotPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!parsed.success || !room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      const res = roomManager.assignSlot(
        room.code,
        user.id,
        parsed.data.targetUserId,
        parsed.data.slotIndex
      );
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 15. Slot: Host mời xuống
    socket.on(SOCKET_EVENTS.SLOT_EVICT, (data: unknown) => {
      const parsed = EvictFromSlotPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!parsed.success || !room) return;

      const user = Object.values(room.users).find((u) => u.socketId === socket.id);
      if (!user) return;

      const res = roomManager.evictSlot(room.code, user.id, parsed.data.slotIndex);
      if (res.error) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: res.error });
      }
    });

    // 16. WebRTC Signaling: chuyển tiếp offer/answer/candidate đến đích
    socket.on(SOCKET_EVENTS.RTC_SIGNAL, (data: unknown) => {
      const parsed = RtcSignalPayloadSchema.safeParse(data);
      const room = roomManager.getRoomBySocket(socket.id);
      if (!parsed.success || !room) return;

      const sender = Object.values(room.users).find((u) => u.socketId === socket.id);
      const recipient = room.users[parsed.data.targetUserId];
      if (!sender || !recipient || !recipient.socketId) return;

      const relay: RtcSignalRelay = {
        fromUserId: sender.id,
        signal: parsed.data.signal,
      };

      io.to(recipient.socketId).emit(SOCKET_EVENTS.RTC_SIGNAL, relay);
    });

    // 17. Ngắt kết nối socket
    socket.on("disconnect", () => {
      roomManager.handleSocketDisconnect(socket.id);
    });
  });
}
