"use client";

/**
 * KaraRoom - Trang điều phối chính của ứng dụng Karaoke Realtime.
 * Kết hợp Socket.IO, YouTube Player đồng bộ, WebRTC VoiceTransport, và giao diện chuẩn Design System.
 */

import React, { useEffect, useRef, useState, useTransition } from "react";
import { Users, Music, Sliders } from "lucide-react";
import { useRoomStore } from "../lib/store";
import { getSocket } from "../lib/socket";
import { SOCKET_EVENTS } from "../shared/events";
import { RoomState, SongItem, RtcSignalRelay } from "../shared/types";
import { CONFIG } from "../config";
import { P2PVoiceTransport, PeerLatencyStats } from "../lib/rtc/transport";
import { VoiceProcessingChain } from "../lib/audio/voice-chain";
import { VOICE_PRESETS, VoiceSettings } from "../lib/audio/presets";
import { HomeView } from "../components/home/HomeView";
import { EnterRoomModal } from "../components/room/EnterRoomModal";
import { RoomHeader } from "../components/room/RoomHeader";
import { VideoPlayer } from "../components/room/VideoPlayer";
import { SingingStage } from "../components/room/SingingStage";
import { AudienceList } from "../components/room/AudienceList";
import { SongQueue } from "../components/room/SongQueue";
import { VoiceControlPanel } from "../components/room/VoiceControlPanel";
import { RoomSettingsModal } from "../components/room/RoomSettingsModal";
import { ScoringOverlay } from "../components/room/ScoringOverlay";
import { DebugPanel } from "../components/room/DebugPanel";
import { Toast } from "../components/ui/Toast";

export default function KaraRoomPage() {
  const store = useRoomStore();
  const socket = getSocket();

  const [roomCodeInput, setRoomCodeInput] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("room")?.toUpperCase() || "";
    }
    return "";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modals & Panels
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"queue" | "audience">("queue");

  // Debug & Audio Stats
  const [playerDriftMs, setPlayerDriftMs] = useState(0);
  const [peerStats, setPeerStats] = useState<PeerLatencyStats[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    ...VOICE_PRESETS.karaoke.settings,
    monitorEnabled: false,
  });

  // Web Audio Chain & WebRTC Transport Instances
  const voiceChainRef = useRef<VoiceProcessingChain>(new VoiceProcessingChain());
  const voiceTransportRef = useRef<P2PVoiceTransport>(new P2PVoiceTransport());
  const micIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevSingerKeyRef = useRef<string>("");

  const handleUpdateVoiceSettings = (patch: Partial<typeof voiceSettings>) => {
    setVoiceSettings((prev) => {
      const next = { ...prev, ...patch };
      voiceChainRef.current.applySettings(patch);
      return next;
    });
  };

  // 1. Khởi tạo danh tính & Đọc URL debug mode (?debug=1)
  useEffect(() => {
    store.initIdentity();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "1") {
        store.setDebugMode(true);
      }
    }
  }, []);

  // 2. Lắng nghe các sự kiện từ Socket.IO
  useEffect(() => {
    const handleRoomState = (state: RoomState) => {
      setIsLoading(false);
      store.setRoomState(state);
    };

    const handleRoomError = (data: { message: string }) => {
      setIsLoading(false);
      setErrorMessage(data.message);
      setToastMessage({ text: data.message, type: "error" });
    };

    const handleRtcSignal = (relay: RtcSignalRelay) => {
      voiceTransportRef.current.handleSignal(relay.fromUserId, relay.signal);
    };

    socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
    socket.on(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
    socket.on(SOCKET_EVENTS.RTC_SIGNAL, handleRtcSignal);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
      socket.off(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
      socket.off(SOCKET_EVENTS.RTC_SIGNAL, handleRtcSignal);
    };
  }, [socket]);

  // 3. Khởi tạo WebRTC Transport khi vào phòng và đã có User Gesture
  useEffect(() => {
    if (!store.roomState || !store.hasUserGesture) return;

    voiceTransportRef.current.init(store.userId, socket, {
      onRemoteStreamAdded: () => {},
      onRemoteStreamRemoved: () => {},
      onLatencyUpdate: (stats) => setPeerStats(stats),
    });

    voiceTransportRef.current.updateAudienceDelay(store.audienceDelayMs);

    return () => {
      voiceTransportRef.current.destroy();
    };
  }, [store.roomState?.code, store.hasUserGesture]);

  // 4. Đồng bộ ca sĩ: Khi người dùng được xếp vào slot hát hoặc rời slot
  const onlineUsersKey = Object.values(store.roomState?.users || {})
    .filter((u) => u.isOnline)
    .map((u) => u.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!store.roomState || !store.hasUserGesture) return;

    const mySlot = store.roomState.singerSlots.find((s) => s.userId === store.userId);
    const isSinging = Boolean(mySlot);
    const allOnlineIds = Object.values(store.roomState.users)
      .filter((u) => u.isOnline)
      .map((u) => u.id);
    const singerIds = store.roomState.singerSlots
      .map((s) => s.userId)
      .filter((id): id is string => Boolean(id));

    voiceTransportRef.current.onParticipantsChanged(allOnlineIds, singerIds);

    if (isSinging) {
      if (!store.isMicActive) {
        // Khởi động chuỗi xử lý Mic
        voiceChainRef.current
          .init()
          .then((stream) => {
            store.setMicActive(true);
            voiceTransportRef.current.publish(stream, allOnlineIds);
          })
          .catch(() => {
            setToastMessage({ text: "Không thể truy cập Microphone thiết bị.", type: "error" });
          });
      }

      // Vòng lặp cập nhật mức âm lượng mic cho hiệu ứng avatar phát sáng
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      micIntervalRef.current = setInterval(() => {
        const lvl = voiceChainRef.current.getVolumeLevel();
        store.setVoiceVolumeLevel(lvl);
      }, 80);
    } else {
      if (store.isMicActive) {
        store.setMicActive(false);
        store.setVoiceVolumeLevel(0);
        voiceTransportRef.current.unpublish();
        voiceChainRef.current.destroy();
      }
      if (micIntervalRef.current) {
        clearInterval(micIntervalRef.current);
        micIntervalRef.current = null;
      }
    }
  }, [store.roomState?.singerSlots, store.hasUserGesture, onlineUsersKey]);

  // 4b. Thành viên trong phòng (gồm cả khán giả và ca sĩ hát cùng) chủ động gửi "request-stream" tới các ca sĩ khác
  const singerSlotsKey = store.roomState?.singerSlots.map((s) => s.userId || "").join(",") || "";
  useEffect(() => {
    if (!store.roomState || !store.hasUserGesture) return;

    const activeSingers = store.roomState.singerSlots
      .map((s) => s.userId)
      .filter((id): id is string => Boolean(id && id !== store.userId));

    for (const singerId of activeSingers) {
      voiceTransportRef.current.requestStream(singerId);
    }
  }, [store.roomState?.code, store.hasUserGesture, singerSlotsKey]);

  // Cập nhật âm lượng giọng hát từ xa
  useEffect(() => {
    voiceTransportRef.current.setVocalVolume(store.vocalVolume);
  }, [store.vocalVolume]);

  // 5. Tự động tính toán & tối ưu độ trễ (Voice Delay) khi đổi ca sĩ
  useEffect(() => {
    if (!store.roomState || !store.hasUserGesture) return;

    const mySlot = store.roomState.singerSlots.find((s) => s.userId === store.userId);
    const isSinging = Boolean(mySlot);

    // Chỉ áp dụng cho người nghe (Khán giả)
    if (isSinging) {
      prevSingerKeyRef.current = "";
      return;
    }

    const currentSingers = store.roomState.singerSlots
      .map((s) => (s.userId ? store.roomState?.users[s.userId] : null))
      .filter((u): u is NonNullable<typeof u> => Boolean(u && u.isOnline && u.id !== store.userId));

    const singerKey = currentSingers.map((s) => s.id).sort().join(",");

    // Khi danh sách ca sĩ thay đổi và có ít nhất 1 ca sĩ đang hát
    if (singerKey && singerKey !== prevSingerKeyRef.current) {
      prevSingerKeyRef.current = singerKey;
      const targetSinger = currentSingers[0];

      // Đợi 1200ms để WebRTC peer connection kết nối ổn định rồi đo latency
      const timer = setTimeout(async () => {
        try {
          const stats = await voiceTransportRef.current.measurePeerLatencyAsync(targetSinger.id);
          let optimalDelay: number = CONFIG.AUDIENCE_DELAY_MS;
          if (stats && stats.rttMs > 0) {
            // Độ trễ giọng = RTT/2 + Jitter + 40ms; Bù thêm 40ms safety margin
            optimalDelay = Math.max(150, Math.min(1000, Math.round(stats.estimatedLatencyMs + 40)));
          }
          store.setAudienceDelayMs(optimalDelay);
          voiceTransportRef.current.updateAudienceDelay(optimalDelay);
          setToastMessage({
            text: `🎧 Đã tự động căn độ trễ ${optimalDelay}ms theo ca sĩ ${targetSinger.nickname} để khớp nhịp!`,
            type: "success",
          });
        } catch {}
      }, 1200);

      return () => clearTimeout(timer);
    } else if (!singerKey && prevSingerKeyRef.current) {
      // Khi không còn ca sĩ nào trên slot
      prevSingerKeyRef.current = "";
      store.setAudienceDelayMs(CONFIG.AUDIENCE_DELAY_MS);
      voiceTransportRef.current.updateAudienceDelay(CONFIG.AUDIENCE_DELAY_MS);
    }
  }, [store.roomState?.singerSlots, store.hasUserGesture]);

  // === CÁC TÁC VỤ PHÒNG ===
  const handleCreateRoom = () => {
    setIsLoading(true);
    setErrorMessage(null);
    socket.emit(SOCKET_EVENTS.ROOM_CREATE, {
      userId: store.userId,
      nickname: store.nickname,
    });
  };

  const handleJoinRoom = () => {
    setIsLoading(true);
    setErrorMessage(null);
    socket.emit(SOCKET_EVENTS.ROOM_JOIN, {
      roomCode: roomCodeInput.trim().toUpperCase(),
      userId: store.userId,
      nickname: store.nickname,
    });
  };

  const handleLeaveRoom = () => {
    socket.emit(SOCKET_EVENTS.ROOM_LEAVE);
    voiceTransportRef.current.unpublish();
    voiceChainRef.current.destroy();
    store.setRoomState(null);
    store.setHasUserGesture(false);
  };

  // Nếu chưa vào phòng, hiển thị HomeView
  if (!store.roomState) {
    return (
      <HomeView
        nickname={store.nickname}
        onChangeNickname={store.setNickname}
        roomCodeInput={roomCodeInput}
        onChangeRoomCode={setRoomCodeInput}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    );
  }

  // Nếu đã vào phòng nhưng chưa kích hoạt user gesture
  if (!store.hasUserGesture) {
    return (
      <EnterRoomModal
        roomCode={store.roomState.code}
        onEnter={() => store.setHasUserGesture(true)}
      />
    );
  }

  const mySlot = store.roomState.singerSlots.find((s) => s.userId === store.userId);
  const isSinger = Boolean(mySlot);
  const isHost = Boolean(
    store.roomState.users[store.userId]?.isHost || store.roomState.hostUserId === store.userId
  );
  const canControlPlayback = isSinger || isHost;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col overflow-x-hidden">
      {/* Header */}
      <RoomHeader
        roomState={store.roomState}
        currentUserId={store.userId}
        onOpenSettings={() => setSettingsOpen(true)}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Main Body */}
      <main className="flex-1 p-3 sm:p-5 flex flex-col lg:flex-row gap-4 max-w-[1600px] w-full mx-auto">
        {/* Cột trái: Hàng nghe / Thành viên (Hiện trên desktop, mobile theo tab) */}
        <div className="hidden lg:block w-[280px] shrink-0 h-[calc(100vh-95px)]">
          <AudienceList
            roomState={store.roomState}
            currentUserId={store.userId}
            onToggleWantToSing={(want) => socket.emit(SOCKET_EVENTS.SINGER_WANT_TOGGLE, { wantToSing: want })}
            onAssignToSlot={(targetId, slotIndex) =>
              socket.emit(SOCKET_EVENTS.SLOT_ASSIGN, { targetUserId: targetId, slotIndex })
            }
          />
        </div>

        {/* Cột giữa: Video Player & Hàng hát */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <VideoPlayer
            timeline={store.roomState.timeline}
            songTitle={store.roomState.currentSong?.title}
            durationSec={store.roomState.currentSong?.durationSec}
            isSinger={isSinger}
            canControlPlayback={canControlPlayback}
            audienceDelayMs={store.audienceDelayMs}
            manualOffsetMs={store.manualOffsetMs}
            musicVolume={store.musicVolume}
            onTogglePlayPause={() => {
              if (store.roomState?.timeline.playing) {
                socket.emit(SOCKET_EVENTS.PLAYBACK_PAUSE);
              } else {
                socket.emit(SOCKET_EVENTS.PLAYBACK_RESUME);
              }
            }}
            onUpdateVolume={store.setMusicVolume}
            onSongEnded={() => {
              // Báo cáo hoạt động giọng để tính điểm
              if (isSinger) {
                const ratio = voiceChainRef.current.getVoiceActivityRatio();
                socket.emit(SOCKET_EVENTS.SCORE_REPORT_ACTIVITY, { voiceActiveRatio: ratio });
              } else {
                socket.emit(SOCKET_EVENTS.SONG_ENDED);
              }
            }}
            onPlaybackError={(reason) => socket.emit(SOCKET_EVENTS.SONG_SKIP, { reason })}
            onDriftUpdated={(driftMs) => {
              if (store.debugMode) {
                setPlayerDriftMs(driftMs);
              }
            }}
          />

          <SingingStage
            roomState={store.roomState}
            currentUserId={store.userId}
            isMicActive={store.isMicActive}
            isMonitorActive={store.isMonitorActive}
            localVolumeLevel={store.voiceVolumeLevel}
            musicVolume={store.musicVolume}
            onUpdateMusicVolume={store.setMusicVolume}
            vocalVolume={store.vocalVolume}
            onUpdateVocalVolume={store.setVocalVolume}
            onTakeSlot={(slotIndex) => socket.emit(SOCKET_EVENTS.SLOT_TAKE, { slotIndex })}
            onLeaveSlot={(slotIndex) => socket.emit(SOCKET_EVENTS.SLOT_LEAVE, { slotIndex })}
            onEvictSlot={(slotIndex) => socket.emit(SOCKET_EVENTS.SLOT_EVICT, { slotIndex })}
            onToggleMic={() => {
              const next = !store.isMicActive;
              store.setMicActive(next);
              if (voiceChainRef.current.getStream()) {
                voiceChainRef.current.getStream()?.getAudioTracks().forEach((t) => (t.enabled = next));
              }
            }}
            onToggleMonitor={() => {
              const next = !store.isMonitorActive;
              store.setMonitorActive(next);
              voiceChainRef.current.applySettings({ monitorEnabled: next });
            }}
            onOpenVoicePanel={() => setVoicePanelOpen(true)}
          />

          {/* Trên mobile: chuyển tab Hàng chờ / Thành viên */}
          <div className="block lg:hidden mt-2">
            <div className="flex border-b border-[var(--border)] mb-3">
              <button
                type="button"
                onClick={() => setMobileTab("queue")}
                className={`flex-1 py-2.5 text-[14px] font-semibold flex items-center justify-center gap-2 border-b-2 cursor-pointer ${
                  mobileTab === "queue"
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                <Music className="w-4 h-4" /> Hàng chờ ({store.roomState.queue.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("audience")}
                className={`flex-1 py-2.5 text-[14px] font-semibold flex items-center justify-center gap-2 border-b-2 cursor-pointer ${
                  mobileTab === "audience"
                    ? "border-[var(--live)] text-[var(--live)]"
                    : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                <Users className="w-4 h-4" /> Thành viên (
                {Object.values(store.roomState.users).filter((u) => u.isOnline).length})
              </button>
            </div>

            {mobileTab === "queue" ? (
              <div className="h-[400px]">
                <SongQueue
                  roomState={store.roomState}
                  currentUserId={store.userId}
                  onAddSong={(song) => socket.emit(SOCKET_EVENTS.QUEUE_ADD, song)}
                  onRemoveSong={(songId) => socket.emit(SOCKET_EVENTS.QUEUE_REMOVE, { songId })}
                  onReorderQueue={(newOrderSongIds) =>
                    socket.emit(SOCKET_EVENTS.QUEUE_REORDER, { newOrderSongIds })
                  }
                  onSkipSong={() => socket.emit(SOCKET_EVENTS.SONG_SKIP, { reason: "user_requested" })}
                />
              </div>
            ) : (
              <div className="h-[400px]">
                <AudienceList
                  roomState={store.roomState}
                  currentUserId={store.userId}
                  onToggleWantToSing={(want) =>
                    socket.emit(SOCKET_EVENTS.SINGER_WANT_TOGGLE, { wantToSing: want })
                  }
                  onAssignToSlot={(targetId, slotIndex) =>
                    socket.emit(SOCKET_EVENTS.SLOT_ASSIGN, { targetUserId: targetId, slotIndex })
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: Hàng chờ bài hát (Desktop) */}
        <div className="hidden lg:block w-[340px] shrink-0 h-[calc(100vh-95px)]">
          <SongQueue
            roomState={store.roomState}
            currentUserId={store.userId}
            onAddSong={(song) => socket.emit(SOCKET_EVENTS.QUEUE_ADD, song)}
            onRemoveSong={(songId) => socket.emit(SOCKET_EVENTS.QUEUE_REMOVE, { songId })}
            onReorderQueue={(newOrderSongIds) =>
              socket.emit(SOCKET_EVENTS.QUEUE_REORDER, { newOrderSongIds })
            }
            onSkipSong={() => socket.emit(SOCKET_EVENTS.SONG_SKIP, { reason: "user_requested" })}
          />
        </div>
      </main>

      {/* Màn hình công bố điểm (10 giây) */}
      <ScoringOverlay scoring={store.roomState.scoring} />

      {/* Bảng chỉnh hiệu ứng giọng */}
      <VoiceControlPanel
        isOpen={voicePanelOpen}
        onClose={() => setVoicePanelOpen(false)}
        voiceSettings={voiceSettings}
        musicVolume={store.musicVolume}
        vocalVolume={store.vocalVolume}
        manualOffsetMs={store.manualOffsetMs}
        currentMicVolumeLevel={store.voiceVolumeLevel}
        onUpdateVoiceSettings={handleUpdateVoiceSettings}
        onUpdateMusicVolume={store.setMusicVolume}
        onUpdateVocalVolume={store.setVocalVolume}
        onUpdateManualOffset={store.setManualOffsetMs}
      />

      {/* Hộp thoại cài đặt phòng (Host) */}
      <RoomSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={store.roomState.settings}
        onSave={(patch) => socket.emit(SOCKET_EVENTS.ROOM_SETTINGS_UPDATE, patch)}
      />

      {/* HUD Gỡ lỗi đồng bộ (?debug=1) */}
      {store.debugMode && (
        <DebugPanel playerDriftMs={playerDriftMs} peerStats={peerStats} />
      )}

      {/* Toast thông báo */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50">
          <Toast
            type={toastMessage.type}
            message={toastMessage.text}
            onClose={() => setToastMessage(null)}
          />
        </div>
      )}
    </div>
  );
}
