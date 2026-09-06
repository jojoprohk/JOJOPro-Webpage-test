import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_TC, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { SiteBackground } from "./components/site-background.js";
import { SiteFooter } from "./components/site-footer.js";

// 主字體 — Noto Sans JP（日文 gothic，next/font/google 自動 self-host）。
// 源柔ゴシック 本地 woff2 嘅 fallback：保留 fonts/ 目錄以備日後換返。
const genjyuu = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  variable: "--font-genjyuu",
  display: "swap",
  preload: false,
});

// 繁體中文 fallback — Noto Sans TC 喺 Google Fonts（無 subset param）。
const notoTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  variable: "--font-noto-tc",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "JoJoPro 租租舖 · 香港短租場地情報",
  description: "JoJoPro 租租舖 — 香港 pop-up、booth、展銷場地情報，來源公開、定期更新。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-Hant"
      className={`${genjyuu.variable} ${notoTC.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <SiteBackground />
        <div className="page-content">{children}</div>
      </body>
    </html>
  );
}
