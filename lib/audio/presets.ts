/**
 * KaraRoom - Danh sách Preset hiệu ứng giọng hát.
 * Người dùng có thể chọn nhanh: Tắt, Phòng thu, Quán karaoke, Sân khấu.
 */

export interface VoiceSettings {
  inputGain: number; // 0.0 - 2.0 (mặc định 1.0)
  highPassFreq: number; // 20 - 200 Hz
  lowGain: number; // -12 đến +12 dB
  midGain: number; // -12 đến +12 dB
  highGain: number; // -12 đến +12 dB
  echoDelaySec: number; // 0.05 - 0.5s
  echoFeedback: number; // 0.0 - 0.7
  echoWet: number; // 0.0 - 1.0 (mức vang vọng)
  reverbWet: number; // 0.0 - 1.0 (mức vang không gian)
  outputGain: number; // 0.0 - 2.0
  monitorEnabled: boolean; // Nghe giọng bản thân (True / False)
  noiseSuppression: boolean; // Chống ồn / lọc tạp âm AI
  echoCancellation: boolean; // Chống hú / khử tiếng vọng loa ngoài
  voiceEnhance: boolean; // Tăng cường độ rõ & nội lực giọng hát
  noiseGateEnabled: boolean; // Cổng cắt ồn thông minh khi im lặng
}

export type PresetKey = "off" | "zeroDelay" | "studio" | "karaoke" | "stage";

export const VOICE_PRESETS: Record<PresetKey, { name: string; settings: Omit<VoiceSettings, "monitorEnabled"> }> = {
  off: {
    name: "Tắt hiệu ứng",
    settings: {
      inputGain: 1.0,
      highPassFreq: 80,
      lowGain: 0,
      midGain: 0,
      highGain: 0,
      echoDelaySec: 0.1,
      echoFeedback: 0,
      echoWet: 0,
      reverbWet: 0,
      outputGain: 1.0,
      noiseSuppression: false,
      echoCancellation: false,
      voiceEnhance: false,
      noiseGateEnabled: false,
    },
  },
  zeroDelay: {
    name: "Siêu tốc (0 Trễ)",
    settings: {
      inputGain: 1.15,
      highPassFreq: 90,
      lowGain: 0,
      midGain: 2,
      highGain: 3,
      echoDelaySec: 0.05, // Cực ngắn
      echoFeedback: 0, // Tắt hoàn toàn lặp lại
      echoWet: 0, // Tắt echo delay hoàn toàn để 0 trễ tuyệt đối
      reverbWet: 0.08, // Không gian nhẹ, mượt mà
      outputGain: 1.0,
      noiseSuppression: true,
      echoCancellation: true,
      voiceEnhance: true,
      noiseGateEnabled: true,
    },
  },
  studio: {
    name: "Phòng thu",
    settings: {
      inputGain: 1.05,
      highPassFreq: 80,
      lowGain: -1,
      midGain: 1.5,
      highGain: 2.5,
      echoDelaySec: 0.1,
      echoFeedback: 0.1,
      echoWet: 0.05,
      reverbWet: 0.18,
      outputGain: 1.0,
      noiseSuppression: true,
      echoCancellation: true,
      voiceEnhance: true,
      noiseGateEnabled: true,
    },
  },
  karaoke: {
    name: "Quán karaoke",
    settings: {
      inputGain: 1.0,
      highPassFreq: 100,
      lowGain: 2,
      midGain: 1,
      highGain: 3,
      echoDelaySec: 0.16, // Giảm từ 0.22s xuống 0.16s để hạn chế cảm giác trễ tiếng
      echoFeedback: 0.25,
      echoWet: 0.2,
      reverbWet: 0.3,
      outputGain: 1.0,
      noiseSuppression: true,
      echoCancellation: true,
      voiceEnhance: true,
      noiseGateEnabled: true,
    },
  },
  stage: {
    name: "Sân khấu",
    settings: {
      inputGain: 1.1,
      highPassFreq: 120,
      lowGain: 1,
      midGain: 2,
      highGain: 4,
      echoDelaySec: 0.2,
      echoFeedback: 0.35,
      echoWet: 0.3,
      reverbWet: 0.4,
      outputGain: 1.0,
      noiseSuppression: true,
      echoCancellation: true,
      voiceEnhance: true,
      noiseGateEnabled: true,
    },
  },
};
