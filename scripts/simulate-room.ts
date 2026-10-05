/**
 * KaraRoom - Kịch bản mô phỏng kiểm thử 2 Client Socket.IO.
 * Các bước: Tạo phòng -> Vào phòng -> Thêm bài -> Lên slot hát -> Hết bài -> Chấm điểm -> Qua bài tiếp theo.
 */

import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { io as ClientIO, Socket as ClientSocket } from "socket.io-client";
import { RoomManager } from "../server/room-manager";
import { registerSocketHandlers } from "../server/socket-handlers";
import { SOCKET_EVENTS } from "../shared/events";
import { RoomState } from "../shared/types";

function waitForState(
  client: ClientSocket,
  predicate: (state: RoomState) => boolean,
  timeoutMs = 5000
): Promise<RoomState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(SOCKET_EVENTS.ROOM_STATE, handler);
      reject(new Error("Timeout chờ RoomState thỏa điều kiện"));
    }, timeoutMs);

    const handler = (state: RoomState) => {
      if (predicate(state)) {
        clearTimeout(timer);
        client.off(SOCKET_EVENTS.ROOM_STATE, handler);
        resolve(state);
      }
    };

    client.on(SOCKET_EVENTS.ROOM_STATE, handler);
  });
}

async function runSimulation() {
  console.log("=== BẮT ĐẦU KỊCH BẢN MÔ PHỎNG 2 CLIENT KARAROOM ===");

  // 1. Dựng HTTP Server & Socket.IO riêng cho bài test
  const httpServer = createServer();
  const ioServer = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });
  const roomManager = new RoomManager();
  registerSocketHandlers(ioServer, roomManager);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });

  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : 3000;
  const url = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Đang lắng nghe tại cổng ${port}`);

  // 2. Client 1 (Host Tuấn) và Client 2 kết nối
  const client1: ClientSocket = ClientIO(url, { transports: ["websocket"] });
  const client2: ClientSocket = ClientIO(url, { transports: ["websocket"] });

  await Promise.all([
    new Promise<void>((res) => client1.on("connect", () => res())),
    new Promise<void>((res) => client2.on("connect", () => res())),
  ]);
  console.log("✓ Cả 2 client đã kết nối Socket.IO thành công.");

  let roomCode = "";

  // 3. Client 1 tạo phòng
  const createPromise = waitForState(client1, (s) => s.hostUserId === "user-host-1");
  client1.emit(SOCKET_EVENTS.ROOM_CREATE, {
    userId: "user-host-1",
    nickname: "Host Tuấn",
  });
  const stateCreated = await createPromise;
  roomCode = stateCreated.code;
  console.log(`✓ Client 1 (Host Tuấn) đã tạo phòng: ${roomCode}`);

  // 4. Client 2 vào phòng
  const joinPromise = waitForState(client2, (s) => Boolean(s.users["user-guest-2"]));
  client2.emit(SOCKET_EVENTS.ROOM_JOIN, {
    roomCode,
    userId: "user-guest-2",
    nickname: "Lan",
  });
  const stateJoined = await joinPromise;
  console.log(`✓ Client 2 (Lan) đã vào phòng ${stateJoined.code} (Tổng người: ${Object.keys(stateJoined.users).length})`);

  // 5. Client 1 thêm bài hát
  const addSongPromise = waitForState(client1, (s) => s.currentSong?.videoId === "dQw4w9WgXcQ");
  client1.emit(SOCKET_EVENTS.QUEUE_ADD, {
    videoId: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    durationSec: 213,
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  });
  const stateWithSong = await addSongPromise;
  console.log(`✓ Client 1 đã thêm bài hát: "${stateWithSong.currentSong?.title}" (Đang phát: ${stateWithSong.timeline.playing})`);

  // 6. Client 2 lên slot hát
  const takeSlotPromise = waitForState(client2, (s) =>
    s.singerSlots.some((slot) => slot.userId === "user-guest-2")
  );
  client2.emit(SOCKET_EVENTS.SLOT_TAKE, { slotIndex: 0 });
  await takeSlotPromise;
  console.log("✓ Client 2 đã lên slot hát: Thành công");

  // 6b. Thử nghiệm tạm dừng phát (Pause) đồng bộ
  const pausePromise = waitForState(client2, (s) => !s.timeline.playing && !s.timeline.countdown);
  client1.emit(SOCKET_EVENTS.PLAYBACK_PAUSE);
  const statePaused = await pausePromise;
  console.log(`✓ Đã đồng bộ Tạm dừng (Pause) cho toàn phòng: playing = ${statePaused.timeline.playing}`);

  // 6c. Thử nghiệm tiếp tục phát (Resume) kích hoạt đếm ngược 5s
  const resumePromise = waitForState(client2, (s) => Boolean(s.timeline.countdown?.active));
  client1.emit(SOCKET_EVENTS.PLAYBACK_RESUME);
  const stateResumed = await resumePromise;
  console.log(`✓ Đã đồng bộ Tiếp tục (Resume) với Countdown: ${stateResumed.timeline.countdown?.durationSec}s`);

  // 7. Báo cáo bài hát kết thúc với dữ liệu mic -> Kích hoạt chấm điểm
  const scoringPromise = waitForState(client1, (s) => Boolean(s.scoring));
  // Client 2 hát với 85% hoạt động mic
  client2.emit(SOCKET_EVENTS.SCORE_REPORT_ACTIVITY, { voiceActiveRatio: 0.85 });
  const stateScoring = await scoringPromise;
  console.log(`✓ Đã bắt đầu màn công bố điểm: ${stateScoring.scoring?.score} điểm! (Thời lượng: ${stateScoring.scoring?.durationSec}s)`);

  // 8. Kết thúc kịch bản và dọn dẹp
  client1.disconnect();
  client2.disconnect();
  ioServer.close();
  httpServer.close();

  console.log("=== KỊCH BẢN MÔ PHỎNG 2 CLIENT ĐÃ HOÀN THÀNH XUẤT SẮC! ===");
  process.exit(0);
}

runSimulation().catch((err) => {
  console.error("Lỗi kịch bản mô phỏng:", err);
  process.exit(1);
});
