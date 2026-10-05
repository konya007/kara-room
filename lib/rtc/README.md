# Voice Transport Modules (`lib/rtc/`)

Thư mục này chịu trách nhiệm truyền tải giọng hát theo thời gian thực giữa các thành viên qua WebRTC.

## Cấu trúc:
1. `VoiceTransport` (Interface):
   - Đóng gói các phương thức `publish()`, `unpublish()`, `handleSignal()`, `updateAudienceDelay()`, `getStats()`, `destroy()`.
   - Giúp ứng dụng độc lập với mô hình mạng: hiện tại dùng P2P thuần (`P2PVoiceTransport`), tương lai có thể nâng cấp lên SFU (Mediasoup / LiveKit) mà không cần chỉnh sửa logic ở các tầng trên.
2. `P2PVoiceTransport` (Implementation):
   - Mỗi người hát tạo kết nối P2P một chiều (Send-Only) tới từng khán giả trong phòng.
   - **SDP Munging**: Cấu hình Opus với `maxaveragebitrate=96000`, `useinbandfec=1` (Forward Error Correction), `usedtx=0` (tắt ngắt gói khi im lặng) nhằm đảm bảo tiếng hát ngân dài không bị cụt.
   - **Fix trình duyệt Chrome**: Gắn MediaStream nhận về vào một thẻ `<audio muted autoplay>` ngầm để Audio Context kích hoạt luồng dữ liệu.
   - **Bù trễ thông minh (Adaptive Delay Compensation)**: Phía khán giả lấy thống kê `getStats()` (RTT, Jitter buffer) rồi dùng `DelayNode` làm trễ thêm luồng giọng vừa đủ để tổng độ trễ khớp với độ trễ 400ms của video YouTube.
