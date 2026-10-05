/**
 * KaraRoom - Tự sinh xung đáp ứng (Synthetic Impulse Response) cho ConvolverNode.
 * Không cần tải thêm file WAV ngoài, giúp tạo hiệu ứng vang (Reverb) tự nhiên và tức thì.
 */

export function createSyntheticImpulseResponse(
  ctx: AudioContext,
  durationSec: number = 2.0,
  decay: number = 2.5
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i / length;
    // Hàm phân rã hàm mũ (Exponential decay) tạo không gian phòng vang
    const factor = Math.pow(1 - n, decay);
    // Tiếng ồn trắng ngẫu nhiên cho kênh trái và phải
    left[i] = (Math.random() * 2 - 1) * factor;
    right[i] = (Math.random() * 2 - 1) * factor;
  }

  return impulse;
}
