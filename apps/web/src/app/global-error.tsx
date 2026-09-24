"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-Hant">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f5f2ec",
          color: "#1f1d1a",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <main
          style={{
            width: "min(100% - 40px, 520px)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            JoJoPro
          </p>
          <h1 style={{ margin: "0 0 16px", fontSize: 30, lineHeight: 1.25 }}>
            暫時未能載入頁面
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 16, lineHeight: 1.7 }}>
            系統已經記錄問題，請稍後再試。
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "12px 22px",
              background: "#1f1d1a",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            重新載入
          </button>
        </main>
      </body>
    </html>
  );
}
