import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "JoPoJo 香港短租場地",
  description: "香港 pop-up、booth、展銷場地情報，來源公開、定期更新。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body suppressHydrationWarning
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang HK", "Microsoft JhengHei", sans-serif',
          background: "#f5f5f4",
          color: "#1c1917",
          lineHeight: 1.5,
        }}
      >
        {children}
      </body>
    </html>
  );
}
