/**
 * KaraRoom - Entrypoint máy chủ tích hợp Next.js App Router và Socket.IO.
 * Chạy trên cùng một HTTP Server duy nhất tại cổng 3000 (một process, một container).
 */

import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { RoomManager } from "./server/room-manager";
import { registerSocketHandlers } from "./server/socket-handlers";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({
  dev,
  dir: __dirname,
  hostname,
  port,
});
const handle = app.getRequestHandler();

async function bootstrap() {
  await app.prepare();

  const roomManager = new RoomManager();

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "/", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("[KaraRoom] Lỗi xử lý request:", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  registerSocketHandlers(io, roomManager);

  httpServer.listen(port, () => {
    console.log(`[KaraRoom] Máy chủ chạy tại http://${hostname}:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("[KaraRoom] Lỗi khởi động server:", err);
  process.exit(1);
});
