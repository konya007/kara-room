/**
 * KaraRoom - Tuyến API phát luồng media trực tiếp (Self-Managed Media Stream Proxy).
 * Trích xuất URL video/audio MP4 từ YouTube và truyền luồng về client qua HTTP Range Requests (206 Partial Content).
 * Nếu video bị khóa bản quyền hoặc không có streaming data, trả về 422 để client tự động chuyển sang YouTube NoCookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { Innertube, Platform } from "youtubei.js";

// Cấu hình môi trường giải mã JavaScript cho Innertube trong Node.js
let platformLoaded = false;
function ensurePlatformLoaded() {
  if (!platformLoaded) {
    Platform.load({
      ...Platform.shim,
      eval: async (data: any, env: any) => {
        const code = typeof data === "string" ? data : data.output;
        const fn = new Function(...Object.keys(env), code);
        return fn(...Object.values(env));
      },
    });
    platformLoaded = true;
  }
}

// Bộ nhớ đệm URL stream trong RAM: Map<videoId, { url: string; expiresAt: number }>
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();

let ytClient: Innertube | null = null;
async function getInnertube(): Promise<Innertube> {
  ensurePlatformLoaded();
  if (!ytClient) {
    ytClient = await Innertube.create({
      generate_session_locally: true,
    });
  }
  return ytClient;
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId")?.trim();
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return new NextResponse("Thiếu hoặc sai định dạng videoId", { status: 400 });
  }

  try {
    // 1. Kiểm tra cache
    let directUrl = "";
    const cached = streamUrlCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      directUrl = cached.url;
    } else {
      const yt = await getInnertube();
      let info: any = null;

      try {
        info = await yt.getInfo(videoId);
      } catch {
        // Dự phòng lấy qua getBasicInfo
        try {
          info = await yt.getBasicInfo(videoId, { client: "ANDROID" });
        } catch {
          // Bỏ qua
        }
      }

      // Nếu WEB client không có streaming_data, thử lại với ANDROID client
      if (!info?.streaming_data) {
        try {
          const androidInfo = await yt.getBasicInfo(videoId, { client: "ANDROID" });
          if (androidInfo?.streaming_data) {
            info = androidInfo;
          }
        } catch {
          // Bỏ qua
        }
      }

      // Nếu vẫn không có dữ liệu stream (video nhạc bản quyền / VEVO / DRM)
      if (!info?.streaming_data) {
        console.warn(`[YouTubeStreamAPI] Video ${videoId} không có streaming_data. Đề xuất phát qua NoCookie.`);
        return new NextResponse("streaming_not_available", { status: 422 });
      }

      let format;
      try {
        format =
          info.chooseFormat({ type: "video+audio", quality: "360p" }) ||
          info.chooseFormat({ type: "video+audio", quality: "best" }) ||
          info.chooseFormat({ type: "audio", quality: "best" });
      } catch {
        format = null;
      }

      if (!format) {
        console.warn(`[YouTubeStreamAPI] Không chọn được format cho video ${videoId}. Đề xuất NoCookie.`);
        return new NextResponse("streaming_not_available", { status: 422 });
      }

      const deciphered = await format.decipher(yt.session.player);
      if (!deciphered) {
        console.warn(`[YouTubeStreamAPI] Không thể decipher stream cho video ${videoId}.`);
        return new NextResponse("streaming_not_available", { status: 422 });
      }

      directUrl = deciphered;
      // Cache trong 45 phút
      streamUrlCache.set(videoId, {
        url: directUrl,
        expiresAt: Date.now() + 45 * 60 * 1000,
      });
    }

    // 2. Chuyển tiếp yêu cầu Range từ trình duyệt đến máy chủ Google Video
    const rangeHeader = req.headers.get("range");
    const headers: HeadersInit = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const upstreamRes = await fetch(directUrl, { headers });

    // 3. Trả về luồng dữ liệu cho thẻ <video>
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", upstreamRes.headers.get("content-type") || "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");

    if (upstreamRes.headers.get("content-range")) {
      responseHeaders.set("Content-Range", upstreamRes.headers.get("content-range")!);
    }
    if (upstreamRes.headers.get("content-length")) {
      responseHeaders.set("Content-Length", upstreamRes.headers.get("content-length")!);
    }

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.warn(`[YouTubeStreamAPI] Lỗi khi xử lý stream video ${videoId}:`, (err as Error).message);
    return new NextResponse("streaming_not_available", { status: 422 });
  }
}
