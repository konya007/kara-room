/**
 * KaraRoom - Lớp truyền tải âm thanh giọng hát (VoiceTransport Interface & P2P Implementation).
 * Mỗi người hát mở kết nối P2P một chiều (Send-Only) tới các thành viên khác.
 * Phía người nghe áp dụng bù trễ bằng DelayNode để khớp hoàn hảo với YouTube Player (400ms).
 */

import { Socket } from "socket.io-client";
import { CONFIG } from "../../config";
import { SOCKET_EVENTS } from "../../shared/events";
import { RtcSignalPayload } from "../../shared/types";

export interface PeerLatencyStats {
  userId: string;
  rttMs: number;
  jitterBufferMs: number;
  estimatedLatencyMs: number;
  compensationDelayMs: number;
  iceState: RTCIceConnectionState;
}

export interface VoiceTransportEvents {
  onRemoteStreamAdded: (userId: string, stream: MediaStream) => void;
  onRemoteStreamRemoved: (userId: string) => void;
  onLatencyUpdate: (stats: PeerLatencyStats[]) => void;
}

export interface VoiceTransport {
  init(localUserId: string, socket: Socket, events: VoiceTransportEvents): void;
  publish(stream: MediaStream, targetUserIds: string[]): Promise<void>;
  unpublish(): void;
  updateAudienceDelay(delayMs: number): void;
  handleSignal(fromUserId: string, signal: RtcSignalPayload["signal"]): Promise<void>;
  onParticipantsChanged(allOnlineUserIds: string[], singerUserIds: string[]): void;
  getStats(): PeerLatencyStats[];
  getPeerStats(userId: string): PeerLatencyStats | null;
  measurePeerLatencyAsync(userId: string): Promise<PeerLatencyStats | null>;
  requestStream(targetUserId: string): void;
  setVocalVolume(volume: number): void;
  setIsSinger(isSinger: boolean): void;
  destroy(): void;
}

/** Đọc cấu hình ICE Servers từ biến môi trường hoặc dùng STUN công khai của Google */
export function getIceServers(): RTCIceServer[] {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ICE_SERVERS) {
    try {
      return JSON.parse(process.env.NEXT_PUBLIC_ICE_SERVERS);
    } catch {
      // Fallback nếu parse JSON lỗi
    }
  }
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
}

/** Tinh chỉnh SDP Opus: bitrate 96kbps, packet size 10ms (minptime=10;ptime=10), mono 48kHz, bật FEC (sửa lỗi), tắt DTX, CBR */
export function mungeOpusSdp(sdp: string, bitrate: number = CONFIG.OPUS_BITRATE): string {
  const lines = sdp.split("\r\n");
  let opusPayloadType: string | null = null;

  for (const line of lines) {
    if (line.includes("a=rtpmap:") && line.toLowerCase().includes("opus/48000")) {
      const parts = line.split(" ");
      opusPayloadType = parts[0].replace("a=rtpmap:", "");
      break;
    }
  }

  if (!opusPayloadType) return sdp;

  const modifiedLines = lines.map((line) => {
    if (line.startsWith(`a=fmtp:${opusPayloadType}`)) {
      return `${line};maxaveragebitrate=${bitrate};stereo=0;sprop-stereo=0;useinbandfec=1;usedtx=0;cbr=1;maxplaybackrate=48000;sprop-maxcapturerate=48000;minptime=10;ptime=10`;
    }
    return line;
  });

  return modifiedLines.join("\r\n");
}

interface RemoteAudioPipeline {
  stream: MediaStream;
  hiddenAudio: HTMLAudioElement;
  sourceNode: MediaStreamAudioSourceNode;
  delayNode: DelayNode;
  gainNode: GainNode;
  lastRttMs: number;
  lastJitterMs: number;
  iceState: RTCIceConnectionState;
}

export class P2PVoiceTransport implements VoiceTransport {
  private localUserId: string = "";
  private socket: Socket | null = null;
  private events: VoiceTransportEvents | null = null;
  private localStream: MediaStream | null = null;
  private isSinger: boolean = false;

  // Bản đồ PeerConnection: userId -> RTCPeerConnection
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  // Bản đồ Audio Pipeline phía khán giả
  private remotePipelines: Map<string, RemoteAudioPipeline> = new Map();

  private audioCtx: AudioContext | null = null;
  private audienceDelayMs: number = CONFIG.AUDIENCE_DELAY_MS;
  private statsInterval: NodeJS.Timeout | null = null;
  private vocalVolume: number = 1.0;

  public init(localUserId: string, socket: Socket, events: VoiceTransportEvents) {
    this.localUserId = localUserId;
    this.socket = socket;
    this.events = events;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextClass({ latencyHint: "interactive" });

    this.startStatsLoop();
  }

  public async publish(stream: MediaStream, targetUserIds: string[]): Promise<void> {
    this.localStream = stream;
    this.isSinger = true;

    for (const targetId of targetUserIds) {
      if (targetId === this.localUserId) continue;
      await this.createSenderPeer(targetId);
    }
  }

  public unpublish() {
    this.isSinger = false;
    this.localStream = null;

    // Đóng tất cả kết nối gửi
    for (const [targetId, pc] of this.peerConnections.entries()) {
      pc.close();
      this.peerConnections.delete(targetId);
    }
  }

  public updateAudienceDelay(delayMs: number) {
    this.audienceDelayMs = delayMs;
    if (!this.isSinger && this.audioCtx) {
      for (const pipeline of this.remotePipelines.values()) {
        if (pipeline.delayNode) {
          pipeline.delayNode.delayTime.setTargetAtTime(delayMs / 1000, this.audioCtx.currentTime, 0.08);
        }
      }
    }
  }

  public setIsSinger(isSinger: boolean) {
    this.isSinger = isSinger;
    if (this.audioCtx) {
      for (const pipeline of this.remotePipelines.values()) {
        if (pipeline.delayNode) {
          const delaySec = isSinger ? 0 : this.audienceDelayMs / 1000;
          pipeline.delayNode.delayTime.setTargetAtTime(delaySec, this.audioCtx.currentTime, 0.05);
        }
      }
    }
  }

  public setVocalVolume(volume: number) {
    this.vocalVolume = Math.max(0, Math.min(2, volume));
    for (const pipeline of this.remotePipelines.values()) {
      if (pipeline.gainNode && this.audioCtx) {
        pipeline.gainNode.gain.setTargetAtTime(this.vocalVolume, this.audioCtx.currentTime, 0.05);
      }
    }
  }

  public onParticipantsChanged(allOnlineUserIds: string[], singerUserIds: string[]) {
    // Nếu mình đang là ca sĩ, kết nối tới các thành viên mới chưa có PC
    if (this.isSinger && this.localStream) {
      for (const targetId of allOnlineUserIds) {
        if (targetId !== this.localUserId && !this.peerConnections.has(targetId)) {
          this.createSenderPeer(targetId).catch(() => {});
        }
      }
    }

    // Dọn dẹp các peer không còn online
    for (const [peerId, pc] of this.peerConnections.entries()) {
      if (!allOnlineUserIds.includes(peerId)) {
        pc.close();
        this.peerConnections.delete(peerId);
        this.cleanupRemotePipeline(peerId);
      }
    }
  }

  public requestStream(targetUserId: string) {
    if (this.socket && targetUserId !== this.localUserId) {
      this.socket.emit(SOCKET_EVENTS.RTC_SIGNAL, {
        targetUserId,
        signal: {
          type: "request-stream",
        },
      });
    }
  }

  public async handleSignal(fromUserId: string, signal: RtcSignalPayload["signal"]): Promise<void> {
    if (signal.type === "request-stream") {
      // Khi có người nghe yêu cầu luồng (vừa vào phòng hoặc vừa bật user gesture)
      if (this.isSinger && this.localStream) {
        await this.createSenderPeer(fromUserId);
      }
    } else if (signal.type === "offer") {
      await this.handleIncomingOffer(fromUserId, signal.sdp);
    } else if (signal.type === "answer") {
      const pc = this.peerConnections.get(fromUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: signal.sdp }));
      }
    } else if (signal.type === "candidate") {
      const pc = this.peerConnections.get(fromUserId);
      if (pc && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
      }
    }
  }

  // === KHỞI TẠO KẾT NỐI PHÍA NGƯỜI GỬI (SINGER -> AUDIENCE) ===
  private async createSenderPeer(targetUserId: string) {
    if (this.peerConnections.has(targetUserId)) {
      this.peerConnections.get(targetUserId)?.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: getIceServers(),
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    this.peerConnections.set(targetUserId, pc);

    // Gắn luồng mic local vào PeerConnection
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit(SOCKET_EVENTS.RTC_SIGNAL, {
          targetUserId,
          signal: {
            type: "candidate",
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    const offer = await pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });

    // Munge SDP cho Opus chất lượng cao
    const mungedSdp = mungeOpusSdp(offer.sdp || "");
    await pc.setLocalDescription(new RTCSessionDescription({ type: "offer", sdp: mungedSdp }));

    if (this.socket) {
      this.socket.emit(SOCKET_EVENTS.RTC_SIGNAL, {
        targetUserId,
        signal: {
          type: "offer",
          sdp: mungedSdp,
        },
      });
    }
  }

  // === TIẾP NHẬN KẾT NỐI PHÍA NGƯỜI NGHE (AUDIENCE) ===
  private async handleIncomingOffer(fromUserId: string, sdp: string) {
    let pc = this.peerConnections.get(fromUserId);
    if (pc) {
      pc.close();
    }

    pc = new RTCPeerConnection({
      iceServers: getIceServers(),
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    this.peerConnections.set(fromUserId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit(SOCKET_EVENTS.RTC_SIGNAL, {
          targetUserId: fromUserId,
          signal: {
            type: "candidate",
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    // Khi nhận được audio track từ ca sĩ
    pc.ontrack = (event) => {
      // Triệt tiêu bộ đệm Jitter Buffer của trình duyệt xuống mức tối thiểu (0-10ms)
      if (event.receiver) {
        if ("playoutDelayHint" in event.receiver) {
          event.receiver.playoutDelayHint = 0;
        }
        if ("jitterBufferTarget" in event.receiver) {
          (event.receiver as any).jitterBufferTarget = 0;
        }
      }
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      this.setupRemoteAudioPipeline(fromUserId, remoteStream);
      if (this.events) {
        this.events.onRemoteStreamAdded(fromUserId, remoteStream);
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
    const answer = await pc.createAnswer();
    const mungedAnswerSdp = mungeOpusSdp(answer.sdp || "");
    await pc.setLocalDescription(new RTCSessionDescription({ type: "answer", sdp: mungedAnswerSdp }));

    if (this.socket) {
      this.socket.emit(SOCKET_EVENTS.RTC_SIGNAL, {
        targetUserId: fromUserId,
        signal: {
          type: "answer",
          sdp: mungedAnswerSdp,
        },
      });
    }
  }

  /**
   * Thiết lập Audio Pipeline phía người nghe:
   * Chrome yêu cầu thẻ <audio muted> để WebRTC stream được kích hoạt,
   * sau đó đưa vào Web Audio DelayNode để bù đúng khoảng trễ 400ms (cho khán giả),
   * hoặc 0ms tức thời (cho ca sĩ hát cùng nhau).
   */
  private setupRemoteAudioPipeline(userId: string, stream: MediaStream) {
    this.cleanupRemotePipeline(userId);

    // Chrome Fix: Thẻ audio ẩn và mute để WebRTC audio pipeline kích hoạt
    const hiddenAudio = document.createElement("audio");
    hiddenAudio.srcObject = stream;
    hiddenAudio.muted = true;
    hiddenAudio.autoplay = true;
    hiddenAudio.play().catch(() => {});

    if (!this.audioCtx) return;

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    const sourceNode = this.audioCtx.createMediaStreamSource(stream);
    const delayNode = this.audioCtx.createDelay(2.0); // Tối đa trễ 2 giây
    // Bỏ toàn bộ độ trễ: Phát tức thì (0ms) khi là ca sĩ hoặc audienceDelayMs <= 0
    const initialDelaySec = (this.isSinger || this.audienceDelayMs <= 0) ? 0 : this.audienceDelayMs / 1000;
    delayNode.delayTime.value = initialDelaySec;

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.value = this.vocalVolume;

    sourceNode.connect(delayNode);
    delayNode.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    this.remotePipelines.set(userId, {
      stream,
      hiddenAudio,
      sourceNode,
      delayNode,
      gainNode,
      lastRttMs: 0,
      lastJitterMs: 0,
      iceState: "connected",
    });
  }

  private cleanupRemotePipeline(userId: string) {
    const pipeline = this.remotePipelines.get(userId);
    if (pipeline) {
      try {
        pipeline.hiddenAudio.pause();
        pipeline.hiddenAudio.srcObject = null;
        pipeline.hiddenAudio.remove();
        pipeline.sourceNode.disconnect();
        pipeline.delayNode.disconnect();
        pipeline.gainNode.disconnect();
      } catch {}
      this.remotePipelines.delete(userId);
      if (this.events) {
        this.events.onRemoteStreamRemoved(userId);
      }
    }
  }

  /**
   * Vòng lặp lấy getStats() định kỳ để tính toán RTT, jitter, và cập nhật delayTime cho DelayNode.
   */
  private startStatsLoop() {
    this.statsInterval = setInterval(async () => {
      const statsList: PeerLatencyStats[] = [];

      for (const [userId, pc] of this.peerConnections.entries()) {
        const pipeline = this.remotePipelines.get(userId);
        let rttMs = pipeline ? pipeline.lastRttMs : 0;
        let jitterMs = pipeline ? pipeline.lastJitterMs : 0;

        try {
          const stats = await pc.getStats();
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.state === "succeeded") {
              if (report.currentRoundTripTime !== undefined) {
                rttMs = Math.round(report.currentRoundTripTime * 1000);
              }
            }
            if (report.type === "inbound-rtp" && report.kind === "audio") {
              if (report.jitter !== undefined) {
                jitterMs = Math.round(report.jitter * 1000);
              }
            }
          });
        } catch {}

        // Ước lượng độ trễ luồng = RTT / 2 + Jitter Buffer + Thu/Mã hoá (40ms)
        const estimatedLatencyMs = Math.round(rttMs / 2 + jitterMs + CONFIG.ESTIMATED_CAPTURE_ENCODE_LATENCY_MS);
        // Phần còn thiếu cần bù bằng DelayNode:
        // - Bỏ toàn bộ độ trễ nhân tạo: 0ms cho cả ca sĩ và khán giả khi audienceDelayMs = 0
        const compensationDelayMs = (this.isSinger || this.audienceDelayMs <= 0)
          ? 0
          : Math.max(0, this.audienceDelayMs - estimatedLatencyMs);

        if (pipeline && this.audioCtx) {
          pipeline.lastRttMs = rttMs;
          pipeline.lastJitterMs = jitterMs;
          pipeline.iceState = pc.iceConnectionState;

          // Thay đổi delayTime mượt mà (0.08s) để không bị lụp bụp
          pipeline.delayNode.delayTime.setTargetAtTime(
            compensationDelayMs / 1000,
            this.audioCtx.currentTime,
            0.08
          );
        }

        statsList.push({
          userId,
          rttMs,
          jitterBufferMs: jitterMs,
          estimatedLatencyMs,
          compensationDelayMs,
          iceState: pc.iceConnectionState,
        });
      }

      if (this.events) {
        this.events.onLatencyUpdate(statsList);
      }
    }, CONFIG.RTC_STATS_INTERVAL_MS);
  }

  public getStats(): PeerLatencyStats[] {
    const stats: PeerLatencyStats[] = [];
    for (const [userId, pipeline] of this.remotePipelines.entries()) {
      const est = Math.round(pipeline.lastRttMs / 2 + pipeline.lastJitterMs + CONFIG.ESTIMATED_CAPTURE_ENCODE_LATENCY_MS);
      stats.push({
        userId,
        rttMs: pipeline.lastRttMs,
        jitterBufferMs: pipeline.lastJitterMs,
        estimatedLatencyMs: est,
        compensationDelayMs: (this.isSinger || this.audienceDelayMs <= 0) ? 0 : Math.max(0, this.audienceDelayMs - est),
        iceState: pipeline.iceState,
      });
    }
    return stats;
  }

  public getPeerStats(userId: string): PeerLatencyStats | null {
    const pipeline = this.remotePipelines.get(userId);
    const pc = this.peerConnections.get(userId);
    if (!pipeline) return null;
    const est = Math.round(pipeline.lastRttMs / 2 + pipeline.lastJitterMs + CONFIG.ESTIMATED_CAPTURE_ENCODE_LATENCY_MS);
    return {
      userId,
      rttMs: pipeline.lastRttMs,
      jitterBufferMs: pipeline.lastJitterMs,
      estimatedLatencyMs: est,
      compensationDelayMs: (this.isSinger || this.audienceDelayMs <= 0) ? 0 : Math.max(0, this.audienceDelayMs - est),
      iceState: pc ? pc.iceConnectionState : pipeline.iceState,
    };
  }

  public async measurePeerLatencyAsync(userId: string): Promise<PeerLatencyStats | null> {
    const pc = this.peerConnections.get(userId);
    const pipeline = this.remotePipelines.get(userId);
    if (!pc) return null;

    let rttMs = pipeline ? pipeline.lastRttMs : 0;
    let jitterMs = pipeline ? pipeline.lastJitterMs : 0;

    try {
      const stats = await pc.getStats();
      stats.forEach((report) => {
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          if (report.currentRoundTripTime !== undefined) {
            rttMs = Math.round(report.currentRoundTripTime * 1000);
          }
        }
        if (report.type === "inbound-rtp" && report.kind === "audio") {
          if (report.jitter !== undefined) {
            jitterMs = Math.round(report.jitter * 1000);
          }
        }
      });
    } catch {}

    const est = Math.round(rttMs / 2 + jitterMs + CONFIG.ESTIMATED_CAPTURE_ENCODE_LATENCY_MS);
    return {
      userId,
      rttMs,
      jitterBufferMs: jitterMs,
      estimatedLatencyMs: est,
      compensationDelayMs: (this.isSinger || this.audienceDelayMs <= 0) ? 0 : Math.max(0, this.audienceDelayMs - est),
      iceState: pc.iceConnectionState,
    };
  }

  public destroy() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();

    for (const userId of Array.from(this.remotePipelines.keys())) {
      this.cleanupRemotePipeline(userId);
    }

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
