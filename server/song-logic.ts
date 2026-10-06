/**
 * KaraRoom - Logic hàng chờ bài hát, phân chia slot hát và tính điểm.
 * Các hàm thuần túy độc lập phục vụ kiểm thử đơn vị.
 */

import { CONFIG } from "../config";
import {
  RoomSettings,
  RoomState,
  ScoreResult,
  SingerSlot,
  SongItem,
} from "../shared/types";

/** Cập nhật cài đặt phòng (chỉ host có quyền) */
export function updateSettings(
  state: RoomState,
  requesterUserId: string,
  patch: Partial<RoomSettings>
): { state: RoomState; error?: string } {
  if (state.hostUserId !== requesterUserId) {
    return { state, error: "Chỉ trưởng phòng (Host) mới có quyền đổi cài đặt." };
  }

  const newSettings: RoomSettings = {
    ...state.settings,
    ...patch,
  };

  // Nếu thay đổi số slot hát, điều chỉnh mảng singerSlots
  let newSlots = [...state.singerSlots];
  if (patch.maxSingerSlots && patch.maxSingerSlots !== state.singerSlots.length) {
    if (patch.maxSingerSlots > state.singerSlots.length) {
      for (let i = state.singerSlots.length; i < patch.maxSingerSlots; i++) {
        newSlots.push({ slotIndex: i, userId: null });
      }
    } else {
      newSlots = newSlots.slice(0, patch.maxSingerSlots);
    }
  }

  return {
    state: {
      ...state,
      settings: newSettings,
      singerSlots: newSlots,
    },
  };
}

/** Thêm bài vào hàng chờ */
export function addSong(
  state: RoomState,
  requesterUserId: string,
  songData: { videoId: string; title: string; durationSec: number; thumbnail: string },
  nowMs: number = Date.now()
): { state: RoomState; error?: string } {
  const user = state.users[requesterUserId];
  if (!user) {
    return { state, error: "Không tìm thấy người dùng." };
  }

  // Kiểm tra quyền thêm bài nếu phòng không cho phép thành viên thêm
  if (!state.settings.allowMemberAddSong && !user.isHost) {
    return { state, error: "Trưởng phòng đã tắt quyền thêm bài của thành viên." };
  }

  const newSong: SongItem = {
    id: `song-${nowMs}-${Math.random().toString(36).substring(2, 7)}`,
    videoId: songData.videoId,
    title: songData.title,
    durationSec: songData.durationSec,
    thumbnail: songData.thumbnail,
    addedByUserId: requesterUserId,
    addedByName: user.nickname,
  };

  // Nếu hiện tại chưa có bài đang phát, bài mới thêm sẽ được phát ngay lập tức
  if (!state.currentSong && state.queue.length === 0 && !state.scoring) {
    let nextState: RoomState = {
      ...state,
      currentSong: newSong,
      timeline: {
        videoId: newSong.videoId,
        positionSec: 0,
        serverTimeMs: nowMs,
        playing: false,
        countdown: {
          active: true,
          startAtServerMs: nowMs,
          durationSec: 5,
          type: "start",
        },
      },
    };

    // Nếu phòng ở chế độ ngẫu nhiên, tự động bốc người hát
    if (state.settings.selectionMode === "random") {
      nextState = pickRandomSingers(nextState);
    }

    return { state: nextState };
  }

  return {
    state: {
      ...state,
      queue: [...state.queue, newSong],
    },
  };
}

/** Xoá bài khỏi hàng chờ (chỉ người thêm hoặc host được xoá) */
export function removeSong(
  state: RoomState,
  requesterUserId: string,
  songId: string
): { state: RoomState; error?: string } {
  const song = state.queue.find((s) => s.id === songId);
  if (!song) {
    return { state, error: "Bài hát không tồn tại trong hàng chờ." };
  }

  const requester = state.users[requesterUserId];
  const isAllowed = requester && (requester.isHost || song.addedByUserId === requesterUserId);
  if (!isAllowed) {
    return { state, error: "Chỉ người thêm bài hoặc trưởng phòng mới được xoá." };
  }

  return {
    state: {
      ...state,
      queue: state.queue.filter((s) => s.id !== songId),
    },
  };
}

/** Kéo thả đổi thứ tự bài trong hàng chờ (chỉ host có quyền) */
export function reorderQueue(
  state: RoomState,
  requesterUserId: string,
  newOrderSongIds: string[]
): { state: RoomState; error?: string } {
  if (state.hostUserId !== requesterUserId) {
    return { state, error: "Chỉ trưởng phòng mới được đổi thứ tự hàng chờ." };
  }

  const songMap = new Map(state.queue.map((s) => [s.id, s]));
  const reordered: SongItem[] = [];

  for (const id of newOrderSongIds) {
    const s = songMap.get(id);
    if (s) {
      reordered.push(s);
      songMap.delete(id);
    }
  }

  // Giữ lại các bài không nằm trong newOrderSongIds nếu có
  for (const s of songMap.values()) {
    reordered.push(s);
  }

  return {
    state: {
      ...state,
      queue: reordered,
    },
  };
}

/** Bỏ qua bài đang phát (host hoặc do lỗi video) */
export function skipSong(
  state: RoomState,
  requesterUserId: string,
  reason: string,
  nowMs: number = Date.now()
): { state: RoomState; error?: string } {
  const requester = state.users[requesterUserId];
  const isAllowed = requester?.isHost || reason === "playback_error" || reason === "unembeddable";

  if (!isAllowed) {
    return { state, error: "Chỉ trưởng phòng mới được bỏ qua bài đang phát." };
  }

  // Chuyển sang bài tiếp theo (không chấm điểm nếu skip giữa chừng)
  return {
    state: playNextSongImmediately(state, nowMs),
  };
}

/** Kiểm tra người dùng có quyền Play / Pause bài hát (Host hoặc Ca sĩ trên slot) */
export function canUserControlPlayback(state: RoomState, userId: string): boolean {
  const user = state.users[userId];
  if (!user) return false;
  if (user.isHost || state.hostUserId === userId) return true;
  return state.singerSlots.some((s) => s.userId === userId);
}

/** Tạm dừng bài hát (Pause) */
export function pausePlayback(
  state: RoomState,
  requesterUserId: string,
  nowMs: number = Date.now()
): { state: RoomState; error?: string } {
  if (!canUserControlPlayback(state, requesterUserId)) {
    return { state, error: "Chỉ trưởng phòng hoặc ca sĩ mới có quyền tạm dừng." };
  }
  if (!state.currentSong) {
    return { state, error: "Không có bài hát nào đang phát." };
  }

  let currentPos = state.timeline.positionSec;
  if (state.timeline.playing) {
    const elapsedSec = Math.max(0, (nowMs - state.timeline.serverTimeMs) / 1000);
    currentPos = currentPos + elapsedSec;
    if (state.currentSong.durationSec) {
      currentPos = Math.min(state.currentSong.durationSec, currentPos);
    }
  }

  return {
    state: {
      ...state,
      timeline: {
        ...state.timeline,
        positionSec: currentPos,
        serverTimeMs: nowMs,
        playing: false,
        countdown: null,
      },
    },
  };
}

/** Tiếp tục phát bài hát (Resume) - Kích hoạt đếm ngược 5 giây */
export function resumePlayback(
  state: RoomState,
  requesterUserId: string,
  nowMs: number = Date.now()
): { state: RoomState; error?: string } {
  if (!canUserControlPlayback(state, requesterUserId)) {
    return { state, error: "Chỉ trưởng phòng hoặc ca sĩ mới có quyền tiếp tục phát." };
  }
  if (!state.currentSong) {
    return { state, error: "Không có bài hát nào đang phát." };
  }
  if (state.timeline.playing && !state.timeline.countdown) {
    return { state };
  }

  return {
    state: {
      ...state,
      timeline: {
        ...state.timeline,
        serverTimeMs: nowMs,
        playing: false,
        countdown: {
          active: true,
          startAtServerMs: nowMs,
          durationSec: 5,
          type: "resume",
        },
      },
    },
  };
}

/** Khi hết thời gian đếm ngược 5 giây: chính thức phát bài hát */
export function finishPlaybackCountdown(
  state: RoomState,
  nowMs: number = Date.now()
): RoomState {
  if (!state.currentSong) return state;

  return {
    ...state,
    timeline: {
      ...state.timeline,
      serverTimeMs: nowMs,
      playing: true,
      countdown: null,
    },
  };
}

/** Hết bài tự nhiên: kiểm tra nếu có người hát thì mở màn công bố điểm */
export function advanceSongOnEnded(
  state: RoomState,
  voiceActivityRatio: number = 0.5,
  nowMs: number = Date.now()
): { state: RoomState; scoringStarted: boolean } {
  if (!state.currentSong || state.scoring) {
    return { state, scoringStarted: false };
  }

  // Lấy danh sách người đang ở các slot hát
  let activeSingers = state.singerSlots
    .map((slot) => (slot.userId ? state.users[slot.userId] : null))
    .filter((u): u is NonNullable<typeof u> => Boolean(u && u.isOnline));

  // Nếu chưa có ai lấy slot nhưng bài hát kết thúc, lấy người đã thêm bài hoặc thành viên online trong phòng
  if (activeSingers.length === 0) {
    const addedByUser = state.currentSong.addedByUserId ? state.users[state.currentSong.addedByUserId] : null;
    if (addedByUser && addedByUser.isOnline) {
      activeSingers = [addedByUser];
    } else {
      const firstOnlineUser = Object.values(state.users).find((u) => u.isOnline);
      if (firstOnlineUser) {
        activeSingers = [firstOnlineUser];
      }
    }
  }

  // Nếu có người hát / người trong phòng, chuyển sang trạng thái chấm điểm trong 10 giây
  if (activeSingers.length > 0) {
    const score = calculateScore(voiceActivityRatio);
    const scoreResult: ScoreResult = {
      score,
      songTitle: state.currentSong.title,
      singers: activeSingers.map((s) => ({ userId: s.id, nickname: s.nickname })),
      announcedAt: nowMs,
      durationSec: CONFIG.SCORE_ANNOUNCE_DURATION_SEC,
    };

    return {
      state: {
        ...state,
        scoring: scoreResult,
        timeline: {
          videoId: null,
          positionSec: 0,
          serverTimeMs: nowMs,
          playing: false,
        },
      },
      scoringStarted: true,
    };
  }

  // Không có người hát thì qua bài luôn
  return {
    state: playNextSongImmediately(state, nowMs),
    scoringStarted: false,
  };
}

/** Kết thúc màn công bố điểm và qua bài tiếp theo */
export function finishScoring(
  state: RoomState,
  nowMs: number = Date.now()
): RoomState {
  return playNextSongImmediately({ ...state, scoring: null }, nowMs);
}

/** Phát ngay bài tiếp theo trong hàng chờ */
function playNextSongImmediately(
  state: RoomState,
  nowMs: number = Date.now()
): RoomState {
  if (state.queue.length === 0) {
    return {
      ...state,
      currentSong: null,
      scoring: null,
      timeline: {
        videoId: null,
        positionSec: 0,
        serverTimeMs: nowMs,
        playing: false,
      },
    };
  }

  const [nextSong, ...remainingQueue] = state.queue;
  let nextState: RoomState = {
    ...state,
    currentSong: nextSong,
    queue: remainingQueue,
    scoring: null,
    timeline: {
      videoId: nextSong.videoId,
      positionSec: 0,
      serverTimeMs: nowMs,
      playing: false,
      countdown: {
        active: true,
        startAtServerMs: nowMs,
        durationSec: 5,
        type: "start",
      },
    },
  };

  // Nếu ở chế độ bốc ngẫu nhiên, chọn lại người hát cho bài mới
  if (state.settings.selectionMode === "random") {
    nextState = pickRandomSingers(nextState);
  }

  return nextState;
}

/** Tính điểm: số nguyên 75-100 có trọng số theo tỉ lệ hoạt động mic (0.0 - 1.0) */
export function calculateScore(voiceActivityRatio: number, seed?: number): number {
  const clampedRatio = Math.max(0, Math.min(1, voiceActivityRatio));
  const randomFactor = seed !== undefined ? seed : Math.random();
  // Cơ sở: 75 điểm + tối đa 15 điểm từ tỉ lệ hát + tối đa 10 điểm từ yếu tố ngẫu nhiên
  const scoreFromActivity = Math.round(clampedRatio * 15);
  const scoreFromLuck = Math.round(randomFactor * 10);
  const total = CONFIG.SCORE_MIN + scoreFromActivity + scoreFromLuck;
  return Math.min(CONFIG.SCORE_MAX, Math.max(CONFIG.SCORE_MIN, total));
}

// === CÁC THAO TÁC VỚI HÀNG HÁT / SLOTS ===

/** Người dùng bấm lên slot hát (ở chế độ tự do) */
export function takeSingerSlot(
  state: RoomState,
  userId: string,
  slotIndex: number
): { state: RoomState; error?: string } {
  if (state.settings.selectionMode !== "free") {
    return { state, error: "Phòng hiện không ở chế độ hát tự do." };
  }

  const slot = state.singerSlots[slotIndex];
  if (!slot) {
    return { state, error: "Vị trí slot không hợp lệ." };
  }
  if (slot.userId && slot.userId !== userId) {
    return { state, error: "Slot này đã có người giữ chỗ." };
  }

  // Bỏ slot cũ nếu người này đang ở slot khác
  const updatedSlots = state.singerSlots.map((s, idx) => {
    if (idx === slotIndex) return { ...s, userId };
    if (s.userId === userId) return { ...s, userId: null };
    return s;
  });

  return {
    state: {
      ...state,
      singerSlots: updatedSlots,
    },
  };
}

/** Người dùng tự xuống slot hát */
export function leaveSingerSlot(
  state: RoomState,
  userId: string,
  slotIndex?: number
): { state: RoomState; error?: string } {
  const updatedSlots = state.singerSlots.map((s, idx) => {
    if (slotIndex !== undefined && idx === slotIndex && s.userId === userId) {
      return { ...s, userId: null };
    }
    if (slotIndex === undefined && s.userId === userId) {
      return { ...s, userId: null };
    }
    return s;
  });

  return {
    state: {
      ...state,
      singerSlots: updatedSlots,
    },
  };
}

/** Host chỉ định thành viên vào slot */
export function assignSingerSlot(
  state: RoomState,
  requesterUserId: string,
  targetUserId: string,
  slotIndex: number
): { state: RoomState; error?: string } {
  if (state.hostUserId !== requesterUserId) {
    return { state, error: "Chỉ trưởng phòng mới được chỉ định người hát." };
  }
  if (!state.singerSlots[slotIndex]) {
    return { state, error: "Vị trí slot không hợp lệ." };
  }
  if (!state.users[targetUserId]) {
    return { state, error: "Người dùng không tồn tại." };
  }

  const updatedSlots = state.singerSlots.map((s, idx) => {
    if (idx === slotIndex) return { ...s, userId: targetUserId };
    if (s.userId === targetUserId) return { ...s, userId: null };
    return s;
  });

  return {
    state: {
      ...state,
      singerSlots: updatedSlots,
    },
  };
}

/** Host mời người hát xuống khỏi slot */
export function evictSingerSlot(
  state: RoomState,
  requesterUserId: string,
  slotIndex: number
): { state: RoomState; error?: string } {
  if (state.hostUserId !== requesterUserId) {
    return { state, error: "Chỉ trưởng phòng mới được mời người hát xuống." };
  }
  if (!state.singerSlots[slotIndex]) {
    return { state, error: "Vị trí slot không hợp lệ." };
  }

  const updatedSlots = state.singerSlots.map((s, idx) =>
    idx === slotIndex ? { ...s, userId: null } : s
  );

  return {
    state: {
      ...state,
      singerSlots: updatedSlots,
    },
  };
}

/** Thành viên bật/tắt cờ 'Muốn hát' (dùng cho chế độ ngẫu nhiên) */
export function setWantToSing(
  state: RoomState,
  userId: string,
  wantToSing: boolean
): { state: RoomState; error?: string } {
  const user = state.users[userId];
  if (!user) {
    return { state, error: "Người dùng không tồn tại." };
  }

  return {
    state: {
      ...state,
      users: {
        ...state.users,
        [userId]: { ...user, wantToSing },
      },
    },
  };
}

/** Bốc ngẫu nhiên người hát từ danh sách thành viên đang bật 'Muốn hát' */
export function pickRandomSingers(state: RoomState): RoomState {
  const candidates = Object.values(state.users).filter(
    (u) => u.isOnline && u.wantToSing
  );

  // Xáo trộn ngẫu nhiên danh sách ứng viên (Fisher-Yates)
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const maxSlots = state.settings.maxSingerSlots;
  const newSlots: SingerSlot[] = Array.from({ length: maxSlots }, (_, idx) => ({
    slotIndex: idx,
    userId: shuffled[idx]?.id || null,
  }));

  return {
    ...state,
    singerSlots: newSlots,
  };
}
