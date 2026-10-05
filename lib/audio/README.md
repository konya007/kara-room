# Voice Audio Modules (`lib/audio/`)

Thư mục này phụ trách toàn bộ việc thu âm và biến đổi âm thanh giọng hát trên trình duyệt của người hát (Web Audio API DSP).

## Cấu trúc:
1. `presets.ts`: Định nghĩa các cấu hình preset (Tắt, Phòng thu, Quán karaoke, Sân khấu) và giao diện `VoiceSettings`.
2. `reverb.ts`: Thuật toán sinh xung đáp ứng (Impulse Response) ngẫu nhiên cho `ConvolverNode` mà không cần tải file WAV bên ngoài.
3. `voice-chain.ts`:
   - Lấy microphone từ thiết bị với các tính năng lọc tự động (`echoCancellation`, `noiseSuppression`, `autoGainControl`) đều **tắt**, giữ trọn vẹn chất âm và âm sắc tự nhiên.
   - Chuỗi xử lý nối tiếp: Input Gain → High-Pass Filter (cắt ù rền) → 3-Band Parametric EQ → Compressor (nén dải động) → Echo Module (Delay + Feedback) → Reverb Module.
   - Tách làm hai nhánh:
     - **Local Monitor**: Phản hồi trực tiếp ra tai nghe của chính người hát với độ trễ tối thiểu (zero network latency).
     - **MediaStreamDestination**: Đưa luồng âm đã qua xử lý sang WebRTC để truyền đến các thành viên khác trong phòng.
   - Thống kê tỷ lệ hoạt động của giọng hát (`voiceActiveRatio`) để gửi về server làm căn cứ chấm điểm.
