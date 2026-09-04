import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteBackground } from "./components/site-background.js";
import { SiteFooter } from "./components/site-footer.js";

export const metadata: Metadata = {
  title: "JoJoPro 香港短租場地情報",
  description: "香港 pop-up、booth、展銷場地情報，來源公開、定期更新。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SiteBackground />
        <div className="page-content">{children}</div>
      </body>
    </html>
  );
}
