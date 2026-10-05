"useclient";
/**
 * KaraRoom - Trang kiểm tra Design System (/styleguide).
 * Hiển thị đầy đủ bảng màu, kiểu chữ, thang kích thước và toàn bộ component dùng chung ở mọi trạng thái.
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mic, Volume2, SkipForward, Music, Settings, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Input } from "../../components/ui/Input";
import { Slider } from "../../components/ui/Slider";
import { Toggle } from "../../components/ui/Toggle";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Panel } from "../../components/ui/Panel";
import { Drawer } from "../../components/ui/Drawer";
import { Toast } from "../../components/ui/Toast";
import { Tooltip } from "../../components/ui/Tooltip";

export default function StyleguidePage() {
  const [sliderVal, setSliderVal] = useState(65);
  const [toggleVal, setToggleVal] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showToast, setShowToast] = useState(true);

  const colorTokens = [
    { token: "--bg", value: "#0B0A10", desc: "Nền trang" },
    { token: "--surface", value: "#15131D", desc: "Panel, thẻ" },
    { token: "--surface-raised", value: "#1F1C2B", desc: "Hover, popup, drawer" },
    { token: "--border", value: "#2E2A3D", desc: "Viền, đường kẻ" },
    { token: "--text", value: "#F4F1FA", desc: "Chữ chính" },
    { token: "--text-muted", value: "#9C96B0", desc: "Chữ phụ, nhãn" },
    { token: "--accent", value: "#FF3D81", desc: "Hành động chính, bài đang phát" },
    { token: "--live", value: "#3DF5C4", desc: "Mic đang mở, người đang hát" },
    { token: "--score", value: "#FFC247", desc: "Điểm số, màn công bố" },
    { token: "--danger", value: "#FF5C5C", desc: "Lỗi, hành động xoá" },
  ];

  const typographyScales = [
    { size: 12, name: "Caption / Meta", className: "text-[12px]" },
    { size: 14, name: "Body Regular", className: "text-[14px]" },
    { size: 16, name: "Body Large / Subheading", className: "text-[16px]" },
    { size: 20, name: "Card / Slot Title", className: "text-[20px]" },
    { size: 28, name: "Section Header", className: "text-[28px]" },
    { size: 40, name: "Hero / Headline", className: "text-[40px]" },
    { size: 72, name: "Score Display (Chỉ dùng cho điểm)", className: "text-[72px]" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6 md:p-12 max-w-5xl mx-auto space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[14px] text-[var(--text-muted)] hover:text-[var(--text)] mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Về trang chủ
          </Link>
          <h1 className="font-display font-bold text-[28px] md:text-[40px] text-[var(--text)]">
            KaraRoom Design System
          </h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-1">
            Không gian phòng karaoke về đêm: tối tĩnh, ánh sáng tập trung tại nơi đang có người hát.
          </p>
        </div>
        <Badge variant="live">Styleguide v1.0</Badge>
      </div>

      {/* 1. Color Tokens */}
      <section className="space-y-4">
        <h2 className="font-display text-[20px] font-semibold border-b border-[var(--border)] pb-2">
          1. Bảng màu (Tokens)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {colorTokens.map((c) => (
            <Panel key={c.token} className="p-3 space-y-2">
              <div
                className="h-12 w-full rounded-[6px] border border-[var(--border)] flex items-center justify-center font-mono-tabular text-[12px] font-bold"
                style={{
                  backgroundColor: `var(${c.token})`,
                  color: ["--accent", "--live", "--score", "--danger"].includes(c.token)
                    ? "var(--bg)"
                    : "var(--text)",
                }}
              >
                {c.value}
              </div>
              <div>
                <p className="font-mono-tabular text-[12px] font-semibold text-[var(--text)]">
                  {c.token}
                </p>
                <p className="text-[12px] text-[var(--text-muted)] leading-tight">{c.desc}</p>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      {/* 2. Typography */}
      <section className="space-y-4">
        <h2 className="font-display text-[20px] font-semibold border-b border-[var(--border)] pb-2">
          2. Kiểu chữ & Thang kích cỡ (12, 14, 16, 20, 28, 40, 72 px)
        </h2>
        <div className="space-y-4">
          {typographyScales.map((t) => (
            <div
              key={t.size}
              className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[var(--border)]/40 pb-3"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[12px] text-[var(--text-muted)] w-16">
                  {t.size}px
                </span>
                <span className="text-[12px] text-[var(--text-muted)]">{t.name}</span>
              </div>
              <div
                className={`${t.className} font-display text-[var(--text)] ${
                  t.size === 72 ? "text-[var(--score)] font-mono-tabular font-bold" : ""
                }`}
              >
                {t.size === 72 ? "98" : "KaraRoom Đồng Bộ Âm Nhạc"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Button Component */}
      <section className="space-y-4">
        <h2 className="font-display text-[20px] font-semibold border-b border-[var(--border)] pb-2">
          3. Nút bấm (Buttons)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel className="space-y-3">
            <h3 className="text-[14px] text-[var(--text-muted)] font-medium">Variants</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Primary (--accent)</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </Panel>

          <Panel className="space-y-3">
            <h3 className="text-[14px] text-[var(--text-muted)] font-medium">
              Trạng thái (Loading, Disabled, Sizes)
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small (36px)</Button>
              <Button size="md">Medium (44px)</Button>
              <Button size="lg">Large (48px)</Button>
              <Button loading>Đang tải</Button>
              <Button disabled>Bị vô hiệu</Button>
            </div>
          </Panel>
        </div>
      </section>

      {/* 4. Icon Buttons & Avatars */}
      <section className="space-y-4">
        <h2 className="font-display text-[20px] font-semibold border-b border-[var(--border)] pb-2">
          4. Icon Buttons & Avatars (Có hiệu ứng vòng sáng --live)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel className="space-y-3">
            <h3 className="text-[14px] text-[var(--text-muted)] font-medium">
              IconButton (Tối thiểu 44px)
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
              <IconButton label="Bật mic" variant="live">
                <Mic className="w-5 h-5 text-[var(--bg)]" />
              </IconButton>
              <IconButton label="Chính" variant="primary">
                <Music className="w-5 h-5" />
              </IconButton>
              <IconButton label="Cài đặt" variant="secondary">
                <Settings className="w-5 h-5" />
              </IconButton>
              <IconButton label="Bỏ qua" variant="ghost">
                <SkipForward className="w-5 h-5" />
              </IconButton>
              <IconButton label="Xóa" variant="danger">
                <Trash2 className="w-5 h-5" />
              </IconButton>
            </div>
          </Panel>

          <Panel className="space-y-3">
            <h3 className="text-[14px] text-[var(--text-muted)] font-medium">
              Avatar (Trạng thái tĩnh vs Vòng sáng nhịp mic)
            </h3>
            <div className="flex items-center gap-4">
              <Avatar name="Minh Đức" size="md" />
              <Avatar name="Hoàng Yến" size="lg" isLive={true} volumeLevel={0.4} />
              <Avatar name="Tuấn Anh" size="xl" isLive={true} volumeLevel={0.9} />
            </div>
          </Panel>
        </div>
      </section>

      {/* 5. Inputs, Sliders & Toggles */}
      <section className="space-y-4">
        <h2 className="font-display text-[20px] font-semibold border-b border-[var(--border)] pb-2">
          5. Ô nhập liệu, Slider & Toggle
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Panel className="space-y-3">
            <h3 className="text-[14px] text-[var(--text-muted)] font-medium">Ô nhập (Inputs)</h3>
            <Input placeholder="Nhập biệt danh của bạn..." />
            <Input
              leftIcon={<Music className="w-4 h-4" />}
              placeholder="Dán link hoặc tìm bài hát..."
            />
            <Input
              error="Mã phòng không tồn tại hoặc đã hết hạn"
              defaultValue="ABC123"
            />
          </Panel>

          <Panel className="space-y-4">
            <h3 className="text-[14px] text-[var(--text-muted)] font-medium">
              Slider & Toggle
            </h3>
            <Slider
              label="Âm lượng nhạc"
              valueDisplay={`${sliderVal}%`}
              value={sliderVal}
              min={0}
              max={100}
              onChange={setSliderVal}
            />
            <Toggle
              checked={toggleVal}
              onChange={setToggleVal}
              label="Nghe giọng bản thân (Monitor)"
              description="Khuyên dùng tai nghe có dây để tránh tiếng hú"
            />
          </Panel>
        </div>
      </section>

      {/* 6. Badges, Tooltip & Drawer */}
      <section className="space-y-4">
        <h2 className="font-display text-[20px] font-semibold border-b border-[var(--border)] pb-2">
          6. Badges, Tooltip, Drawer & Toast
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="accent">Đang phát</Badge>
          <Badge variant="live">Đang hát</Badge>
          <Badge variant="score">Điểm: 95</Badge>
          <Badge variant="default">Trưởng phòng</Badge>
          <Badge variant="muted">Khán giả</Badge>
          <Badge variant="danger">Rớt mạng</Badge>

          <Tooltip content="Độ trễ bù ước tính: 340ms">
            <Button variant="secondary" size="sm">
              Rê chuột xem Tooltip
            </Button>
          </Tooltip>

          <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
            Mở Drawer kiểm tra
          </Button>
        </div>

        {showToast && (
          <div className="pt-2">
            <Toast
              type="success"
              message="Đã thêm bài hát vào hàng chờ thành công!"
              onClose={() => setShowToast(false)}
            />
          </div>
        )}
      </section>

      {/* Drawer Demo */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Bảng Chỉnh Giọng Hát"
      >
        <div className="space-y-4 text-[14px]">
          <p className="text-[var(--text-muted)]">
            Đây là ngăn kéo chỉnh hiệu ứng giọng hát thời gian thực.
          </p>
          <Slider
            label="Độ vang (Reverb Wet)"
            valueDisplay="35%"
            value={35}
            min={0}
            max={100}
            onChange={() => {}}
          />
          <Button fullWidth variant="primary" onClick={() => setDrawerOpen(false)}>
            Lưu cài đặt
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
