/**
 * KaraRoom - Động cơ phát hiện và điều chỉnh độ trôi (Drift Correction Engine).
 * So sánh vị trí hiện tại với vị trí đích, quyết định giữ nguyên, tăng/giảm tốc độ, hoặc seekTo.
 */

import { CONFIG } from "../../config";

export type DriftAction =
  | { type: "none"; driftMs: number }
  | { type: "rate"; rate: number; durationMs: number; driftMs: number }
  | { type: "seek"; targetSec: number; driftMs: number };

/**
 * Tìm tốc độ phát phù hợp trong danh sách các tốc độ YouTube hỗ trợ (thường: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]).
 */
export function findClosestRate(
  desiredRate: number,
  availableRates: number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
): number {
  if (availableRates.length === 0) return 1.0;
  return availableRates.reduce((prev, curr) =>
    Math.abs(curr - desiredRate) < Math.abs(prev - desiredRate) ? curr : prev
  );
}

/**
 * Tính toán quyết định chỉnh trôi.
 * @param currentSec Vị trí hiện tại của player
 * @param targetSec Vị trí đích mong đợi
 * @param isSinger Người dùng có đang trong slot hát hay không
 * @param availableRates Danh sách tốc độ YouTube hỗ trợ
 */
export function decideDriftAction(
  currentSec: number,
  targetSec: number,
  isSinger: boolean,
  availableRates: number[] = [0.5, 0.75, 1, 1.25, 1.5]
): DriftAction {
  // driftMs > 0: Player đang chạy chậm hơn đích (cần tăng tốc hoặc seek tới)
  // driftMs < 0: Player đang chạy nhanh hơn đích (cần giảm tốc hoặc seek lùi)
  const driftMs = Math.round((targetSec - currentSec) * 1000);
  const absDriftMs = Math.abs(driftMs);

  // 1. Dưới ngưỡng dung sai (40ms): Bỏ qua hoàn toàn để không giật âm
  if (absDriftMs < CONFIG.DRIFT_TOLERANCE_MS) {
    return { type: "none", driftMs };
  }

  // 2. Lệch quá lớn: Bắt buộc phải seekTo
  // Với người hát, nới lỏng ngưỡng seekTo lên 2500ms để tránh gián đoạn giọng hát
  const seekThresholdMs = isSinger
    ? CONFIG.DRIFT_SEEK_THRESHOLD_MS + 1000
    : CONFIG.DRIFT_SEEK_THRESHOLD_MS;

  if (absDriftMs > seekThresholdMs) {
    return {
      type: "seek",
      targetSec,
      driftMs,
    };
  }

  // 3. Lệch vừa (40ms - 1500ms): Điều chỉnh tốc độ tạm thời
  if (driftMs > 0) {
    // Player đang tụt lại sau: tăng tốc lên 1.25
    const chosenRate = findClosestRate(1.25, availableRates);
    // Thời gian tăng tốc cần thiết để bù khoảng trôi: t = drift / (rate - 1)
    const timeToCatchUpSec = (driftMs / 1000) / Math.max(0.1, chosenRate - 1);
    const durationMs = Math.max(400, Math.min(2500, Math.round(timeToCatchUpSec * 1000)));

    return {
      type: "rate",
      rate: chosenRate,
      durationMs,
      driftMs,
    };
  } else {
    // Player đang chạy trước: giảm tốc xuống 0.75
    const chosenRate = findClosestRate(0.75, availableRates);
    const timeToCatchUpSec = (absDriftMs / 1000) / Math.max(0.1, 1 - chosenRate);
    const durationMs = Math.max(400, Math.min(2500, Math.round(timeToCatchUpSec * 1000)));

    return {
      type: "rate",
      rate: chosenRate,
      durationMs,
      driftMs,
    };
  }
}
