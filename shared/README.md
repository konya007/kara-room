# Shared Modules (`shared/`)

Thư mục này chứa toàn bộ các định nghĩa dùng chung giữa Server (Node.js/Socket.IO) và Client (Next.js/React).

## Nội dung:
1. `types.ts`: Định nghĩa Interface (`RoomState`, `User`, `SongItem`, `Timeline`, `SingerSlot`, etc.) và Zod Schema để validate toàn bộ dữ liệu đi qua socket.
2. `events.ts`: Danh sách các hằng số tên sự kiện Socket.IO (`SOCKET_EVENTS`), đảm bảo 2 đầu không bị gõ nhầm chuỗi ký tự.

## Nguyên tắc:
- Mọi payload từ Client gửi lên Server PHẢI được Zod parse/validate trước khi xử lý.
- Không sử dụng kiểu `any`.
- Giữ logic ở đây hoàn toàn thuần túy, không phụ thuộc vào thư viện giao diện hay runtime đặc thù.
