/**
 * KaraRoom - File cấu hình tập trung các hằng số tinh chỉnh của hệ thống.
 * Mọi hằng số đều có chú thích đơn vị đo lường (ms, s, bps, px, etc.).
 */

export const CONFIG = {
  // === ĐỒNG BỘ ÂM THANH & VIDEO ===
  /** Độ trễ mặc định của khán giả so với timeline gốc của phòng (mili-giây) */
  AUDIENCE_DELAY_MS: 400,

  /** Ngưỡng trôi tối thiểu bỏ qua không cần chỉnh (mili-giây) */
  DRIFT_TOLERANCE_MS: 40,

  /** Ngưỡng trôi lớn bắt buộc phải dùng seekTo (mili-giây) */
  DRIFT_SEEK_THRESHOLD_MS: 1500,

  /** Chu kỳ kiểm tra độ trôi giữa player và timeline (mili-giây) */
  DRIFT_CHECK_INTERVAL_MS: 500,

  /** Khoảng thời gian áp dụng tốc độ tạm thời trước khi trả về 1.0 (mili-giây) */
  DRIFT_RATE_APPLY_DURATION_MS: 1200,

  // === ĐỒNG HỒ NTP (CLIENT - SERVER) ===
  /** Số mẫu đo RTT khi client mới vào phòng */
  CLOCK_SYNC_INITIAL_SAMPLES: 5,

  /** Chu kỳ đồng bộ lại đồng hồ với server (mili-giây) */
  CLOCK_SYNC_INTERVAL_MS: 10000,

  // === QUẢN LÝ PHÒNG & SNAPSHOT ===
  /** Thời gian ân hạn giữ chỗ và quyền host khi rớt mạng (mili-giây) */
  RECONNECT_GRACE_PERIOD_MS: 30 * 1000, // 30s

  /** Thời gian phòng trống trước khi bị giải phóng khỏi RAM (mili-giây) */
  ROOM_EMPTY_TIMEOUT_MS: 10 * 60 * 1000, // 10 phút

  /** Chu kỳ lưu snapshot phòng ra đĩa .data/rooms.json (mili-giây) */
  ROOM_SNAPSHOT_INTERVAL_MS: 30 * 1000, // 30s

  /** Đường dẫn file snapshot trên server */
  ROOM_SNAPSHOT_FILE_PATH: ".data/rooms.json",

  /** Số người tối đa mặc định trong một phòng */
  DEFAULT_MAX_USERS: 12,

  /** Số slot hát mặc định trong một phòng */
  DEFAULT_MAX_SINGERS: 2,

  // === CHẤM ĐIỂM ===
  /** Thời gian hiển thị màn công bố điểm số (giây) */
  SCORE_ANNOUNCE_DURATION_SEC: 10,

  /** Điểm số tối thiểu sinh ra */
  SCORE_MIN: 75,

  /** Điểm số tối đa sinh ra */
  SCORE_MAX: 100,

  // === XỬ LÝ GIỌNG & WEBRTC ===
  /** Bitrate mã hóa Opus cho giọng hát (bit/giây) */
  OPUS_BITRATE: 96000,

  /** Độ trễ ước tính cho thu âm phần cứng và bộ mã hóa mic (mili-giây) */
  ESTIMATED_CAPTURE_ENCODE_LATENCY_MS: 40,

  /** Chu kỳ cập nhật thống kê getStats WebRTC (mili-giây) */
  RTC_STATS_INTERVAL_MS: 800,

  // === TÌM KIẾM BÀI HÁT YOUTUBE ===
  /** Thời gian cache kết quả tìm kiếm YouTube (mili-giây) */
  SEARCH_CACHE_TTL_MS: 10 * 60 * 1000, // 10 phút

  /** Giới hạn số lượt tìm kiếm mỗi IP trong 1 phút */
  SEARCH_RATE_LIMIT_PER_MINUTE: 30,

  // === CẤU HÌNH GIAO DIỆN ===
  /** Vùng chạm tối thiểu trên màn hình cảm ứng (px) */
  MIN_TOUCH_TARGET_SIZE_PX: 44,
} as const;
