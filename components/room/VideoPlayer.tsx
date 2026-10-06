/**
 * KaraRoom - Trình phát media tự quản (Self-Managed HTML5 Video Player).
 * Hoạt động hoàn toàn độc lập, không nạp script bên ngoài, không bị chặn bởi CSP hay tiện ích mở rộng.
 * Tự động đồng bộ vị trí theo timeline server và điều chỉnh độ trôi qua native playbackRate / currentTime.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Radio,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { CONFIG } from "../../config";
import { Timeline } from "../../shared/types";
import { decideDriftAction } from "../../lib/sync/drift";
import { calculateTargetPositionSec } from "../../lib/sync/timeline";
import { getClockSync } from "../../lib/socket";
import { Badge } from "../ui/Badge";
import { CountdownOverlay } from "./CountdownOverlay";

interface VideoPlayerProps {
  timeline: Timeline | null;
  songTitle?: string;
  durationSec?: number;
  isSinger: boolean;
  canControlPlayback?: boolean;
  audienceDelayMs: number;
  manualOffsetMs: number;
  musicVolume: number; // 0.0 - 1.0
  onTogglePlayPause?: () => void;
  onUpdateVolume?: (vol: number) => void;
  onSongEnded: () => void;
  onPlaybackError: (reason: "playback_error" | "unembeddable") => void;
  onDriftUpdated?: (driftMs: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  timeline,
  songTitle,
  durationSec: propDurationSec = 0,
  isSinger,
  canControlPlayback = false,
  audienceDelayMs,
  manualOffsetMs,
  musicVolume,
  onTogglePlayPause,
  onUpdateVolume,
  onSongEnded,
  onPlaybackError,
  onDriftUpdated,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasEndedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [mediaDurationSec, setMediaDurationSec] = useState(0);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerEngine, setPlayerEngine] = useState<"native" | "nocookie">("native");
  const [prevVideoId, setPrevVideoId] = useState(timeline?.videoId);

  const durationSec = propDurationSec || mediaDurationSec || 0;

  // Gửi lệnh điều khiển tới YouTube NoCookie Iframe qua postMessage
  const sendIframeCommand = useCallback((func: string, args: any[] = []) => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func, args }),
          "*"
        );
      } catch (err) {
        console.warn("[VideoPlayer] Không thể gửi lệnh tới YouTube iframe:", err);
      }
    }
  }, []);

  // Điều chỉnh state khi đổi bài hát mà không gây cascading render trong effect
  if (timeline?.videoId !== prevVideoId) {
    setPrevVideoId(timeline?.videoId);
    setPlayerEngine("native");
    setErrorMessage(null);
    hasEndedRef.current = false;
  }

  const driftIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rateResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Đường dẫn stream tự quản qua máy chủ nội bộ
  const mediaStreamSrc = timeline?.videoId
    ? `/api/youtube/stream?videoId=${timeline.videoId}`
    : undefined;

  // 1. Đồng bộ âm lượng cho cả Native Video và YouTube NoCookie Iframe
  useEffect(() => {
    // A. Native Video
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : Math.max(0, Math.min(1, musicVolume));
    }
    // B. YouTube NoCookie Iframe
    if (playerEngine === "nocookie") {
      if (isMuted) {
        sendIframeCommand("mute");
      } else {
        sendIframeCommand("unMute");
        sendIframeCommand("setVolume", [Math.round(Math.max(0, Math.min(1, musicVolume)) * 100)]);
      }
    }
  }, [musicVolume, isMuted, playerEngine, sendIframeCommand]);

  // Tính toán vị trí mục tiêu hiện tại (giây) theo đồng hồ phòng
  const getTargetPositionSec = useCallback(() => {
    if (!timeline?.videoId) return 0;
    const clock = getClockSync();
    const serverNow = clock.nowServerTime();
    return calculateTargetPositionSec({
      timeline,
      serverNowMs: serverNow,
      isSinger,
      audienceDelayMs,
      manualOffsetMs,
    });
  }, [timeline, isSinger, audienceDelayMs, manualOffsetMs]);

  // Đồng bộ vị trí và trạng thái play/pause của thẻ video
  const syncVideoState = useCallback(
    (forcePlay: boolean = false) => {
      const video = videoRef.current;
      if (!video || !timeline?.videoId || video.readyState < 1) return;

      const targetSec = getTargetPositionSec();
      const isCountdownActive = Boolean(timeline.countdown?.active);
      const shouldPlay = timeline.playing && !isCountdownActive;

      // Khi chênh lệch quá 0.5s hoặc mới load xong: Seek chính xác tới vị trí đích
      if (Math.abs(video.currentTime - targetSec) > 0.5) {
        try {
          video.currentTime = targetSec;
        } catch (err) {
          console.warn("[VideoPlayer] Chưa thể seek tới targetSec:", err);
        }
      }

      if (!shouldPlay) {
        if (!video.paused) {
          video.pause();
        }
      } else {
        if (forcePlay || video.paused) {
          video.play().catch(() => {});
        }
      }
    },
    [getTargetPositionSec, timeline?.playing, timeline?.countdown?.active, timeline?.videoId]
  );

  // 2. Chuyển bài hoặc tải video mới hoặc đồng bộ play/pause/countdown
  useEffect(() => {
    if (!timeline?.videoId) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
      return;
    }

    if (playerEngine === "native" && videoRef.current) {
      setIsLoadingMedia(true);
      syncVideoState();
    }
  }, [
    timeline?.videoId,
    timeline?.playing,
    timeline?.positionSec,
    timeline?.countdown?.active,
    playerEngine,
    syncVideoState,
  ]);

  // 3. Vòng lặp kiểm tra độ trôi mỗi 500ms
  useEffect(() => {
    if (playerEngine !== "native") return;

    if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);

    driftIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || !timeline?.videoId || !timeline.playing || timeline.countdown?.active) return;
      if (video.readyState < 1) return;

      const targetSec = getTargetPositionSec();
      const currentSec = video.currentTime;
      const decision = decideDriftAction(currentSec, targetSec, isSinger, [0.8, 0.9, 1.0, 1.15, 1.25]);

      if (onDriftUpdated) {
        onDriftUpdated(decision.driftMs);
      }

      if (decision.type === "seek") {
        try {
          video.currentTime = decision.targetSec;
        } catch {}
      } else if (decision.type === "rate") {
        video.playbackRate = decision.rate;

        if (rateResetTimeoutRef.current) clearTimeout(rateResetTimeoutRef.current);
        rateResetTimeoutRef.current = setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.playbackRate = 1.0;
          }
        }, decision.durationMs);
      }
    }, CONFIG.DRIFT_CHECK_INTERVAL_MS);

    return () => {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
      if (rateResetTimeoutRef.current) clearTimeout(rateResetTimeoutRef.current);
    };
  }, [timeline, isSinger, playerEngine, onDriftUpdated, getTargetPositionSec]);

  // 4. Các sự kiện Native Video
  const handleMediaLoaded = () => {
    setIsLoadingMedia(false);
    syncVideoState(true);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTimeSec(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setMediaDurationSec(videoRef.current.duration);
      }
    }
  };

  const handleVideoEnded = useCallback(() => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    onSongEnded();
  }, [onSongEnded]);

  // Theo dõi tiến trình thời gian và tự động kết thúc bài khi chạm mốc durationSec
  useEffect(() => {
    if (!timeline?.videoId || !timeline.playing || timeline.countdown?.active) return;

    const interval = setInterval(() => {
      const targetSec = getTargetPositionSec();
      if (playerEngine === "nocookie") {
        setCurrentTimeSec(targetSec);
      }

      const totalDuration = durationSec || 0;
      if (totalDuration > 0 && targetSec >= totalDuration - 0.5) {
        handleVideoEnded();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [
    timeline?.videoId,
    timeline?.playing,
    timeline?.countdown?.active,
    playerEngine,
    durationSec,
    getTargetPositionSec,
    handleVideoEnded,
  ]);

  // Lắng nghe sự kiện kết thúc phát từ YouTube NoCookie Iframe qua postMessage
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "onStateChange" && (data?.info === 0 || data?.data === 0)) {
          handleVideoEnded();
        }
      } catch {}
    };

    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, [handleVideoEnded]);

  const handleVideoError = () => {
    setIsLoadingMedia(false);
    // Tự động chuyển mượt mà sang YouTube NoCookie khi video bị chặn stream hoặc gặp lỗi
    console.info("[VideoPlayer] Luồng media tự quản không khả dụng cho video này. Tự động chuyển sang YouTube NoCookie.");
    setPlayerEngine("nocookie");
    setErrorMessage(null);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const nocookieStartSec = Math.max(0, Math.floor(getTargetPositionSec()));

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-[16px] overflow-hidden border border-[var(--border)] shadow-2xl flex items-center justify-center group select-none"
    >
      {/* 1. Trình phát tự quản Native HTML5 Video */}
      {playerEngine === "native" && timeline?.videoId && (
        <video
          ref={videoRef}
          src={mediaStreamSrc}
          playsInline
          autoPlay
          onLoadedMetadata={handleMediaLoaded}
          onCanPlay={handleMediaLoaded}
          onLoadedData={handleMediaLoaded}
          onWaiting={() => setIsLoadingMedia(true)}
          onPlaying={() => {
            setIsLoadingMedia(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          className="w-full h-full object-contain bg-black"
        />
      )}

      {/* 2. Dự phòng: Iframe YouTube NoCookie (tự động phát đúng giây đang phát) */}
      {playerEngine === "nocookie" && timeline?.videoId && (
        <iframe
          ref={iframeRef}
          key={`${timeline.videoId}-${nocookieStartSec}`}
          src={`https://www.youtube-nocookie.com/embed/${timeline.videoId}?autoplay=1&start=${nocookieStartSec}&enablejsapi=1&controls=0&modestbranding=1&rel=0`}
          title="KaraRoom Video Player"
          allow="autoplay; encrypted-media"
          onLoad={() => {
            if (isMuted) {
              sendIframeCommand("mute");
            } else {
              sendIframeCommand("unMute");
              sendIframeCommand("setVolume", [Math.round(Math.max(0, Math.min(1, musicVolume)) * 100)]);
            }
          }}
          className="w-full h-full border-0 pointer-events-auto"
        />
      )}

      {/* 3. Trạng thái trống khi chưa có bài hát */}
      {!timeline?.videoId && (
        <div className="absolute inset-0 bg-[var(--surface)] flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
          <div className="w-14 h-14 rounded-full bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)]">
            <Music className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-[18px] text-[var(--text)]">
              Chưa có bài hát nào đang phát
            </h3>
            <p className="text-[14px] text-[var(--text-muted)] mt-1">
              Thêm một bài từ hàng chờ bên phải để bắt đầu bữa tiệc karaoke!
            </p>
          </div>
        </div>
      )}

      {/* 3b. Màn hình đếm ngược 5 giây trước khi phát hoặc resume */}
      {timeline?.countdown?.active && (
        <CountdownOverlay countdown={timeline.countdown} songTitle={songTitle} />
      )}

      {/* 4. Loading Spinner khi đang nạp luồng */}
      {isLoadingMedia && timeline?.videoId && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-20 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)]/90 border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text)]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
            <span>Đang đệm âm thanh & video...</span>
          </div>
        </div>
      )}

      {/* 5. Thông báo lỗi */}
      {errorMessage && (
        <div className="absolute top-4 left-4 right-4 z-30 bg-[var(--danger)] text-[var(--bg)] px-4 py-2.5 rounded-[8px] flex items-center justify-between gap-2 text-[13px] font-semibold">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setPlayerEngine(playerEngine === "native" ? "nocookie" : "native")}
            className="underline shrink-0 text-[12px] cursor-pointer"
          >
            Thử đổi chế độ
          </button>
        </div>
      )}

      {/* 6. Thanh điều khiển ghim trên đỉnh (Tiêu đề bài hát & Chế độ phát) */}
      {timeline?.videoId && (
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
          {songTitle && (
            <div className="bg-[var(--bg)]/80 backdrop-blur-md border border-[var(--border)] px-3 py-1.5 rounded-[8px] max-w-[70%] truncate">
              <span className="font-display text-[13px] text-[var(--text)] font-semibold truncate block">
                {songTitle}
              </span>
            </div>
          )}

          {/* Nút chuyển đổi chế độ phát tự quản / nocookie */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                const nextEngine = playerEngine === "native" ? "nocookie" : "native";
                setPlayerEngine(nextEngine);
              }}
              title="Nhấn để đổi giữa Trình phát tự quản HTML5 và NoCookie"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg)]/80 hover:bg-[var(--surface-raised)] border border-[var(--border)] rounded-[8px] text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-all cursor-pointer backdrop-blur-md"
            >
              <Radio className="w-3 h-3 text-[var(--live)]" />
              <span>{playerEngine === "native" ? "Trình phát tự quản" : "YouTube NoCookie"}</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. Thanh điều khiển dưới đáy (Custom Controls Overlay) - Hiển thị cho cả Native và NoCookie */}
      {timeline?.videoId && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent opacity-95 sm:opacity-85 sm:hover:opacity-100 transition-opacity duration-200 z-20 space-y-2 pointer-events-auto">
          {/* Thanh tiến trình (Scrubber Bar) */}
          <div className="w-full flex items-center gap-2">
            <div className="relative flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer">
              <div
                className="h-full bg-[var(--accent)]"
                style={{
                  width: `${durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="font-mono-tabular text-[11px] text-white/80 shrink-0">
              {formatTime(currentTimeSec)} / {formatTime(durationSec || 180)}
            </span>
          </div>

          {/* Các nút điều khiển hàng dưới */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={timeline?.playing ? "Tạm dừng" : "Phát"}
                disabled={!canControlPlayback}
                onClick={() => {
                  if (onTogglePlayPause) onTogglePlayPause();
                  if (playerEngine === "nocookie") {
                    sendIframeCommand(timeline?.playing ? "pauseVideo" : "playVideo");
                  }
                }}
                title={
                  canControlPlayback
                    ? timeline?.playing
                      ? "Tạm dừng (toàn phòng)"
                      : "Tiếp tục phát (đếm ngược 5s)"
                    : "Chỉ Trưởng phòng hoặc Ca sĩ mới có quyền tạm dừng / phát"
                }
                className={`p-1 transition-colors ${
                  canControlPlayback
                    ? "text-white hover:text-[var(--accent)] cursor-pointer"
                    : "text-white/40 cursor-not-allowed"
                }`}
              >
                {timeline?.playing ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 fill-current" />
                )}
              </button>

              {/* Nút bật/tắt tiếng và Thanh chỉnh âm lượng nhạc nhanh */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-white hover:text-[var(--accent)] transition-colors p-1 cursor-pointer"
                >
                  {isMuted || musicVolume === 0 ? (
                    <VolumeX className="w-5 h-5 text-[var(--danger)]" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <div className="w-16 sm:w-24 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={isMuted ? 0 : musicVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isMuted) setIsMuted(false);
                      if (onUpdateVolume) onUpdateVolume(val);
                    }}
                    title={`Âm lượng nhạc: ${Math.round((isMuted ? 0 : musicVolume) * 100)}%`}
                    className="w-full h-1.5 accent-[var(--accent)] bg-white/30 rounded-lg cursor-pointer"
                  />
                </div>
                <span className="text-[11px] font-mono-tabular text-white/70 w-8 hidden sm:inline-block">
                  {Math.round((isMuted ? 0 : musicVolume) * 100)}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="live" className="text-[10px] hidden sm:inline-flex">
                Đồng bộ realtime
              </Badge>
              <button
                type="button"
                aria-label="Toàn màn hình"
                onClick={toggleFullscreen}
                className="text-white hover:text-[var(--accent)] transition-colors p-1"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
