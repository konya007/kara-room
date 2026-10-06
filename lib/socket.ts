/**
 * KaraRoom - Quản lý kết nối Socket.IO Client và tích hợp bộ đo đồng hồ NTP.
 */

import { io, Socket } from "socket.io-client";
import { ClockSync } from "./sync/clock";

let socketInstance: Socket | null = null;
let clockSyncInstance: ClockSync | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    clockSyncInstance = new ClockSync(socketInstance);
    clockSyncInstance.start();

    if (typeof window !== "undefined") {
      window.addEventListener("pageshow", (event) => {
        // Tự động khôi phục kết nối WebSocket khi trang được nạp lại từ bfcache (Back-Forward Cache)
        if (event.persisted && socketInstance) {
          if (!socketInstance.connected) {
            socketInstance.connect();
          }
        }
      });
    }
  }
  return socketInstance;
}

export function getClockSync(): ClockSync {
  if (!clockSyncInstance) {
    getSocket();
  }
  return clockSyncInstance!;
}
