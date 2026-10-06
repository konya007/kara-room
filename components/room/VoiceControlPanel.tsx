/**
 * KaraRoom - Bảng điều khiển hiệu ứng giọng hát và đồng bộ (VoiceControlPanel).
 * Chọn mic, đo mức âm, các preset (Siêu tốc 0 trễ, Phòng thu, Karaoke, Sân khấu),
 * Cơ chế Chống ồn AI & Cổng cắt ồn Noise Gate, Tăng cường giọng hát Vocal Enhancer,
 * Chống hú Echo Cancellation, Tinh chỉnh Echo Delay, và 2 thanh âm lượng riêng.
 */

import React, { useEffect, useState } from "react";
import {
  Mic,
  Volume2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Zap,
  Sliders,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Slider } from "../ui/Slider";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { VoiceSettings, VOICE_PRESETS, PresetKey } from "../../lib/audio/presets";

interface VoiceControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  voiceSettings: VoiceSettings;
  musicVolume: number;
  vocalVolume: number;
  manualOffsetMs: number;
  currentMicVolumeLevel: number; // 0.0 - 1.0
  onUpdateVoiceSettings: (patch: Partial<VoiceSettings>) => void;
  onUpdateMusicVolume: (vol: number) => void;
  onUpdateVocalVolume: (vol: number) => void;
  onUpdateManualOffset: (offsetMs: number) => void;
  onChangeMicDevice?: (deviceId: string) => void;
}

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({
  isOpen,
  onClose,
  voiceSettings,
  musicVolume,
  vocalVolume,
  manualOffsetMs,
  currentMicVolumeLevel,
  onUpdateVoiceSettings,
  onUpdateMusicVolume,
  onUpdateVocalVolume,
  onUpdateManualOffset,
  onChangeMicDevice,
}) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [activePreset, setActivePreset] = useState<PresetKey | "custom">("zeroDelay");

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devs) => {
          const audioInputs = devs.filter((d) => d.kind === "audioinput");
          setDevices(audioInputs);
          if (audioInputs[0] && !selectedDeviceId) {
            setSelectedDeviceId(audioInputs[0].deviceId);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSelectPreset = (key: PresetKey) => {
    setActivePreset(key);
    onUpdateVoiceSettings(VOICE_PRESETS[key].settings);
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Cài đặt Âm thanh & Giọng hát">
      <div className="space-y-6 text-[14px]">
        {/* 1. Mẹo tối ưu độ trễ */}
        <div className="p-3.5 rounded-[12px] bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[12px] flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-[var(--accent)]">Mẹo loại bỏ cảm giác trễ tiếng:</span>
            <p className="text-[var(--text-muted)] leading-relaxed">
              Hãy chọn preset <strong>Siêu tốc (0 Trễ)</strong> và cắm tai nghe có dây. Tránh tai nghe Bluetooth để không bị trễ âm thanh phần cứng (150-300ms).
            </p>
          </div>
        </div>

        {/* 2. Chọn Micro và Đồng hồ mức âm */}
        <div className="space-y-3">
          <label className="text-[13px] font-semibold text-[var(--text)] flex items-center gap-1.5">
            <Mic className="w-4 h-4 text-[var(--live)]" /> Thiết bị Microphone
          </label>
          {devices.length > 0 ? (
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                if (onChangeMicDevice) onChangeMicDevice(e.target.value);
              }}
              className="w-full h-11 bg-[var(--surface-raised)] text-[var(--text)] text-[13px] rounded-[8px] border border-[var(--border)] px-3 focus:outline-none focus:border-[var(--accent)]"
            >
              {devices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Microphone ${idx + 1}`}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[12px] text-[var(--text-muted)]">Đang dùng Microphone mặc định</p>
          )}

          {/* Đồng hồ mức âm mic thời gian thực */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
              <span>Mức tín hiệu mic:</span>
              <span className="font-mono-tabular font-bold">
                {Math.round(currentMicVolumeLevel * 100)}%
              </span>
            </div>
            <div className="h-2 w-full bg-[var(--surface-raised)] rounded-full overflow-hidden border border-[var(--border)]">
              <div
                className="h-full bg-[var(--live)] transition-all duration-75"
                style={{ width: `${Math.min(100, currentMicVolumeLevel * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. Monitor: Nghe giọng bản thân */}
        <div className="p-3.5 rounded-[12px] bg-[var(--surface-raised)] border border-[var(--border)] space-y-2">
          <Toggle
            checked={voiceSettings.monitorEnabled}
            onChange={(checked) => onUpdateVoiceSettings({ monitorEnabled: checked })}
            label="Nghe giọng bản thân (Local Monitor)"
            description="Phản hồi trực tiếp không trễ vào tai nghe"
          />
          {voiceSettings.monitorEnabled && (
            <div className="flex items-start gap-2 p-2 bg-[var(--bg)]/80 rounded-[8px] border border-[var(--score)]/40 text-[12px] text-[var(--score)]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Lưu ý:</strong> Hãy đeo tai nghe có dây. Dùng loa ngoài sẽ gây hú mic, dùng tai nghe Bluetooth sẽ bị trễ âm thanh.
              </span>
            </div>
          )}
        </div>

        {/* 4. Preset hiệu ứng giọng */}
        <div className="space-y-2.5">
          <label className="text-[13px] font-semibold text-[var(--text)] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" /> Preset hiệu ứng giọng
            </span>
            {activePreset === "zeroDelay" && (
              <span className="text-[11px] font-semibold text-[var(--accent)] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                Khuyên dùng
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(VOICE_PRESETS) as PresetKey[]).map((key) => {
              const isSelected = activePreset === key;
              const isZero = key === "zeroDelay";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`py-2 px-2.5 rounded-[8px] border text-[12.5px] font-medium transition-all cursor-pointer text-center relative flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? "bg-[var(--accent)] text-[var(--bg)] font-bold border-transparent shadow-sm"
                      : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {isZero && <Zap className="w-3.5 h-3.5 shrink-0" />}
                  <span>{VOICE_PRESETS[key].name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Cơ chế Chống ồn & Tăng cường giọng nói */}
        <div className="p-3.5 rounded-[12px] bg-[var(--surface-raised)] border border-[var(--border)] space-y-3">
          <div className="flex items-center gap-1.5 pb-1 border-b border-[var(--border)]">
            <ShieldCheck className="w-4 h-4 text-[var(--score)]" />
            <span className="text-[13px] font-semibold text-[var(--text)]">
              Chống ồn & Tăng cường giọng hát
            </span>
          </div>

          <Toggle
            checked={Boolean(voiceSettings.noiseSuppression)}
            onChange={(checked) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ noiseSuppression: checked });
            }}
            label="Khử ồn & Tạp âm AI"
            description="Lọc sạch tiếng quạt, gió, ù nền và tạp âm phòng"
          />

          <Toggle
            checked={Boolean(voiceSettings.echoCancellation)}
            onChange={(checked) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ echoCancellation: checked });
            }}
            label="Chống hú & Khử tiếng vọng loa"
            description="Ngăn âm thanh loa dội ngược lại micro"
          />

          <Toggle
            checked={Boolean(voiceSettings.voiceEnhance)}
            onChange={(checked) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ voiceEnhance: checked });
            }}
            label="Tăng cường giọng hát (Vocal Presence)"
            description="Nâng dải 3.5kHz giúp giọng hát sáng, dày và nổi bật"
          />

          <Toggle
            checked={Boolean(voiceSettings.noiseGateEnabled)}
            onChange={(checked) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ noiseGateEnabled: checked });
            }}
            label="Cổng cắt ồn thông minh (Noise Gate)"
            description="Tự động ngắt mic khi ngừng hát, triệt tiêu tiếng thở và xì nền"
          />
        </div>

        {/* 6. Các núm chỉnh chi tiết */}
        <div className="space-y-4 pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5 pb-1 text-[13px] font-semibold text-[var(--text)]">
            <Sliders className="w-4 h-4 text-[var(--accent)]" /> Tinh chỉnh hiệu ứng
          </div>

          <Slider
            label="Độ trễ lặp lại vang (Echo Delay)"
            valueDisplay={`${Math.round(voiceSettings.echoDelaySec * 1000)} ms`}
            value={voiceSettings.echoDelaySec * 1000}
            min={50}
            max={350}
            step={10}
            onChange={(v) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ echoDelaySec: v / 1000 });
            }}
          />

          <Slider
            label="Độ vang lặp lại (Echo Wet)"
            valueDisplay={`${Math.round(voiceSettings.echoWet * 100)}%`}
            value={voiceSettings.echoWet * 100}
            min={0}
            max={80}
            onChange={(v) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ echoWet: v / 100 });
            }}
          />

          <Slider
            label="Độ vang không gian (Reverb Wet)"
            valueDisplay={`${Math.round(voiceSettings.reverbWet * 100)}%`}
            value={voiceSettings.reverbWet * 100}
            min={0}
            max={80}
            onChange={(v) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ reverbWet: v / 100 });
            }}
          />

          <Slider
            label="Âm cao (High EQ)"
            valueDisplay={`${voiceSettings.highGain > 0 ? "+" : ""}${voiceSettings.highGain} dB`}
            value={voiceSettings.highGain}
            min={-8}
            max={8}
            onChange={(v) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ highGain: v });
            }}
          />

          <Slider
            label="Âm trung (Mid EQ)"
            valueDisplay={`${voiceSettings.midGain > 0 ? "+" : ""}${voiceSettings.midGain} dB`}
            value={voiceSettings.midGain}
            min={-8}
            max={8}
            onChange={(v) => {
              setActivePreset("custom");
              onUpdateVoiceSettings({ midGain: v });
            }}
          />
        </div>

        {/* 7. Hai thanh âm lượng riêng: Nhạc & Giọng */}
        <div className="space-y-4 pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.5 pb-1 text-[13px] font-semibold text-[var(--text)]">
            <Volume2 className="w-4 h-4 text-[var(--accent)]" /> Âm lượng & Bù trễ
          </div>

          <Slider
            label="Âm lượng nhạc nền"
            valueDisplay={`${Math.round(musicVolume * 100)}%`}
            value={musicVolume * 100}
            min={0}
            max={100}
            onChange={(v) => onUpdateMusicVolume(v / 100)}
          />

          <Slider
            label="Âm lượng giọng hát phòng"
            valueDisplay={`${Math.round(vocalVolume * 100)}%`}
            value={vocalVolume * 100}
            min={0}
            max={150}
            onChange={(v) => onUpdateVocalVolume(v / 100)}
          />

          <Slider
            label="Chỉnh lệch cá nhân (Khán giả)"
            valueDisplay={`${manualOffsetMs > 0 ? "+" : ""}${manualOffsetMs} ms`}
            value={manualOffsetMs}
            min={-500}
            max={500}
            step={20}
            onChange={onUpdateManualOffset}
          />
        </div>

        <Button fullWidth variant="primary" size="lg" onClick={onClose}>
          Hoàn tất
        </Button>
      </div>
    </Drawer>
  );
};
