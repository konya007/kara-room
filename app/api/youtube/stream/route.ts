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

      const findVideoAudioFormat = (mediaInfo: any) => {
        if (!mediaInfo) return null;
        const attempts = [
          { type: "video+audio", quality: "360p" },
          { type: "video+audio", quality: "best" },
          { type: "video+audio", quality: "worst" },
          { type: "video+audio" },
        ];
        for (const criteria of attempts) {
          try {
            const f = mediaInfo.chooseFormat(criteria);
            if (f) return f;
          } catch {
            // Tiếp tục thử tiêu chí kế tiếp nếu throw No matching formats
          }
        }
        if (mediaInfo.streaming_data?.formats?.length) {
          return mediaInfo.streaming_data.formats[0];
        }
        return null;
      };

      let format = findVideoAudioFormat(info);

      // Nếu WEB client không có format muxed video+audio, fallback sang ANDROID client
      if (!format) {
        try {
          const androidInfo = await yt.getBasicInfo(videoId, { client: "ANDROID" });
          format = findVideoAudioFormat(androidInfo);
          if (format) {
            info = androidInfo;
          }
        } catch {
          // Bỏ qua
        }
      }

      // Nếu vẫn chưa có, thử client YTMUSIC
      if (!format) {
        try {
          const ytMusicInfo = await yt.getBasicInfo(videoId, { client: "YTMUSIC" });
          format = findVideoAudioFormat(ytMusicInfo);
          if (format) {
            info = ytMusicInfo;
          }
        } catch {
          // Bỏ qua
        }
      }

      // Cuối cùng thử tìm audio nếu không có video
      if (!format) {
        try {
          format =
            info?.chooseFormat({ type: "audio", quality: "best" }) ||
            info?.chooseFormat({ type: "audio" });
        } catch {
          format = null;
        }
      }

      // Nếu vẫn không có dữ liệu stream (video nhạc bản quyền / VEVO / DRM)
      if (!format) {
        console.warn(`[YouTubeStreamAPI] Video ${videoId} không có định dạng phát trực tiếp khả dụng. Đề xuất phát qua NoCookie.`);
        return new NextResponse("streaming_not_available", { status: 422 });
      }

      let extractedUrl = "";
      if (format.url) {
        extractedUrl = format.url;
      } else {
        const deciphered = await format.decipher(yt.session.player);
        if (!deciphered) {
          console.warn(`[YouTubeStreamAPI] Không thể decipher stream cho video ${videoId}.`);
          return new NextResponse("streaming_not_available", { status: 422 });
        }
        extractedUrl = deciphered;
      }

      directUrl = extractedUrl;
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

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      // Nếu Google Video từ chối (403/404/v.v.), xóa cache và trả về 422 để fallback NoCookie
      streamUrlCache.delete(videoId);
      console.warn(`[YouTubeStreamAPI] Upstream stream trả về mã ${upstreamRes.status} cho video ${videoId}. Chuyển sang NoCookie.`);
      return new NextResponse("streaming_not_available", { status: 422 });
    }

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
    streamUrlCache.delete(videoId);
    return new NextResponse("streaming_not_available", { status: 422 });
  }
}
