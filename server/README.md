# Server Modules (`server/`)

Thư mục này chứa toàn bộ logic xử lý phía máy chủ của KaraRoom.

## Cấu trúc:
1. `room-logic.ts`: Các hàm thuần túy (pure functions) xử lý người dùng vào/ra, mất kết nối, ân hạn 30 giây, chuyển quyền host cho người vào sớm nhất.
2. `song-logic.ts`: Các hàm thuần túy xử lý hàng chờ bài hát, phân chia slot người hát (3 chế độ: tự do, ngẫu nhiên, chỉ định), và thuật toán chấm điểm ngẫu nhiên 75-100 có trọng số hoạt động mic.
3. `room-manager.ts`: Quản lý danh sách phòng trên RAM (`Map<string, RoomState>`), định kỳ 30 giây snapshot ra `.data/rooms.json`, tự dọn dẹp phòng trống sau 10 phút.
4. `socket-handlers.ts`: Tiếp nhận kết nối WebSocket từ Socket.IO, xác thực toàn bộ payload với Zod, chuyển tiếp tín hiệu WebRTC signaling (P2P), và đo độ lệch đồng hồ NTP.

## Đặc điểm kiến trúc:
- Server là **nguồn sự thật duy nhất** (Server-Authoritative). Client không được tự ý sửa đổi timeline hoặc trạng thái phòng.
- Độc lập khỏi cơ sở dữ liệu bên ngoài, có thể tự chạy đơn giản trong một container Docker duy nhất.
