import { describe, it, expect } from "vitest";
import { calculateNtpOffset, selectBestNtpSample, NtpSample } from "../lib/sync/clock";
import { calculateTargetPositionSec } from "../lib/sync/timeline";
import { decideDriftAction, findClosestRate } from "../lib/sync/drift";

describe("NTP Clock Sync Pure Math", () => {
  it("tính chính xác độ lệch offset và RTT từ 4 mốc thời gian", () => {
    // t0=1000 (client gửi), t1=1050 (server nhận), t2=1050 (server gửi), t3=1100 (client nhận)
    // RTT = 1100 - 1000 - 0 = 100ms
    // offset = ((1050 - 1000) + (1050 - 1100)) / 2 = (50 - 50) / 2 = 0ms
    const { offset, rtt } = calculateNtpOffset(1000, 1050, 1050, 1100);
    expect(rtt).toBe(100);
    expect(offset).toBe(0);

    // Khi server nhanh hơn client 200ms
    // t0=1000, t1=1250, t2=1250, t3=1100
    // offset = ((1250 - 1000) + (1250 - 1100)) / 2 = (250 + 150) / 2 = 200ms
    const res2 = calculateNtpOffset(1000, 1250, 1250, 1100);
    expect(res2.offset).toBe(200);
  });

  it("chọn mẫu có RTT nhỏ nhất trong danh sách mẫu", () => {
    const samples: NtpSample[] = [
      { t0: 0, t1: 50, t2: 50, t3: 150, rtt: 150, offset: 0 },
      { t0: 0, t1: 20, t2: 20, t3: 60, rtt: 60, offset: 0 }, // Tốt nhất
      { t0: 0, t1: 80, t2: 80, t3: 200, rtt: 200, offset: 0 },
    ];
    const best = selectBestNtpSample(samples);
    expect(best?.rtt).toBe(60);
  });
});

describe("Timeline & Target Position Math", () => {
  const mockTimeline = {
    videoId: "vid123",
    positionSec: 10,
    serverTimeMs: 10000,
    playing: true,
  };

  it("người hát (Singer) phát nhạc đúng thời gian thực của server không có delay", () => {
    // 5 giây sau (serverNowMs = 15000)
    const target = calculateTargetPositionSec({
      timeline: mockTimeline,
      serverNowMs: 15000,
      isSinger: true,
    });
    // 10s gốc + 5s trôi qua = 15s
    expect(target).toBe(15);
  });

  it("khán giả (Audience) phát nhạc trễ đúng AUDIENCE_DELAY_MS (mặc định 400ms)", () => {
    // 5 giây sau (serverNowMs = 15000), trễ 400ms = 0.4s
    const target = calculateTargetPositionSec({
      timeline: mockTimeline,
      serverNowMs: 15000,
      isSinger: false,
      audienceDelayMs: 400,
    });
    // 10s + (5s - 0.4s) = 14.6s
    expect(target).toBeCloseTo(14.6, 2);
  });

  it("khán giả có thể chỉnh lệch thủ công ±500ms", () => {
    // delay 400ms + manualOffset 100ms = 500ms (0.5s)
    const target = calculateTargetPositionSec({
      timeline: mockTimeline,
      serverNowMs: 15000,
      isSinger: false,
      audienceDelayMs: 400,
      manualOffsetMs: 100,
    });
    // 10s + (5s - 0.5s) = 14.5s
    expect(target).toBeCloseTo(14.5, 2);
  });
});

describe("Drift Correction Decision Logic", () => {
  it("bỏ qua khi độ lệch dưới 40ms", () => {
    // Lệch 20ms (0.02s)
    const action = decideDriftAction(10.0, 10.02, false);
    expect(action.type).toBe("none");
  });

  it("điều chỉnh tốc độ khi lệch vừa (40ms - 1500ms)", () => {
    // Player đang ở 10.0s, Đích là 10.3s (tụt 300ms) -> tăng tốc lên 1.25
    const action = decideDriftAction(10.0, 10.3, false, [0.5, 0.75, 1, 1.25, 1.5]);
    expect(action.type).toBe("rate");
    if (action.type === "rate") {
      expect(action.rate).toBe(1.25);
      expect(action.durationMs).toBeGreaterThan(400);
    }
  });

  it("gọi seekTo khi lệch quá lớn (>1500ms)", () => {
    // Lệch 3.0 giây
    const action = decideDriftAction(10.0, 13.0, false);
    expect(action.type).toBe("seek");
    if (action.type === "seek") {
      expect(action.targetSec).toBe(13.0);
    }
  });

  it("tìm tốc độ gần nhất trong danh sách hỗ trợ", () => {
    const rate = findClosestRate(1.2, [0.5, 0.75, 1, 1.25, 1.5]);
    expect(rate).toBe(1.25);
  });
});

import { mungeOpusSdp } from "../lib/rtc/transport";

describe("WebRTC Opus Low-Latency SDP Munging", () => {
  it("tinh chỉnh thông số Opus thành ptime=10, minptime=10, mono 48kHz, CBR", () => {
    const mockSdp = [
      "v=0",
      "m=audio 9 UDP/TLS/RTP/SAVPF 111",
      "a=rtpmap:111 opus/48000/2",
      "a=fmtp:111 minptime=10;useinbandfec=1",
    ].join("\r\n");

    const munged = mungeOpusSdp(mockSdp, 96000);
    expect(munged).toContain("minptime=10;ptime=10");
    expect(munged).toContain("stereo=0");
    expect(munged).toContain("maxplaybackrate=48000");
    expect(munged).toContain("cbr=1");
    expect(munged).toContain("maxaveragebitrate=96000");
  });
});
