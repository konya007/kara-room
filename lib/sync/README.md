# Synchronization Modules (`lib/sync/`)

Thư mục này giải quyết bài toán cốt lõi của KaraRoom: **đồng bộ nhạc YouTube và giọng hát WebRTC giữa người hát và khán giả**.

## Các thành phần:
1. `clock.ts`: Giao thức đồng bộ đồng hồ tương tự NTP. Lấy 5 mẫu ban đầu, chọn mẫu RTT thấp nhất để xác định `offset = serverTime - clientTime`. Định kỳ 10 giây đồng bộ lại.
2. `timeline.ts`: Hàm tính toán vị trí phát mong đợi (Target Position) cho YouTube Player.
   - **Người hát**: Phát nhạc đúng theo timeline của server (`offset = 0`), nghe giọng bản thân trực tiếp (Local Monitor) để không bị trễ mạng.
   - **Khán giả**: Phát nhạc trễ một khoảng `AUDIENCE_DELAY_MS` (mặc định 400ms) để chờ luồng giọng hát truyền qua WebRTC tới nơi. Hỗ trợ người dùng tinh chỉnh thủ công ±500ms.
   - `PlayerPositionInterpolator`: Nội suy vị trí giữa các nhịp đọc `getCurrentTime()` của YouTube IFrame.
3. `drift.ts`: Động cơ kiểm tra độ lệch mỗi 500ms:
   - Dưới 40ms: Bỏ qua (không gây nhiễu âm).
   - Lệch vừa: Tạm thời đổi `playbackRate` (lên 1.25 hoặc xuống 0.75) theo các nấc YouTube hỗ trợ, rồi trả về 1.0.
   - Lệch lớn (>1500ms): Gọi `seekTo`.
