# Tài liệu Thiết kế Kiến trúc: Đồng bộ Play/Pause, Đếm ngược 5s, Tự tính Delay Voice & Chỉnh âm lượng cá nhân

- **Ngày tạo:** 05/10/2026
- **Trạng thái:** Chờ duyệt (Pending Approval)
- **Tác giả:** Antigravity AI Pair Programmer

---

## 1. Mục tiêu và Phạm vi

Giải quyết triệt để 4 vấn đề cốt lõi trong trải nghiệm phòng hát trực tuyến KaraRoom:
1. **Đồng bộ Play / Pause Realtime**: Khắc phục lỗi play/pause hiện tại chỉ hoạt động cục bộ. Đưa quyền điều khiển play/pause về Server-Authoritative (Host & Ca sĩ có quyền), đồng bộ chuẩn xác frame dừng/phát cho mọi thành viên.
2. **Đếm ngược 5 giây (Countdown 5s)**: Trước khi bắt đầu bài mới hoặc tiếp tục phát (Resume), kích hoạt đếm ngược 5s trên toàn phòng. Mọi người có thời gian chuẩn bị giọng, mic và nhạc sẽ phát đồng loạt khi hết 5s.
3. **Tự động đo và tối ưu Delay Voice khi đổi chỗ**: Khi danh sách ca sĩ thay đổi (người lên/xuống slot, đổi ca sĩ), hệ thống phía người nghe tự động đo RTT, Jitter qua WebRTC getStats() và bù trễ tối ưu cho video player & delay node để lời ca sĩ và nhạc chạm tai người nghe đúng phách, tránh lệch tone/nhịp.
4. **Điều chỉnh âm lượng cá nhân tiện lợi**: Thêm thanh trượt chỉnh âm lượng nhanh ngay trên Video Player (nhạc nền) và giao diện sân khấu (giọng hát), lưu trữ `localStorage`, hoàn toàn độc lập và không can thiệp vào người khác.

---

## 2. Thiết kế chi tiết từng cấu phần

### 2.1. Đồng bộ Play / Pause Realtime

#### Luồng dữ liệu và Quyền hạn:
- **Ai có quyền**: Trưởng phòng (Host) hoặc Ca sĩ đang có slot trong `singerSlots`.
- **Sự kiện Socket mới**:
  - `playback:pause`: Gửi yêu cầu tạm dừng.
  - `playback:resume`: Gửi yêu cầu tiếp tục phát.
- **Server Logic (`server/song-logic.ts` & `server/socket-handlers.ts`)**:
  - Khi nhận `playback:pause`:
    - Kiểm tra quyền người gửi (`isHost || isSinger`).
    - Tính vị trí hiện tại của bài hát tại `nowMs`:
      ```ts
      const elapsedSec = (nowMs - timeline.serverTimeMs) / 1000;
      const currentPos = Math.max(0, timeline.positionSec + elapsedSec);
      ```
    - Nếu có countdown đang chạy, hủy timer countdown.
    - Cập nhật `timeline`:
      ```ts
      timeline = {
        ...timeline,
        positionSec: currentPos,
        serverTimeMs: nowMs,
        playing: false,
        countdown: null,
      };
      ```
    - Broadcast `room:state` tới mọi client.
  - Khi nhận `playback:resume`:
    - Kiểm tra quyền người gửi.
    - Không phát ngay, mà kích hoạt tiến trình **Đếm ngược 5s** (xem mục 2.2).

#### Client Logic (`components/room/VideoPlayer.tsx`):
- Nút Play/Pause trên thanh điều khiển:
  - Nếu người dùng có quyền (Host hoặc Ca sĩ): Nút bấm gửi socket event `playback:pause` hoặc `playback:resume`.
  - Nếu là Khán giả: Nút hiển thị trạng thái và tooltip "Chỉ Trưởng phòng hoặc Ca sĩ mới có quyền dừng/phát", vô hiệu hóa click.
- Lắng nghe `timeline.playing` và `timeline.positionSec`:
  - Khi `timeline.playing === false`: Dừng native video `videoRef.current.pause()` và gán `currentTime = targetSec`.
  - Vòng lặp drift check (500ms) chỉ chạy khi `timeline.playing === true` và không có countdown.

---

### 2.2. Đếm ngược 5 giây (Countdown 5s)

#### Cấu trúc dữ liệu:
Bổ sung `CountdownState` trong `shared/types.ts`:
```ts
export interface CountdownState {
  active: boolean;
  startAtServerMs: number;
  durationSec: number; // 5
  type: "start" | "resume";
}

export interface Timeline {
  videoId: string | null;
  positionSec: number;
  serverTimeMs: number;
  playing: boolean;
  countdown?: CountdownState | null;
}
```

#### Quy trình Server:
1. **Khi nào kích hoạt countdown**:
   - Khi bài hát mới bắt đầu phát (từ hàng chờ, sau màn chấm điểm, hoặc thêm bài vào phòng trống).
   - Khi nhận sự kiện `playback:resume`.
2. **Hành động Server**:
   - Thiết lập `countdown = { active: true, startAtServerMs: nowMs, durationSec: 5, type }`.
   - `playing = false`.
   - Lên lịch timer 5000ms:
     ```ts
     setTimeout(() => {
       state.timeline.countdown = null;
       state.timeline.playing = true;
       state.timeline.serverTimeMs = Date.now();
       broadcastState();
     }, 5000);
     ```
   - Broadcast `room:state` cho cả phòng.

#### Giao diện Client (`VideoPlayer.tsx`):
- Khi `timeline.countdown?.active === true`:
  - Video tải frame tại `positionSec` để sẵn sàng đệm (buffer), không phát tiếng.
  - Hiển thị màn hình mờ nghệ thuật **CountdownOverlay** trên khung video:
    - Vòng tròn tiến trình đếm ngược 5 giây (SVG radial progress hoặc pulse animation).
    - Số đếm to nổi bật: `5` ... `4` ... `3` ... `2` ... `1` ... `BẮT ĐẦU! 🎤`
    - Tiêu đề phụ: "Sẵn sàng thể hiện giọng hát!" (nếu là bài mới) hoặc "Đang tiếp tục bài hát..." (nếu là resume).
    - Tính toán số giây còn lại theo thời gian thực NTP:
      ```ts
      const elapsed = (clock.nowServerTime() - countdown.startAtServerMs) / 1000;
      const remainingSec = Math.max(0, Math.ceil(countdown.durationSec - elapsed));
      ```

---

### 2.3. Tự động tính Delay Voice và đề xuất khi đổi ca sĩ

#### Bối cảnh kỹ thuật:
- Khi Khán giả nghe Ca sĩ hát qua WebRTC, âm thanh giọng truyền từ Ca sĩ -> Khán giả mất một khoảng trễ $L = \frac{\text{RTT}}{2} + \text{jitter} + 40\text{ms}$.
- Nếu Khán giả phát nhạc YouTube không trễ, giọng ca sĩ sẽ bị chậm sau nhạc $\Rightarrow$ Lệch tone, lệch nhịp, phô.
- Do đó, Khán giả cần trễ nhạc lại một khoảng `audienceDelayMs` xấp xỉ bằng $L$.

#### Cơ chế phát hiện và tự động tính toán:
1. **Kích hoạt khi đổi chỗ**:
   - `app/page.tsx` theo dõi `roomState.singerSlots`.
   - Khi các ID ca sĩ thay đổi hoặc có ca sĩ mới lên hát:
     - Kích hoạt hàm đo độ trễ `calculateOptimalDelayForSingers(singerIds)`.
2. **Thuật toán đo WebRTC Stats**:
   - Gọi `RTCPeerConnection.getStats()` cho từng ca sĩ đang hát.
   - Đọc `candidate-pair.currentRoundTripTime` và `inbound-rtp.jitter`.
   - Độ trễ giọng ước tính:
     $$\text{estimatedLatencyMs} = \text{round}\left(\frac{\text{rtt}}{2} + \text{jitter} + 40\right)$$
   - Độ trễ nhạc đề xuất cho người nghe:
     $$\text{optimalDelayMs} = \text{Math.max}(200, \text{Math.min}(1000, \text{estimatedLatencyMs} + 40))$$
3. **Tự động áp dụng & Thông báo**:
   - Cập nhật ngay vào `store.setAudienceDelayMs(optimalDelayMs)`.
   - Cập nhật `P2PVoiceTransport.updateAudienceDelay(optimalDelayMs)`.
   - Hiện Toast / Badge thông báo:
     *"🎧 Đã tự động căn độ trễ {optimalDelayMs}ms theo ca sĩ [Tên] để khớp nhạc chuẩn xác!"*
   - Kèm nút bấm mở bảng chỉnh tay (manual offset ±500ms) nếu người nghe có sở thích cá nhân.

---

### 2.4. Điều khiển âm lượng cá nhân (Quick Volume Control)

#### Vị trí giao diện:
1. **Trên Video Player (`VideoPlayer.tsx`)**:
   - Cạnh nút Mute (Loa), bổ sung thanh trượt âm lượng nhạc nền (0% - 100%).
   - Tương tác: Rê chuột hoặc bấm vào icon loa hiện thanh trượt dạng popover/horizontal bar tiện lợi.
   - Điều khiển trực tiếp `videoRef.current.volume` và lưu `store.setMusicVolume()`.
2. **Trên thanh điều khiển Sân khấu (`SingingStage.tsx`) / Bảng điều khiển**:
   - Thêm nút / slider điều chỉnh nhanh âm lượng giọng hát (Vocal Volume: 0% - 150%) cho người nghe.
   - Điều khiển trực tiếp `gainNode` của `P2PVoiceTransport` và lưu `store.setVocalVolume()`.
3. **Đặc tính**:
   - Hoàn toàn cục bộ phía client, lưu vào `localStorage`. Không đồng bộ lên server để tôn trọng không gian nghe của từng người.

---

## 3. Kế hoạch kiểm thử & Tiêu chí nghiệm thu

1. **Unit Tests (`tests/room-logic.test.ts` & `tests/sync.test.ts`)**:
   - Test Play/Pause server logic: Pause cập nhật đúng `positionSec` và `playing: false`.
   - Test Countdown 5s: Khi resume hoặc bắt đầu bài mới, trạng thái `countdown` được kích hoạt và sau 5s chuyển sang `playing: true`.
   - Test phân quyền: Thành viên thường gửi `playback:pause` bị từ chối với thông báo lỗi.
2. **End-to-End & UI Verification**:
   - Kiểm tra giao diện VideoPlayer: hiển thị overlay đếm ngược 5s mượt mà.
   - Thử nghiệm Play/Pause đồng bộ giữa 2 cửa sổ trình duyệt (Host và Khán giả).
   - Thử nghiệm đổi ca sĩ: Hệ thống tự đo ping/rtt và toast thông báo mức delay tối ưu được áp dụng.
   - Thử nghiệm thanh âm lượng: Kéo slider đổi âm lượng nhạc và giọng lập tức, reload trang vẫn giữ nguyên thiết lập.
