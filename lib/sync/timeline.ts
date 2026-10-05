/**
 * KaraRoom - Tính toán vị trí mong đợi (Target Position) của video YouTube.
 * Phân tách rõ ràng giữa người hát (phát theo thời gian thực) và khán giả (làm trễ có chủ đích).
 */

import { CONFIG } from "../../config";
import { Timeline } from "../../shared/types";

export interface TargetPositionOptions {
  timeline: Timeline | null;
  serverNowMs: number;
  isSinger: boolean;
  audienceDelayMs?: number;
  manualOffsetMs?: number; // Điều chỉnh độ lệch ±500ms của từng cá nhân
}

/**
 * Tính vị trí đích (giây) mà YouTube Player cần đạt được tại thời điểm serverNowMs.
 */
export function calculateTargetPositionSec(options: TargetPositionOptions): number {
  const {
    timeline,
    serverNowMs,
    isSinger,
    audienceDelayMs = CONFIG.AUDIENCE_DELAY_MS,
    manualOffsetMs = 0,
  } = options;

  if (!timeline || !timeline.videoId) {
    return 0;
  }

  // Nếu bài hát đang tạm dừng hoặc đang trong thời gian đếm ngược
  if (!timeline.playing || timeline.countdown?.active) {
    return Math.max(0, timeline.positionSec);
  }

  // Thời gian đã trôi qua kể từ mốc đồng bộ của server (mili-giây)
  const elapsedMs = Math.max(0, serverNowMs - timeline.serverTimeMs);

  if (isSinger) {
    // Người hát phát nhạc khớp chính xác với timeline để nghe nhạc và giọng mình tự nhiên nhất
    const singerSec = timeline.positionSec + elapsedMs / 1000;
    return Math.max(0, singerSec);
  }

  // Khán giả phát nhạc chậm hơn một khoảng AUDIENCE_DELAY_MS + manualOffsetMs
  const effectiveDelayMs = audienceDelayMs + manualOffsetMs;
  const audienceElapsedMs = elapsedMs - effectiveDelayMs;
  const audienceSec = timeline.positionSec + audienceElapsedMs / 1000;

  return Math.max(0, audienceSec);
}

/**
 * Nội suy vị trí thực tế của player giữa các lần gọi getCurrentTime().
 * YouTube IFrame chỉ cập nhật getCurrentTime() vài lần mỗi giây,
 * nội suy bằng performance.now() giúp tính toán mượt mà và chính xác.
 */
export class PlayerPositionInterpolator {
  private lastReportedSec = 0;
  private lastReportedPerfMs = 0;
  private playbackRate = 1.0;
  private isPlaying = false;

  public update(currentSec: number, isPlaying: boolean, playbackRate: number = 1.0) {
    this.lastReportedSec = currentSec;
    this.lastReportedPerfMs = performance.now();
    this.isPlaying = isPlaying;
    this.playbackRate = playbackRate;
  }

  public getInterpolatedSec(): number {
    if (!this.isPlaying || this.lastReportedPerfMs === 0) {
      return this.lastReportedSec;
    }

    const elapsedPerfSec = (performance.now() - this.lastReportedPerfMs) / 1000;
    return Math.max(0, this.lastReportedSec + elapsedPerfSec * this.playbackRate);
  }
}
