/**
 * KaraRoom - Hộp thoại tìm kiếm và thêm bài hát YouTube (SongSearchModal).
 * Gọi API nội bộ /api/youtube/search, hỗ trợ tìm theo từ khóa hoặc dán link YouTube.
 */

import React, { useState } from "react";
import { Search, Loader2, Music2, Plus, Link as LinkIcon } from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { SearchResultItem } from "../../app/api/youtube/search/route";

interface SongSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSong: (song: { videoId: string; title: string; durationSec: number; thumbnail: string }) => void;
}

export const SongSearchModal: React.FC<SongSearchModalProps> = ({
  isOpen,
  onClose,
  onAddSong,
}) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không thể tìm kiếm bài hát lúc này.");
      } else {
        setResults(data.items || []);
      }
    } catch {
      setError("Lỗi kết nối khi tìm kiếm bài hát.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSong = (item: SearchResultItem) => {
    onAddSong({
      videoId: item.videoId,
      title: item.title,
      durationSec: item.durationSec,
      thumbnail: item.thumbnail,
    });
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Tìm bài hát Karaoke">
      <div className="space-y-4">
        {/* Form tìm kiếm */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên bài hát, ca sĩ, hoặc dán link YouTube..."
            leftIcon={<Search className="w-4 h-4" />}
            autoFocus
          />
          <Button type="submit" variant="primary" loading={loading} className="shrink-0">
            Tìm
          </Button>
        </form>

        {error && <p className="text-[13px] text-[var(--danger)]">{error}</p>}

        {/* Danh sách kết quả */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {results.map((item) => (
            <div
              key={item.videoId}
              onClick={() => handleSelectSong(item)}
              className="p-2.5 rounded-[10px] bg-[var(--surface-raised)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer flex items-center justify-between gap-3 transition-colors group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Thumbnail */}
                <div className="w-16 h-11 bg-black rounded-[6px] overflow-hidden shrink-0 relative">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                      <Music2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Tiêu đề & tác giả */}
                <div className="truncate">
                  <p className="text-[13px] font-medium text-[var(--text)] group-hover:text-[var(--accent)] truncate transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                    {item.author}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 shrink-0 group-hover:bg-[var(--accent)] group-hover:text-[var(--bg)] text-[12px]"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm
              </Button>
            </div>
          ))}

          {results.length === 0 && !loading && (
            <div className="text-center py-8 text-[var(--text-muted)] text-[13px]">
              Nhập từ khóa tìm kiếm hoặc dán đường link video YouTube để thêm bài.
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
