/**
 * KaraRoom - Logic nghiệp vụ phòng karaoke dưới dạng các hàm thuần túy (Pure Functions).
 * Các hàm nhận vào RoomState hiện tại và trả về RoomState mới, không phụ thuộc vào Socket.IO hay IO.
 * Điều này cho phép viết Unit Test dễ dàng và đảm bảo Server là nguồn sự thật duy nhất.
 */

import { CONFIG } from "../config";
import {
  RoomSettings,
  RoomState,
  SingerSlot,
  SongItem,
  User,
} from "../shared/types";

/** Tạo một phòng mới với các giá trị mặc định */
export function createRoom(
  code: string,
  host: { id: string; nickname: string; socketId: string },
  nowMs: number = Date.now()
): RoomState {
  const hostUser: User = {
    id: host.id,
    nickname: host.nickname,
    socketId: host.socketId,
    joinedAt: nowMs,
    isHost: true,
    isOnline: true,
    wantToSing: false,
  };

  const settings: RoomSettings = {
    maxUsers: CONFIG.DEFAULT_MAX_USERS,
    maxSingerSlots: CONFIG.DEFAULT_MAX_SINGERS,
    selectionMode: "free",
    allowMemberAddSong: true,
  };

  const singerSlots: SingerSlot[] = Array.from(
    { length: settings.maxSingerSlots },
    (_, idx) => ({
      slotIndex: idx,
      userId: null,
    })
  );

  return {
    code: code.toUpperCase(),
    createdAt: nowMs,
    hostUserId: host.id,
    settings,
    users: { [host.id]: hostUser },
    singerSlots,
    queue: [],
    currentSong: null,
    timeline: {
      videoId: null,
      positionSec: 0,
      serverTimeMs: nowMs,
      playing: false,
    },
    scoring: null,
  };
}

/** Tham gia hoặc kết nối lại vào phòng */
export function joinRoom(
  state: RoomState,
  user: { id: string; nickname: string; socketId: string },
  nowMs: number = Date.now()
): { state: RoomState; error?: string } {
  const userCount = Object.values(state.users).filter((u) => u.isOnline).length;
  const existingUser = state.users[user.id];

  // Người mới vào nhưng phòng đã đầy
  if (!existingUser && userCount >= state.settings.maxUsers) {
    return { state, error: "Phòng đã đủ số người tối đa." };
  }

  const updatedUsers = { ...state.users };

  if (existingUser) {
    // Kết nối lại (Reconnect) trong thời gian ân hạn hoặc đổi socketId
    updatedUsers[user.id] = {
      ...existingUser,
      nickname: user.nickname,
      socketId: user.socketId,
      isOnline: true,
      disconnectedAt: undefined,
    };
  } else {
    // Người dùng mới hoàn toàn
    updatedUsers[user.id] = {
      id: user.id,
      nickname: user.nickname,
      socketId: user.socketId,
      joinedAt: nowMs,
      isHost: Object.keys(updatedUsers).length === 0, // Nếu phòng chưa có ai thì làm host
      isOnline: true,
      wantToSing: false,
    };
  }

  // Đảm bảo hostUserId hợp lệ
  let hostUserId = state.hostUserId;
  if (!updatedUsers[hostUserId] || !updatedUsers[hostUserId].isOnline) {
    const earliestUser = findEarliestOnlineUser(updatedUsers);
    if (earliestUser) {
      hostUserId = earliestUser.id;
      updatedUsers[hostUserId] = { ...earliestUser, isHost: true };
    }
  }

  return {
    state: {
      ...state,
      hostUserId,
      users: updatedUsers,
    },
  };
}

/** Xử lý khi socket bị ngắt kết nối (bắt đầu thời gian ân hạn) */
export function handleUserDisconnect(
  state: RoomState,
  socketId: string,
  nowMs: number = Date.now()
): { state: RoomState; disconnectedUserId?: string } {
  const userEntry = Object.entries(state.users).find(
    ([, u]) => u.socketId === socketId
  );
  if (!userEntry) {
    return { state };
  }

  const [userId, user] = userEntry;
  const updatedUsers = {
    ...state.users,
    [userId]: {
      ...user,
      isOnline: false,
      disconnectedAt: nowMs,
    },
  };

  return {
    state: {
      ...state,
      users: updatedUsers,
    },
    disconnectedUserId: userId,
  };
}

/** Xoá người dùng khi hết thời gian ân hạn 30s và chuyển quyền host nếu cần */
export function purgeDisconnectedUser(
  state: RoomState,
  userId: string
): RoomState {
  const user = state.users[userId];
  if (!user || user.isOnline) {
    return state;
  }

  const updatedUsers = { ...state.users };
  delete updatedUsers[userId];

  // Giải phóng slot hát nếu người này đang giữ
  const updatedSlots = state.singerSlots.map((slot) =>
    slot.userId === userId ? { ...slot, userId: null } : slot
  );

  // Chuyển host nếu host rời đi
  let newHostId = state.hostUserId;
  if (state.hostUserId === userId) {
    const earliestUser = findEarliestOnlineUser(updatedUsers);
    if (earliestUser) {
      newHostId = earliestUser.id;
      updatedUsers[newHostId] = { ...earliestUser, isHost: true };
    } else {
      newHostId = "";
    }
  }

  return {
    ...state,
    hostUserId: newHostId,
    users: updatedUsers,
    singerSlots: updatedSlots,
  };
}

/** Tìm người dùng trực tuyến vào phòng sớm nhất để chuyển quyền host */
export function findEarliestOnlineUser(
  users: Record<string, User>
): User | null {
  const onlineUsers = Object.values(users).filter((u) => u.isOnline);
  if (onlineUsers.length === 0) return null;
  return onlineUsers.reduce((prev, curr) =>
    prev.joinedAt < curr.joinedAt ? prev : curr
  );
}
