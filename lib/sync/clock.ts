/**
 * KaraRoom - Bộ đồng bộ đồng hồ NTP (Network Time Protocol) phía Client.
 * Đo độ lệch thời gian giữa Client và Server qua Socket.IO để xác định chính xác Server Time.
 */

import { Socket } from "socket.io-client";
import { CONFIG } from "../../config";
import { SOCKET_EVENTS } from "../../shared/events";
import { SyncPongPayload } from "../../shared/types";

export interface NtpSample {
  t0: number; // Thời điểm client gửi ping
  t1: number; // Thời điểm server nhận (serverTimeMs)
  t2: number; // Thời điểm server gửi pong (ở đây coi xấp xỉ t1)
  t3: number; // Thời điểm client nhận pong
  rtt: number; // Round-trip time
  offset: number; // Độ lệch (serverTime - clientTime)
}

/** Tính độ lệch thời gian và RTT từ 4 mốc thời gian */
export function calculateNtpOffset(
  t0: number,
  t1: number,
  t2: number,
  t3: number
): { offset: number; rtt: number } {
  const rtt = Math.max(0, t3 - t0 - (t2 - t1));
  const offset = (t1 - t0 + (t2 - t3)) / 2;
  return { offset, rtt };
}

/** Chọn mẫu có RTT nhỏ nhất trong danh sách các lần đo */
export function selectBestNtpSample(samples: NtpSample[]): NtpSample | null {
  if (samples.length === 0) return null;
  return samples.reduce((best, cur) => (cur.rtt < best.rtt ? cur : best));
}

export class ClockSync {
  private offsetMs = 0;
  private lastRttMs = 0;
  private syncInterval: NodeJS.Timeout | null = null;
  private pendingSamples: NtpSample[] = [];

  constructor(private socket?: Socket) {}

  public setSocket(socket: Socket) {
    this.socket = socket;
    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.SYNC_PONG, (payload: SyncPongPayload) => {
      const t3 = Date.now();
      const t0 = payload.clientTimeMs;
      const t1 = payload.serverTimeMs;
      const t2 = payload.serverTimeMs;

      const { offset, rtt } = calculateNtpOffset(t0, t1, t2, t3);
      this.pendingSamples.push({ t0, t1, t2, t3, rtt, offset });

      // Nếu đã đủ mẫu ban đầu hoặc chỉ là một lần đo định kỳ
      const best = selectBestNtpSample(this.pendingSamples);
      if (best) {
        this.offsetMs = best.offset;
        this.lastRttMs = best.rtt;
      }
    });
  }

  /** Bắt đầu chu trình đo: 5 mẫu liên tiếp ban đầu, sau đó 10s một lần */
  public start() {
    this.stop();
    this.pendingSamples = [];

    // Bắn 5 mẫu liên tiếp cách nhau 200ms
    let count = 0;
    const initialTimer = setInterval(() => {
      this.sendPing();
      count++;
      if (count >= CONFIG.CLOCK_SYNC_INITIAL_SAMPLES) {
        clearInterval(initialTimer);
      }
    }, 200);

    // Chu kỳ định kỳ mỗi 10 giây
    this.syncInterval = setInterval(() => {
      this.pendingSamples = [];
      this.sendPing();
    }, CONFIG.CLOCK_SYNC_INTERVAL_MS);
  }

  public sendPing() {
    if (this.socket && this.socket.connected) {
      this.socket.emit(SOCKET_EVENTS.SYNC_PING, {
        clientTimeMs: Date.now(),
      });
    }
  }

  public stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /** Lấy thời gian server ước tính hiện tại */
  public nowServerTime(): number {
    return Date.now() + this.offsetMs;
  }

  public getOffsetMs(): number {
    return this.offsetMs;
  }

  public getRttMs(): number {
    return this.lastRttMs;
  }
}
