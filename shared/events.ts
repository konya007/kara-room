/**
 * KaraRoom - Danh sách sự kiện Socket.IO giữa Client và Server.
 * Khai báo tập trung giúp tránh lỗi gõ sai tên sự kiện (string typos).
 */

export const SOCKET_EVENTS = {
  // === KẾT NỐI VÀ VÀO PHÒNG ===
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_STATE: "room:state", // Server phát state toàn bộ cho phòng
  ROOM_ERROR: "room:error", // Thông báo lỗi

  // === CÀI ĐẶT PHÒNG ===
  ROOM_SETTINGS_UPDATE: "room:settings_update",

  // === HÀNG CHỜ BÀI HÁT ===
  QUEUE_ADD: "queue:add",
  QUEUE_REMOVE: "queue:remove",
  QUEUE_REORDER: "queue:reorder",
  SONG_SKIP: "song:skip",
  SONG_ENDED: "song:ended", // Client báo video kết thúc tự nhiên

  // === ĐIỀU KHIỂN PHÁT NHẠC (PLAY / PAUSE) ===
  PLAYBACK_PAUSE: "playback:pause",
  PLAYBACK_RESUME: "playback:resume",

  // === HÀNG HÁT / SLOTS ===
  SLOT_TAKE: "slot:take",
  SLOT_LEAVE: "slot:leave",
  SLOT_ASSIGN: "slot:assign", // Host chỉ định
  SLOT_EVICT: "slot:evict", // Host mời xuống
  SINGER_WANT_TOGGLE: "singer:want_toggle",

  // === CHẤM ĐIỂM ===
  SCORE_REPORT_ACTIVITY: "score:report_activity",
  SCORE_ANNOUNCED: "score:announced",

  // === ĐỒNG BỘ ĐỒNG HỒ NTP ===
  SYNC_PING: "sync:ping",
  SYNC_PONG: "sync:pong",

  // === WEBRTC SIGNALING ===
  RTC_SIGNAL: "rtc:signal",
  RTC_PEER_DISCONNECTED: "rtc:peer_disconnected",
} as const;
