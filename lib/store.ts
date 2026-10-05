/**
 * KaraRoom - Quản lý trạng thái phía Client bằng Zustand.
 * Lưu trữ danh tính (userId, nickname), cấu hình âm lượng và độ lệch thủ công trong localStorage.
 */

import { create } from "zustand";
import { RoomState } from "../shared/types";
import { CONFIG } from "../config";

interface ClientState {
  userId: string;
  nickname: string;
  roomState: RoomState | null;
  hasUserGesture: boolean; // Đã bấm nút "Vào phòng" để kích hoạt AudioContext & Player
  musicVolume: number; // 0.0 - 1.0
  vocalVolume: number; // 0.0 - 1.0
  manualOffsetMs: number; // -500ms đến +500ms
  audienceDelayMs: number;
  isMicActive: boolean;
  isMonitorActive: boolean;
  voiceVolumeLevel: number; // 0.0 - 1.0 (cho hiệu ứng avatar vòng sáng)
  debugMode: boolean;

  // Actions
  initIdentity: () => void;
  setNickname: (nickname: string) => void;
  setHasUserGesture: (hasGesture: boolean) => void;
  setRoomState: (state: RoomState | null) => void;
  setMusicVolume: (volume: number) => void;
  setVocalVolume: (volume: number) => void;
  setManualOffsetMs: (offsetMs: number) => void;
  setAudienceDelayMs: (delayMs: number) => void;
  setMicActive: (active: boolean) => void;
  setMonitorActive: (active: boolean) => void;
  setVoiceVolumeLevel: (level: number) => void;
  setDebugMode: (debug: boolean) => void;
}

const STORAGE_KEYS = {
  USER_ID: "kararoom_user_id",
  NICKNAME: "kararoom_nickname",
  MUSIC_VOL: "kararoom_music_vol",
  VOCAL_VOL: "kararoom_vocal_vol",
  MANUAL_OFFSET: "kararoom_manual_offset",
};

export const useRoomStore = create<ClientState>((set) => ({
  userId: "",
  nickname: "",
  roomState: null,
  hasUserGesture: false,
  musicVolume: 0.8,
  vocalVolume: 1.0,
  manualOffsetMs: 0,
  audienceDelayMs: CONFIG.AUDIENCE_DELAY_MS,
  isMicActive: false,
  isMonitorActive: false,
  voiceVolumeLevel: 0,
  debugMode: false,

  initIdentity: () => {
    if (typeof window === "undefined") return;

    let id = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!id) {
      id = "u-" + Math.random().toString(36).substring(2, 10) + "-" + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEYS.USER_ID, id);
    }

    const savedNickname = localStorage.getItem(STORAGE_KEYS.NICKNAME) || "";
    const savedMusicVol = parseFloat(localStorage.getItem(STORAGE_KEYS.MUSIC_VOL) || "0.8");
    const savedVocalVol = parseFloat(localStorage.getItem(STORAGE_KEYS.VOCAL_VOL) || "1.0");
    const savedOffset = parseInt(localStorage.getItem(STORAGE_KEYS.MANUAL_OFFSET) || "0", 10);

    set({
      userId: id,
      nickname: savedNickname,
      musicVolume: isNaN(savedMusicVol) ? 0.8 : savedMusicVol,
      vocalVolume: isNaN(savedVocalVol) ? 1.0 : savedVocalVol,
      manualOffsetMs: isNaN(savedOffset) ? 0 : savedOffset,
    });
  },

  setNickname: (nickname: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.NICKNAME, nickname);
    }
    set({ nickname });
  },

  setHasUserGesture: (hasUserGesture: boolean) => set({ hasUserGesture }),

  setRoomState: (roomState: RoomState | null) => set({ roomState }),

  setMusicVolume: (musicVolume: number) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.MUSIC_VOL, musicVolume.toString());
    }
    set({ musicVolume });
  },

  setVocalVolume: (vocalVolume: number) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.VOCAL_VOL, vocalVolume.toString());
    }
    set({ vocalVolume });
  },

  setManualOffsetMs: (manualOffsetMs: number) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.MANUAL_OFFSET, manualOffsetMs.toString());
    }
    set({ manualOffsetMs });
  },

  setAudienceDelayMs: (audienceDelayMs: number) => set({ audienceDelayMs }),

  setMicActive: (isMicActive: boolean) => set({ isMicActive }),

  setMonitorActive: (isMonitorActive: boolean) => set({ isMonitorActive }),

  setVoiceVolumeLevel: (voiceVolumeLevel: number) => set({ voiceVolumeLevel }),

  setDebugMode: (debugMode: boolean) => set({ debugMode }),
}));
