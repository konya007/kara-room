import { describe, it, expect } from "vitest";
import {
  createRoom,
  joinRoom,
  handleUserDisconnect,
  purgeDisconnectedUser,
  findEarliestOnlineUser,
} from "../server/room-logic";
import {
  addSong,
  removeSong,
  reorderQueue,
  skipSong,
  advanceSongOnEnded,
  finishScoring,
  calculateScore,
  takeSingerSlot,
  leaveSingerSlot,
  assignSingerSlot,
  evictSingerSlot,
  setWantToSing,
  pickRandomSingers,
  updateSettings,
  pausePlayback,
  resumePlayback,
  finishPlaybackCountdown,
} from "../server/song-logic";
import { PlaybackControlPayloadSchema } from "../shared/types";

describe("Room Core Pure Functions", () => {
  it("tạo phòng mới chính xác với Host ban đầu", () => {
    const room = createRoom("ABC123", {
      id: "u1",
      nickname: "Host Tuấn",
      socketId: "sock-1",
    });

    expect(room.code).toBe("ABC123");
    expect(room.hostUserId).toBe("u1");
    expect(room.users["u1"].isHost).toBe(true);
    expect(room.singerSlots.length).toBe(2);
    expect(room.queue.length).toBe(0);
  });

  it("cho phép thành viên thứ 2 vào phòng và giới hạn sĩ số", () => {
    let room = createRoom("ABC123", { id: "u1", nickname: "Tuấn", socketId: "s1" });
    const { state: r2, error } = joinRoom(room, { id: "u2", nickname: "Lan", socketId: "s2" });

    expect(error).toBeUndefined();
    expect(Object.keys(r2.users).length).toBe(2);
    expect(r2.users["u2"].isHost).toBe(false);

    // Cập nhật maxUsers = 2
    const { state: rSettings } = updateSettings(r2, "u1", { maxUsers: 2 });
    const { error: fullError } = joinRoom(rSettings, { id: "u3", nickname: "Minh", socketId: "s3" });
    expect(fullError).toBe("Phòng đã đủ số người tối đa.");
  });

  it("giữ nguyên quyền host khi rớt mạng rồi kết nối lại trong 30 giây", () => {
    let room = createRoom("ABC123", { id: "u1", nickname: "Tuấn", socketId: "s1" });
    const { state: rDisconnected } = handleUserDisconnect(room, "s1", 1000);
    expect(rDisconnected.users["u1"].isOnline).toBe(false);

    // Kết nối lại với socket mới
    const { state: rReconnected } = joinRoom(rDisconnected, { id: "u1", nickname: "Tuấn", socketId: "s1-new" }, 2000);
    expect(rReconnected.users["u1"].isOnline).toBe(true);
    expect(rReconnected.users["u1"].isHost).toBe(true);
    expect(rReconnected.hostUserId).toBe("u1");
  });

  it("chuyển quyền host cho người vào sớm nhất khi host rời hẳn", () => {
    let room = createRoom("ABC123", { id: "u1", nickname: "Host 1", socketId: "s1" }, 1000);
    const { state: r2 } = joinRoom(room, { id: "u2", nickname: "Thành viên sớm", socketId: "s2" }, 2000);
    const { state: r3 } = joinRoom(r2, { id: "u3", nickname: "Thành viên muộn", socketId: "s3" }, 3000);

    // Host 1 bị disconnect và hết hạn ân hạn -> purge
    const { state: rDisc } = handleUserDisconnect(r3, "s1");
    const rPurged = purgeDisconnectedUser(rDisc, "u1");

    expect(rPurged.hostUserId).toBe("u2");
    expect(rPurged.users["u2"].isHost).toBe(true);
    expect(rPurged.users["u1"]).toBeUndefined();
  });
});

describe("Song Queue & Slot Pure Functions", () => {
  it("thêm bài hát đầu tiên sẽ phát ngay lập tức", () => {
    const room = createRoom("ABC123", { id: "u1", nickname: "Tuấn", socketId: "s1" }, 1000);
    const { state: rWithSong } = addSong(
      room,
      "u1",
      {
        videoId: "dQw4w9WgXcQ",
        title: "Never Gonna Give You Up",
        durationSec: 213,
        thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
      2000
    );

    expect(rWithSong.currentSong?.videoId).toBe("dQw4w9WgXcQ");
    expect(rWithSong.timeline.countdown?.active).toBe(true);
    expect(rWithSong.timeline.countdown?.durationSec).toBe(5);
    const rStarted = finishPlaybackCountdown(rWithSong, 7000);
    expect(rStarted.timeline.playing).toBe(true);
    expect(rWithSong.queue.length).toBe(0);

    // Thêm bài thứ 2 vào hàng chờ
    const { state: rWithQueue } = addSong(
      rWithSong,
      "u1",
      {
        videoId: "kJQP7kiw5Fk",
        title: "Despacito",
        durationSec: 230,
        thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
      },
      3000
    );
    expect(rWithQueue.queue.length).toBe(1);
    expect(rWithQueue.queue[0].videoId).toBe("kJQP7kiw5Fk");
  });

  it("thao tác slot: lên slot hát, xuống slot, host chỉ định và mời xuống", () => {
    let room = createRoom("ABC123", { id: "u1", nickname: "Host", socketId: "s1" });
    const { state: r2 } = joinRoom(room, { id: "u2", nickname: "Singer", socketId: "s2" });

    // u2 lên slot 0
    const { state: rTook } = takeSingerSlot(r2, "u2", 0);
    expect(rTook.singerSlots[0].userId).toBe("u2");

    // u2 xuống
    const { state: rLeft } = leaveSingerSlot(rTook, "u2");
    expect(rLeft.singerSlots[0].userId).toBeNull();

    // Host chỉ định u2 vào slot 1
    const { state: rAssigned } = assignSingerSlot(rLeft, "u1", "u2", 1);
    expect(rAssigned.singerSlots[1].userId).toBe("u2");

    // Host mời xuống
    const { state: rEvicted } = evictSingerSlot(rAssigned, "u1", 1);
    expect(rEvicted.singerSlots[1].userId).toBeNull();
  });

  it("tính điểm: số nguyên 75-100 có trọng số tỉ lệ hoạt động mic", () => {
    // 0% mic
    const scoreZero = calculateScore(0, 0);
    expect(scoreZero).toBeGreaterThanOrEqual(75);
    expect(scoreZero).toBeLessThanOrEqual(85);

    // 100% mic + full luck
    const scoreMax = calculateScore(1.0, 1.0);
    expect(scoreMax).toBe(100);

    // Kiểm tra tính ngẫu nhiên nằm trong khoảng 75 đến 100
    for (let i = 0; i < 20; i++) {
      const s = calculateScore(Math.random());
      expect(s).toBeGreaterThanOrEqual(75);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("hết bài có người hát thì chuyển sang chấm điểm 10 giây", () => {
    let room = createRoom("ABC123", { id: "u1", nickname: "Tuấn", socketId: "s1" }, 1000);
    const { state: rSong } = addSong(
      room,
      "u1",
      { videoId: "v1", title: "Bài 1", durationSec: 100, thumbnail: "" },
      1000
    );
    const { state: rSinger } = takeSingerSlot(rSong, "u1", 0);

    const { state: rScoring, scoringStarted } = advanceSongOnEnded(rSinger, 0.8, 5000);
    expect(scoringStarted).toBe(true);
    expect(rScoring.scoring).not.toBeNull();
    expect(rScoring.scoring?.score).toBeGreaterThanOrEqual(75);
    expect(rScoring.scoring?.durationSec).toBe(10);

    // Kết thúc chấm điểm
    const rNext = finishScoring(rScoring, 15000);
    expect(rNext.scoring).toBeNull();
  });

  it("bốc ngẫu nhiên người hát khi ở chế độ random", () => {
    let room = createRoom("ABC123", { id: "u1", nickname: "Host", socketId: "s1" });
    const { state: r2 } = joinRoom(room, { id: "u2", nickname: "U2", socketId: "s2" });
    const { state: r3 } = joinRoom(r2, { id: "u3", nickname: "U3", socketId: "s3" });

    // Cài đặt mode = random
    const { state: rMode } = updateSettings(r3, "u1", { selectionMode: "random" });

    // U2 và U3 bật 'Muốn hát'
    const { state: rWant2 } = setWantToSing(rMode, "u2", true);
    const { state: rWant3 } = setWantToSing(rWant2, "u3", true);

    const rPicked = pickRandomSingers(rWant3);
    const assignedIds = rPicked.singerSlots.map((s) => s.userId).filter(Boolean);
    expect(assignedIds.length).toBe(2);
    expect(assignedIds).toContain("u2");
    expect(assignedIds).toContain("u3");
  });

  it("xác thực schema sự kiện playback control", () => {
    const valid = PlaybackControlPayloadSchema.safeParse({});
    expect(valid.success).toBe(true);
  });

  it("đồng bộ tạm dừng (Pause) tính đúng positionSec và chỉ cho phép Host/Singer", () => {
    let room = createRoom("ABC123", { id: "u1", nickname: "Host", socketId: "s1" }, 1000);
    const { state: r2 } = joinRoom(room, { id: "u2", nickname: "Khán giả", socketId: "s2" }, 1000);
    const { state: rWithSong } = addSong(
      r2,
      "u1",
      { videoId: "v1", title: "Song 1", durationSec: 180, thumbnail: "" },
      1000
    );

    // Bắt đầu phát sau khi countdown kết thúc tại t = 6000
    const rPlaying = finishPlaybackCountdown(rWithSong, 6000);
    expect(rPlaying.timeline.playing).toBe(true);

    // Khán giả u2 bấm Pause -> Bị chặn
    const { error: guestError } = pausePlayback(rPlaying, "u2", 16000);
    expect(guestError).toBe("Chỉ trưởng phòng hoặc ca sĩ mới có quyền tạm dừng.");

    // Host u1 bấm Pause sau 10 giây phát (t = 16000)
    const { state: rPaused, error: hostError } = pausePlayback(rPlaying, "u1", 16000);
    expect(hostError).toBeUndefined();
    expect(rPaused.timeline.playing).toBe(false);
    expect(rPaused.timeline.positionSec).toBe(10); // 16000 - 6000 = 10s
    expect(rPaused.timeline.countdown).toBeNull();
  });

  it("tiếp tục phát (Resume) kích hoạt đếm ngược 5 giây", () => {
    let room = createRoom("ABC123", { id: "u1", nickname: "Host", socketId: "s1" }, 1000);
    const { state: rSong } = addSong(
      room,
      "u1",
      { videoId: "v1", title: "Song 1", durationSec: 180, thumbnail: "" },
      1000
    );
    const rPaused: typeof rSong = {
      ...rSong,
      timeline: {
        videoId: "v1",
        positionSec: 35,
        serverTimeMs: 10000,
        playing: false,
        countdown: null,
      },
    };

    // Host bấm Resume tại t = 20000
    const { state: rResumed, error } = resumePlayback(rPaused, "u1", 20000);
    expect(error).toBeUndefined();
    expect(rResumed.timeline.playing).toBe(false);
    expect(rResumed.timeline.positionSec).toBe(35);
    expect(rResumed.timeline.countdown?.active).toBe(true);
    expect(rResumed.timeline.countdown?.durationSec).toBe(5);
    expect(rResumed.timeline.countdown?.type).toBe("resume");

    // Khi hết 5 giây (t = 25000)
    const rFinished = finishPlaybackCountdown(rResumed, 25000);
    expect(rFinished.timeline.playing).toBe(true);
    expect(rFinished.timeline.countdown).toBeNull();
    expect(rFinished.timeline.positionSec).toBe(35);
  });

  it("hết bài khi chưa ai lên slot vẫn chấm điểm cho người thêm bài hoặc người trong phòng", () => {
    const room = createRoom("ABC123", { id: "u1", nickname: "Tuấn", socketId: "s1" }, 1000);
    const { state: rSong } = addSong(
      room,
      "u1",
      { videoId: "v1", title: "Bài Solo", durationSec: 120, thumbnail: "" },
      1000
    );
    // Không có ai gọi takeSingerSlot (singerSlots trống)
    expect(rSong.singerSlots.every((s) => s.userId === null)).toBe(true);

    const { state: rScoring, scoringStarted } = advanceSongOnEnded(rSong, 0.75, 5000);
    expect(scoringStarted).toBe(true);
    expect(rScoring.scoring).not.toBeNull();
    expect(rScoring.scoring?.singers.length).toBe(1);
    expect(rScoring.scoring?.singers[0].userId).toBe("u1");

    // Thử gọi advanceSongOnEnded lần nữa khi đang scoring -> phải bỏ qua
    const { scoringStarted: duplicateScoring } = advanceSongOnEnded(rScoring, 0.9, 6000);
    expect(duplicateScoring).toBe(false);
  });
});

