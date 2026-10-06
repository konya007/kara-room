/**
 * KaraRoom - Chuỗi xử lý âm thanh Web Audio API chuyên nghiệp cho giọng hát (Vocal DSP Chain).
 * Mic -> Input Gain -> High-pass -> EQ 3 dải -> Compressor -> Echo -> Reverb -> Output Gain
 * -> Tách 2 nhánh: Local Monitor (tai nghe) và MediaStreamDestination (WebRTC truyền đi).
 */

import { VoiceSettings, VOICE_PRESETS } from "./presets";
import { createSyntheticImpulseResponse } from "./reverb";

export class VoiceProcessingChain {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // Các Node trong chuỗi DSP
  private inputGainNode: GainNode | null = null;
  private highPassNode: BiquadFilterNode | null = null;
  private lowEqNode: BiquadFilterNode | null = null;
  private midEqNode: BiquadFilterNode | null = null;
  private highEqNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;

  // Khối Echo
  private echoDelayNode: DelayNode | null = null;
  private echoFeedbackNode: GainNode | null = null;
  private echoWetNode: GainNode | null = null;

  // Khối Reverb
  private reverbConvolverNode: ConvolverNode | null = null;
  private reverbWetNode: GainNode | null = null;

  // Khối Master Output và Phân nhánh
  private dryGainNode: GainNode | null = null;
  private outputGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  // Thống kê hoạt động giọng hát cho chấm điểm
  private activeSamples = 0;
  private totalSamples = 0;
  private activityInterval: NodeJS.Timeout | null = null;

  private currentSettings: VoiceSettings = {
    ...VOICE_PRESETS.karaoke.settings,
    monitorEnabled: false,
  };

  /**
   * Khởi tạo AudioContext và chuỗi xử lý từ micro.
   * echoCancellation, noiseSuppression, autoGainControl đều TẮT để giữ nguyên dải động giọng hát.
   */
  public async init(deviceId?: string): Promise<MediaStream> {
    this.destroy();

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: "interactive" });

    // Yêu cầu luồng âm thanh nguyên bản không bị filter méo tiếng và tối ưu độ trễ phần cứng
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000,
        ...({ latency: 0 } as Record<string, unknown>),
      },
      video: false,
    };

    this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.sourceNode = this.ctx.createMediaStreamSource(this.micStream);

    // 1. Input Gain
    this.inputGainNode = this.ctx.createGain();
    this.inputGainNode.gain.value = this.currentSettings.inputGain;

    // 2. High-pass Filter (Cắt tần số thấp gây ù mic: 80 - 120Hz)
    this.highPassNode = this.ctx.createBiquadFilter();
    this.highPassNode.type = "highpass";
    this.highPassNode.frequency.value = this.currentSettings.highPassFreq;

    // 3. EQ 3 dải (Low Shelf, Peaking Mid, High Shelf)
    this.lowEqNode = this.ctx.createBiquadFilter();
    this.lowEqNode.type = "lowshelf";
    this.lowEqNode.frequency.value = 320;
    this.lowEqNode.gain.value = this.currentSettings.lowGain;

    this.midEqNode = this.ctx.createBiquadFilter();
    this.midEqNode.type = "peaking";
    this.midEqNode.frequency.value = 2500;
    this.midEqNode.Q.value = 1.0;
    this.midEqNode.gain.value = this.currentSettings.midGain;

    this.highEqNode = this.ctx.createBiquadFilter();
    this.highEqNode.type = "highshelf";
    this.highEqNode.frequency.value = 8000;
    this.highEqNode.gain.value = this.currentSettings.highGain;

    // 4. Dynamics Compressor (Ổn định âm lượng, tránh vỡ tiếng khi hét lớn)
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -24;
    this.compressorNode.knee.value = 12;
    this.compressorNode.ratio.value = 4;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;

    // 5. Khối Echo (Delay + Feedback)
    this.echoDelayNode = this.ctx.createDelay(1.0);
    this.echoDelayNode.delayTime.value = this.currentSettings.echoDelaySec;
    this.echoFeedbackNode = this.ctx.createGain();
    this.echoFeedbackNode.gain.value = this.currentSettings.echoFeedback;
    this.echoWetNode = this.ctx.createGain();
    this.echoWetNode.gain.value = this.currentSettings.echoWet;

    // 6. Khối Reverb (ConvolverNode với xung tự sinh)
    this.reverbConvolverNode = this.ctx.createConvolver();
    this.reverbConvolverNode.buffer = createSyntheticImpulseResponse(this.ctx);
    this.reverbWetNode = this.ctx.createGain();
    this.reverbWetNode.gain.value = this.currentSettings.reverbWet;

    // 7. Nhánh Dry và Master Output
    this.dryGainNode = this.ctx.createGain();
    this.dryGainNode.gain.value = 1.0;

    this.outputGainNode = this.ctx.createGain();
    this.outputGainNode.gain.value = this.currentSettings.outputGain;

    // 8. Analyser để đo mức âm hiển thị UI
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.4;

    // 9. Hai nhánh đích: Monitor và WebRTC Destination
    this.monitorGainNode = this.ctx.createGain();
    this.monitorGainNode.gain.value = this.currentSettings.monitorEnabled ? 1.0 : 0.0;

    this.destinationNode = this.ctx.createMediaStreamDestination();

    // NỐI DÂY CÁC NODE (ROUTING)
    // Mic -> InputGain -> Highpass -> LowEQ -> MidEQ -> HighEQ -> Compressor
    this.sourceNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.highPassNode);
    this.highPassNode.connect(this.lowEqNode);
    this.lowEqNode.connect(this.midEqNode);
    this.midEqNode.connect(this.highEqNode);
    this.highEqNode.connect(this.compressorNode);

    // Tách từ Compressor ra 3 nhánh: Dry, Echo, Reverb
    this.compressorNode.connect(this.dryGainNode);

    // Nhánh Echo
    this.compressorNode.connect(this.echoDelayNode);
    this.echoDelayNode.connect(this.echoFeedbackNode);
    this.echoFeedbackNode.connect(this.echoDelayNode); // Loop feedback
    this.echoDelayNode.connect(this.echoWetNode);

    // Nhánh Reverb
    this.compressorNode.connect(this.reverbConvolverNode);
    this.reverbConvolverNode.connect(this.reverbWetNode);

    // Gộp Dry + Echo + Reverb -> OutputGain
    this.dryGainNode.connect(this.outputGainNode);
    this.echoWetNode.connect(this.outputGainNode);
    this.reverbWetNode.connect(this.outputGainNode);

    // OutputGain -> Analyser
    this.outputGainNode.connect(this.analyserNode);

    // Từ Analyser chia thành:
    // Nhánh 1: Monitor ra tai nghe người hát (ctx.destination)
    this.analyserNode.connect(this.monitorGainNode);
    this.monitorGainNode.connect(this.ctx.destination);

    // Nhánh 2: MediaStreamDestination (luồng truyền qua WebRTC)
    this.analyserNode.connect(this.destinationNode);

    this.startActivityTracker();

    return this.destinationNode.stream;
  }

  /** Áp dụng cài đặt hiệu ứng mới */
  public applySettings(patch: Partial<VoiceSettings>) {
    this.currentSettings = { ...this.currentSettings, ...patch };

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (patch.inputGain !== undefined && this.inputGainNode) {
      this.inputGainNode.gain.setTargetAtTime(patch.inputGain, now, 0.02);
    }
    if (patch.highPassFreq !== undefined && this.highPassNode) {
      this.highPassNode.frequency.setTargetAtTime(patch.highPassFreq, now, 0.02);
    }
    if (patch.lowGain !== undefined && this.lowEqNode) {
      this.lowEqNode.gain.setTargetAtTime(patch.lowGain, now, 0.02);
    }
    if (patch.midGain !== undefined && this.midEqNode) {
      this.midEqNode.gain.setTargetAtTime(patch.midGain, now, 0.02);
    }
    if (patch.highGain !== undefined && this.highEqNode) {
      this.highEqNode.gain.setTargetAtTime(patch.highGain, now, 0.02);
    }
    if (patch.echoDelaySec !== undefined && this.echoDelayNode) {
      this.echoDelayNode.delayTime.setTargetAtTime(patch.echoDelaySec, now, 0.02);
    }
    if (patch.echoFeedback !== undefined && this.echoFeedbackNode) {
      this.echoFeedbackNode.gain.setTargetAtTime(patch.echoFeedback, now, 0.02);
    }
    if (patch.echoWet !== undefined && this.echoWetNode) {
      this.echoWetNode.gain.setTargetAtTime(patch.echoWet, now, 0.02);
    }
    if (patch.reverbWet !== undefined && this.reverbWetNode) {
      this.reverbWetNode.gain.setTargetAtTime(patch.reverbWet, now, 0.02);
    }
    if (patch.outputGain !== undefined && this.outputGainNode) {
      this.outputGainNode.gain.setTargetAtTime(patch.outputGain, now, 0.02);
    }
    if (patch.monitorEnabled !== undefined && this.monitorGainNode) {
      this.monitorGainNode.gain.setTargetAtTime(patch.monitorEnabled ? 1.0 : 0.0, now, 0.02);
    }
  }

  /** Lấy mức âm lượng hiện tại (0.0 đến 1.0) cho vòng sáng avatar & đồng hồ đo */
  public getVolumeLevel(): number {
    if (!this.analyserNode) return 0;
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const average = sum / data.length;
    return Math.min(1.0, average / 128);
  }

  /** Đặt lại thống kê giọng hát khi bắt đầu bài mới */
  public resetActivityStats() {
    this.activeSamples = 0;
    this.totalSamples = 0;
  }

  /** Lấy tỉ lệ thời gian người hát phát ra âm thanh (0.0 - 1.0) để gửi server chấm điểm */
  public getVoiceActivityRatio(): number {
    if (this.totalSamples === 0) return 0.5;
    return Math.min(1.0, Math.max(0.0, this.activeSamples / this.totalSamples));
  }

  private startActivityTracker() {
    if (this.activityInterval) clearInterval(this.activityInterval);
    this.activityInterval = setInterval(() => {
      const vol = this.getVolumeLevel();
      this.totalSamples++;
      if (vol > 0.05) {
        this.activeSamples++;
      }
    }, 200);
  }

  public getSettings(): VoiceSettings {
    return { ...this.currentSettings };
  }

  public getStream(): MediaStream | null {
    return this.destinationNode ? this.destinationNode.stream : null;
  }

  public destroy() {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
