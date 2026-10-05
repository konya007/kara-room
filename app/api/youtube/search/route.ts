/**
 * KaraRoom - Tuyến API tìm kiếm video YouTube sử dụng youtubei.js.
 * Hỗ trợ: Từ khóa tìm kiếm hoặc đường link YouTube trực tiếp (tự tách videoId).
 * Tích hợp: Bộ nhớ đệm LRU Cache 10 phút, Giới hạn tần suất gọi (Rate Limiting).
 */

import { NextRequest, NextResponse } from "next/server";
import { Innertube } from "youtubei.js";
import { CONFIG } from "../../../../config";

export interface SearchResultItem {
  videoId: string;
  title: string;
  durationSec: number;
  thumbnail: string;
  author: string;
}

// Bộ nhớ đệm LRU đơn giản trong RAM
interface CacheEntry {
  data: SearchResultItem[];
  expiresAt: number;
}
const searchCache = new Map<string, CacheEntry>();

// Giới hạn tần suất gọi theo IP: Map<ip, timestamp[]>
const ipRateLimit = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = (ipRateLimit.get(ip) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= CONFIG.SEARCH_RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  timestamps.push(now);
  ipRateLimit.set(ip, timestamps);
  return true;
}

let ytClient: Innertube | null = null;
async function getInnertube(): Promise<Innertube> {
  if (!ytClient) {
    ytClient = await Innertube.create({
      generate_session_locally: true,
    });
  }
  return ytClient;
}

/** Tách Video ID từ chuỗi nếu người dùng dán link YouTube */
function extractYouTubeId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  // Nếu là ID chuẩn 11 ký tự
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (pathParts[0] === "shorts" || pathParts[0] === "embed") {
        return pathParts[1] || null;
      }
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace("/", "");
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // Không phải URL hợp lệ
  }
  return null;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Bạn đã vượt quá giới hạn tìm kiếm (30 lần/phút). Vui lòng thử lại sau giây lát." },
      { status: 429 }
    );
  }

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ items: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ items: cached.data });
  }

  try {
    const extractedId = extractYouTubeId(query);
    const yt = await getInnertube();
    const results: SearchResultItem[] = [];

    if (extractedId) {
      // Người dùng dán link trực tiếp
      try {
        const info = await yt.getInfo(extractedId);
        const title = info.basic_info.title || "Video YouTube";
        const durationSec = info.basic_info.duration || 180;
        const thumbnail =
          info.basic_info.thumbnail?.[0]?.url ||
          `https://i.ytimg.com/vi/${extractedId}/hqdefault.jpg`;
        const author = info.basic_info.author || "YouTube";

        results.push({
          videoId: extractedId,
          title,
          durationSec,
          thumbnail,
          author,
        });
      } catch {
        // Fallback tối thiểu nếu không lấy được info
        results.push({
          videoId: extractedId,
          title: `Video (${extractedId})`,
          durationSec: 210,
          thumbnail: `https://i.ytimg.com/vi/${extractedId}/hqdefault.jpg`,
          author: "YouTube",
        });
      }
    } else {
      // Tìm kiếm theo từ khóa
      const searchRes = await yt.search(query, { type: "video" });
      const videos = searchRes.videos || [];

      for (const v of videos.slice(0, 15)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyV = v as any;
        const id = anyV.id;
        if (!id) continue;

        const title = anyV.title?.text || anyV.title?.toString() || "Video Karaoke";
        const durationSec = anyV.duration?.seconds || 180;
        const thumbnail =
          anyV.thumbnails?.[0]?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        const author = anyV.author?.name || anyV.author?.text || "YouTube";

        results.push({
          videoId: id,
          title,
          durationSec,
          thumbnail,
          author,
        });
      }
    }

    // Lưu vào Cache
    searchCache.set(cacheKey, {
      data: results,
      expiresAt: Date.now() + CONFIG.SEARCH_CACHE_TTL_MS,
    });

    return NextResponse.json({ items: results });
  } catch (err) {
    console.error("[YouTubeSearch] Lỗi tìm kiếm:", err);
    return NextResponse.json(
      { error: "Không thể tìm kiếm bài hát YouTube vào lúc này. Vui lòng thử dán link trực tiếp." },
      { status: 500 }
    );
  }
}
