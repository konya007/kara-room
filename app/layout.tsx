import type { Metadata } from "next";
import { Unbounded, Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const unbounded = Unbounded({
  subsets: ["latin", "vietnamese"],
  variable: "--font-unbounded",
  display: "swap",
});

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KaraRoom - Phòng Karaoke Đồng Bộ Realtime",
  description:
    "Nền tảng phòng karaoke realtime đồng bộ nhạc YouTube và giọng hát WebRTC với độ trễ thấp.",
  openGraph: {
    title: "KaraRoom - Phòng Karaoke Đồng Bộ Realtime",
    description:
      "Nền tảng phòng karaoke realtime đồng bộ nhạc YouTube và giọng hát WebRTC với độ trễ thấp.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KaraRoom - Phòng Karaoke Đồng Bộ Realtime",
    description:
      "Nền tảng phòng karaoke realtime đồng bộ nhạc YouTube và giọng hát WebRTC với độ trễ thấp.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${unbounded.variable} ${beVietnamPro.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-[var(--bg)] text-[var(--text)] min-h-screen selection:bg-[var(--accent)] selection:text-[var(--bg)]"
      >
        {children}
      </body>
    </html>
  );
}
