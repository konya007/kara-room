/**
 * KaraRoom - Quản lý trạng thái các phòng trong bộ nhớ RAM và Snapshot đĩa.
 * Lưu trữ trong Map<string, RoomState>, snapshot ra .data/rooms.json mỗi 30s
 * và nạp lại khi khởi động lại tiến trình server.
 */

import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config";
import { RoomState } from "../shared/types";
import {
  createRoom as pureCreateRoom,
  handleUserDisconnect,
  joinRoom as pureJoinRoom,
  purgeDisconnectedUser,
} from "./room-logic";
import {
  addSong as pureAddSong,
  advanceSongOnEnded,
  assignSingerSlot as pureAssignSlot,
  evictSingerSlot as pureEvictSlot,
  finishScoring as pureFinishScoring,
  finishPlaybackCountdown as pureFinishCountdown,
  leaveSingerSlot as pureLeaveSlot,
  pausePlayback as purePausePlayback,
  removeSong as pureRemoveSong,
  reorderQueue as pureReorderQueue,
  resumePlayback as pureResumePlayback,
  setWantToSing as pureSetWantToSing,
  skipSong as pureSkipSong,
  takeSingerSlot as pureTakeSlot,
  updateSettings as pureUpdateSettings,
} from "./song-logic";

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private emptyRoomTimers: Map<string, NodeJS.Timeout> = new Map();
  private countdownTimers: Map<string, NodeJS.Timeout> = new Map();
  private snapshotTimer: NodeJS.Timeout | null = null;
  private onStateChanged?: (roomCode: string, state: RoomState) => void;

  constructor(onStateChanged?: (roomCode: string, state: RoomState) => void) {
    this.onStateChanged = onStateChanged;
    this.loadSnapshot();
    this.startSnapshotTimer();
    this.setupProcessExitHandlers();
  }

  public setListener(listener: (roomCode: string, state: RoomState) => void) {
    this.onStateChanged = listener;
  }

  public getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public getRoomBySocket(socketId: string): RoomState | undefined {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  public createRoom(
    code: string,
    host: { id: string; nickname: string; socketId: string }
  ): RoomState {
    const upperCode = code.toUpperCase();
    const state = pureCreateRoom(upperCode, host);
    this.rooms.set(upperCode, state);
    this.socketToRoom.set(host.socketId, upperCode);
    this.clearEmptyTimer(upperCode);
    this.emitChange(upperCode);
    return state;
  }

  public joinRoom(
    code: string,
    user: { id: string; nickname: string; socketId: string }
  ): { state?: RoomState; error?: string } {
    const upperCode = code.toUpperCase();
    const current = this.rooms.get(upperCode);
    if (!current) {
      return { error: "Phòng không tồn tại." };
    }

    // Huỷ hẹn giờ xoá user nếu đang trong thời gian ân hạn
    const timerKey = `${upperCode}:${user.id}`;
    const timer = this.disconnectTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(timerKey);
    }

    const { state: nextState, error } = pureJoinRoom(current, user);
    if (error) {
      return { error };
    }

    this.rooms.set(upperCode, nextState);
    this.socketToRoom.set(user.socketId, upperCode);
    this.clearEmptyTimer(upperCode);
    this.emitChange(upperCode);
    return { state: nextState };
  }

  public handleSocketDisconnect(socketId: string) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return;

    this.socketToRoom.delete(socketId);
    const current = this.rooms.get(roomCode);
    if (!current) return;

    const { state: nextState, disconnectedUserId } = handleUserDisconnect(
      current,
      socketId
    );
    this.rooms.set(roomCode, nextState);
    this.emitChange(roomCode);

    if (disconnectedUserId) {
      // Bắt đầu ân hạn 30 giây giữ chỗ và quyền host
      const timerKey = `${roomCode}:${disconnectedUserId}`;
      const timer = setTimeout(() => {
        this.disconnectTimers.delete(timerKey);
        const room = this.rooms.get(roomCode);
        if (room) {
          const purged = purgeDisconnectedUser(room, disconnectedUserId);
          this.rooms.set(roomCode, purged);
          this.emitChange(roomCode);
          this.checkEmptyRoom(roomCode);
        }
      }, CONFIG.RECONNECT_GRACE_PERIOD_MS);

      this.disconnectTimers.set(timerKey, timer);
    }

    this.checkEmptyRoom(roomCode);
  }

  public updateSettings(
    code: string,
    userId: string,
    patch: Parameters<typeof pureUpdateSettings>[2]
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureUpdateSettings(room, userId, patch);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public addSong(
    code: string,
    userId: string,
    songData: { videoId: string; title: string; durationSec: number; thumbnail: string }
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureAddSong(room, userId, songData);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.checkAndScheduleCountdown(code, res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public removeSong(
    code: string,
    userId: string,
    songId: string
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureRemoveSong(room, userId, songId);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public reorderQueue(
    code: string,
    userId: string,
    newOrder: string[]
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureReorderQueue(room, userId, newOrder);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public skipSong(
    code: string,
    userId: string,
    reason: string
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureSkipSong(room, userId, reason);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.checkAndScheduleCountdown(code, res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public advanceSong(
    code: string,
    voiceActivityRatio: number = 0.5
  ): { state?: RoomState; scoringStarted: boolean } {
    const room = this.getRoom(code);
    if (!room) return { scoringStarted: false };
    const { state: nextState, scoringStarted } = advanceSongOnEnded(
      room,
      voiceActivityRatio
    );
    this.rooms.set(code.toUpperCase(), nextState);
    this.emitChange(code);

    // Nếu bắt đầu chấm điểm, tự động chuyển bài sau SCORE_ANNOUNCE_DURATION_SEC (10s)
    if (scoringStarted) {
      setTimeout(() => {
        this.finishScoring(code);
      }, CONFIG.SCORE_ANNOUNCE_DURATION_SEC * 1000);
    }

    return { state: nextState, scoringStarted };
  }

  public finishScoring(code: string) {
    const room = this.getRoom(code);
    if (!room || !room.scoring) return;
    const nextState = pureFinishScoring(room);
    this.rooms.set(code.toUpperCase(), nextState);
    this.checkAndScheduleCountdown(code, nextState);
    this.emitChange(code);
  }

  public takeSlot(
    code: string,
    userId: string,
    slotIndex: number
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureTakeSlot(room, userId, slotIndex);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public leaveSlot(
    code: string,
    userId: string,
    slotIndex?: number
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureLeaveSlot(room, userId, slotIndex);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public assignSlot(
    code: string,
    requesterId: string,
    targetId: string,
    slotIndex: number
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureAssignSlot(room, requesterId, targetId, slotIndex);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public evictSlot(
    code: string,
    requesterId: string,
    slotIndex: number
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureEvictSlot(room, requesterId, slotIndex);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public setWantToSing(
    code: string,
    userId: string,
    want: boolean
  ): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureSetWantToSing(room, userId, want);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  private emitChange(roomCode: string) {
    const state = this.rooms.get(roomCode.toUpperCase());
    if (state && this.onStateChanged) {
      this.onStateChanged(roomCode.toUpperCase(), state);
    }
  }

  // === ĐIỀU KHIỂN PLAY / PAUSE & COUNTDOWN 5S ===

  public pausePlayback(code: string, userId: string): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = purePausePlayback(room, userId);
    if (res.error) return { error: res.error };
    this.clearCountdownTimer(code);
    this.rooms.set(code.toUpperCase(), res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  public resumePlayback(code: string, userId: string): { state?: RoomState; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { error: "Phòng không tồn tại." };
    const res = pureResumePlayback(room, userId);
    if (res.error) return { error: res.error };
    this.rooms.set(code.toUpperCase(), res.state);
    this.checkAndScheduleCountdown(code, res.state);
    this.emitChange(code);
    return { state: res.state };
  }

  private checkAndScheduleCountdown(code: string, state: RoomState) {
    const upperCode = code.toUpperCase();
    this.clearCountdownTimer(upperCode);

    if (state.timeline.countdown?.active) {
      const durationMs = (state.timeline.countdown.durationSec || 5) * 1000;
      const timer = setTimeout(() => {
        this.finishCountdown(upperCode);
      }, durationMs);

      this.countdownTimers.set(upperCode, timer);
    }
  }

  public clearCountdownTimer(code: string) {
    const upperCode = code.toUpperCase();
    const timer = this.countdownTimers.get(upperCode);
    if (timer) {
      clearTimeout(timer);
      this.countdownTimers.delete(upperCode);
    }
  }

  public finishCountdown(code: string) {
    const upperCode = code.toUpperCase();
    this.clearCountdownTimer(upperCode);
    const room = this.getRoom(upperCode);
    if (!room || !room.timeline.countdown?.active) return;

    const nextState = pureFinishCountdown(room);
    this.rooms.set(upperCode, nextState);
    this.emitChange(upperCode);
  }

  private checkEmptyRoom(code: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;

    const onlineCount = Object.values(room.users).filter((u) => u.isOnline).length;
    if (onlineCount === 0 && !this.emptyRoomTimers.has(code.toUpperCase())) {
      // Hẹn giờ xoá phòng sau 10 phút trống
      const timer = setTimeout(() => {
        this.clearCountdownTimer(code);
        this.rooms.delete(code.toUpperCase());
        this.emptyRoomTimers.delete(code.toUpperCase());
      }, CONFIG.ROOM_EMPTY_TIMEOUT_MS);
      this.emptyRoomTimers.set(code.toUpperCase(), timer);
    }
  }

  private clearEmptyTimer(code: string) {
    const timer = this.emptyRoomTimers.get(code.toUpperCase());
    if (timer) {
      clearTimeout(timer);
      this.emptyRoomTimers.delete(code.toUpperCase());
    }
  }

  // === SNAPSHOT PERSISTENCE ===

  public saveSnapshot() {
    try {
      const dataDir = path.dirname(CONFIG.ROOM_SNAPSHOT_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const serializableRooms: Record<string, RoomState> = {};
      for (const [code, state] of this.rooms.entries()) {
        serializableRooms[code] = state;
      }

      fs.writeFileSync(
        CONFIG.ROOM_SNAPSHOT_FILE_PATH,
        JSON.stringify(serializableRooms, null, 2),
        "utf8"
      );
    } catch (err) {
      console.error("[RoomManager] Lỗi khi lưu snapshot:", err);
    }
  }

  private loadSnapshot() {
    try {
      if (fs.existsSync(CONFIG.ROOM_SNAPSHOT_FILE_PATH)) {
        const raw = fs.readFileSync(CONFIG.ROOM_SNAPSHOT_FILE_PATH, "utf8").trim();
        if (!raw) return;
        const loaded: Record<string, RoomState> = JSON.parse(raw);
        for (const [code, state] of Object.entries(loaded)) {
          // Đặt trạng thái online thành false khi khởi động lại server
          const resetUsers: Record<string, (typeof state.users)[string]> = {};
          for (const [uid, user] of Object.entries(state.users)) {
            resetUsers[uid] = { ...user, isOnline: false, socketId: "" };
          }
          this.rooms.set(code.toUpperCase(), {
            ...state,
            users: resetUsers,
          });
        }
      }
    } catch (err) {
      console.error("[RoomManager] Không thể nạp snapshot cũ:", err);
    }
  }

  private startSnapshotTimer() {
    this.snapshotTimer = setInterval(() => {
      this.saveSnapshot();
    }, CONFIG.ROOM_SNAPSHOT_INTERVAL_MS);
  }

  private setupProcessExitHandlers() {
    const handleExit = () => {
      this.saveSnapshot();
    };

    process.once("SIGTERM", handleExit);
    process.once("SIGINT", handleExit);
  }
}
