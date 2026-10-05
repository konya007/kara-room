# KaraRoom 🎤🎶

**KaraRoom** là nền tảng phòng karaoke trực tuyến realtime dành cho nhóm bạn bè bè (tối đa 12 người/phòng). Hệ thống giải quyết bài toán khó nhất của karaoke trực tuyến: **đồng bộ giọng hát WebRTC với nhạc nền YouTube tại tai của từng người nghe với độ trễ thấp**.

---

## 1. Sơ đồ kiến trúc đồng bộ

Do YouTube IFrame API không cho phép xuất luồng âm thanh thô ra ngoài để trộn, hệ thống sử dụng kiến trúc hai kênh độc lập:

```
[Máy chủ KaraRoom (Socket.IO + Next.js)]
   ▲                          ▲
   │ NTP Clock Sync           │ Server-Authoritative Timeline
   │                          │ { videoId, positionSec, serverTimeMs, playing }
   ▼                          ▼
[Người hát (Singer)]        [Khán giả (Audience)]
• Nhạc YouTube: Phát đúng timeline       • Nhạc YouTube: Cố tình trễ AUDIENCE_DELAY_MS (400ms)
• Giọng bản thân: Local Monitor (0ms)     • Giọng người hát: Nhận qua WebRTC P2P
• Nhánh truyền: WebRTC Opus 96kbps       • Bù trễ WebRTC: DelayNode bù (400ms - RTT/2 - Jitter - 40ms)
                                         👉 Kết quả: Nhạc và giọng chạm tai cùng lúc!
```

### Cơ chế chống trôi (Drift Correction):
- Định kỳ **500ms** so sánh thời gian thực của player (`getCurrentTime()`) với vị trí đích.
- **Lệch < 40ms**: Bỏ qua hoàn toàn để âm thanh không bị giật.
- **Lệch vừa (40ms - 1500ms)**: Tự động đổi `playbackRate` lên 1.25 (nếu chậm) hoặc 0.75 (nếu nhanh) trong khoảng 0.4s - 2.5s rồi trả về 1.0.
- **Lệch lớn (> 1500ms)**: Thực hiện `seekTo`.

---

## 2. Cách chạy ứng dụng

### Yêu cầu:
- Node.js 20+ hoặc Docker.

### Chạy Local (Phát triển):
```bash
# 1. Cài đặt dependencies
npm install

# 2. Chạy server phát triển (Next.js + Socket.IO trên cùng port 3000)
npm run dev

# 3. Mở trình duyệt tại:
# http://localhost:3000 (Trang chủ)
# http://localhost:3000/styleguide (Trang kiểm tra Design System)
```

### Chạy bằng Docker:
```bash
# Khởi động với Docker Compose
docker compose up -d --build

# Xem log
docker compose logs -f
```

---

## 3. Biến môi trường

| Tên biến | Mặc định | Chú thích |
|---|---|---|
| `PORT` | `3000` | Cổng HTTP Server của ứng dụng |
| `NODE_ENV` | `development` / `production` | Chế độ chạy |
| `NEXT_PUBLIC_ICE_SERVERS` | Google STUN | Mảng JSON chứa STUN/TURN servers cho WebRTC |
| `GEMINI_API_KEY` | *(Tùy chọn)* | Khóa API Gemini phía server nếu dùng tiện ích mở rộng |

---

## 4. Cách dùng Bảng Debug để tinh chỉnh `AUDIENCE_DELAY_MS`

Truy cập phòng với tham số `?debug=1` (ví dụ: `http://localhost:3000/?room=ABC123&debug=1`).

Bảng HUD góc dưới bên phải sẽ hiển thị:
1. **NTP Offset**: Độ lệch đồng hồ giữa máy khách và máy chủ.
2. **Socket RTT**: Thời gian khứ hồi của mạng.
3. **Độ trôi Player**: Khoảng cách hiện tại giữa YouTube Player và vị trí chuẩn (màu xanh nếu < 40ms).
4. **Luồng WebRTC**:
   - `Trễ ước lượng`: Nửa RTT + Jitter Buffer + 40ms mã hóa.
   - `Bù trễ`: Thời gian trì hoãn mà `DelayNode` đang nạp thêm.

**Cách tinh chỉnh**:
- Nếu người nghe thấy giọng hát đến **trước** nhạc: Tăng thêm `AUDIENCE_DELAY_MS` trong `config.ts` hoặc dùng thanh trượt "Chỉnh lệch cá nhân" trên Bảng chỉnh giọng (+50ms đến +100ms).
- Nếu người nghe thấy giọng hát đến **sau** nhạc: Giảm `AUDIENCE_DELAY_MS` (hoặc mạng có RTT quá lớn so với ngưỡng trễ).

---

## 5. Quyết định kiến trúc & Lý do thêm thư viện

Theo đúng nguyên tắc "Không thêm thư viện khi vài chục dòng code tự viết là đủ", các thư viện được chọn lọc như sau:

| Thư viện | Lý do bắt buộc |
|---|---|
| `socket.io` & `socket.io-client` | Giao tiếp 2 chiều thời gian thực trên cùng HTTP server, tự động fallback polling nếu WebSocket bị chặn |
| `zod` | Xác thực dữ liệu đầu vào nghiêm ngặt từ client trước khi đưa vào hàm xử lý của phòng |
| `zustand` | State management cực nhẹ cho client, không gây re-render thừa thãi như Redux |
| `youtubei.js` | Tìm kiếm bài hát và lấy thông tin video YouTube trực tiếp không phụ thuộc quota Google API Console |
| `@dnd-kit/core` & `@dnd-kit/sortable` | Kéo thả đổi thứ tự bài trong hàng chờ mượt mà trên cả cảm ứng điện thoại và chuột |
| `vitest` | Chạy nhanh các bộ kiểm thử đơn vị cho hàm thuần |

### Các quyết định tự xử lý (không dùng thư viện):
1. **Trình phát tự quản (Self-Managed HTML5 Player)**: Thay vì phụ thuộc vào YouTube IFrame API (dễ bị lỗi CSP, dính quảng cáo DoubleClick và bị tiện ích chặn quảng cáo / Invidious của người dùng can thiệp gây timeout), máy chủ tự động giải mã và phục vụ luồng media trực tiếp qua `/api/youtube/stream` bằng HTTP 206 Partial Content (Range Requests). Thẻ `<video>` HTML5 tự quản hoàn toàn việc phát, tua và chỉnh trôi không cần nạp bất kỳ script bên thứ ba nào.
2. **Bộ tạo tiếng vang (Reverb)**: Tự viết hàm sinh xung đáp ứng ngẫu nhiên (`createSyntheticImpulseResponse` trong `lib/audio/reverb.ts`), không cần tải file WAV mẫu hàng chục MB.
3. **Đồng bộ NTP**: Tự viết thuật toán đo 4 mốc thời gian lấy mẫu tối ưu (`lib/sync/clock.ts`) trong 80 dòng code.
4. **Nội suy thời gian phát**: Tự viết `PlayerPositionInterpolator` bằng `performance.now()`.
5. **Snapshot phòng**: Lưu trữ JSON vào `.data/rooms.json` bằng `fs` gốc của Node.js.

---

## 6. Các giới hạn đã biết

1. **Chính sách tự động phát của trình duyệt (Autoplay Policy)**: Trình duyệt luôn chặn âm thanh nếu chưa có thao tác bấm từ người dùng. Ứng dụng bắt buộc người dùng bấm nút "Vào phòng" trước khi nạp Player và Mic.
2. **Video YouTube chặn nhúng (Code 101/150)**: Một số video do hãng ghi âm cài đặt cấm phát ngoài domain `youtube.com`. Khi gặp lỗi này, client sẽ tự động báo server bỏ qua bài hát để không làm gián đoạn phòng.
3. **Tai nghe khi nghe giọng bản thân (Monitor)**: Nếu bật monitor mà dùng loa ngoài sẽ gây phản hồi âm thanh (hú rít), hoặc tai nghe Bluetooth gây trễ âm thanh không do mạng. Người dùng được khuyến cáo đeo tai nghe có dây.
