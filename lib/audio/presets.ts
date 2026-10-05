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
}

export type PresetKey = "off" | "studio" | "karaoke" | "stage";

export const VOICE_PRESETS: Record<PresetKey, { name: string; settings: Omit<VoiceSettings, "monitorEnabled"> }> = {
  off: {
    name: "Tắt hiệu ứng",
    settings: {
      inputGain: 1.0,
      highPassFreq: 80,
      lowGain: 0,
      midGain: 0,
      highGain: 0,
      echoDelaySec: 0.15,
      echoFeedback: 0,
      echoWet: 0,
      reverbWet: 0,
      outputGain: 1.0,
    },
  },
  studio: {
    name: "Phòng thu",
    settings: {
      inputGain: 1.0,
      highPassFreq: 80,
      lowGain: -1,
      midGain: 1,
      highGain: 2,
      echoDelaySec: 0.12,
      echoFeedback: 0.1,
      echoWet: 0.05,
      reverbWet: 0.15,
      outputGain: 1.0,
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
      echoDelaySec: 0.22,
      echoFeedback: 0.35,
      echoWet: 0.3,
      reverbWet: 0.35,
      outputGain: 1.0,
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
      echoDelaySec: 0.28,
      echoFeedback: 0.45,
      echoWet: 0.4,
      reverbWet: 0.5,
      outputGain: 1.0,
    },
  },
};
