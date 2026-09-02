"use client";

import { useState } from "react";

const STORAGE_KEY = "jopojo-reported-listings";

function readReported(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    // localStorage 不可用（無痕模式等）就當冇記錄。
  }
  return new Set();
}

export function ReportButton({ listingId }: { listingId: string }) {
  const [reported, setReported] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return readReported().has(listingId);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function report() {
    if (busy || reported) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/listings/${listingId}/report`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const set = readReported();
      set.add(listingId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
      } catch {
        // 寫唔入都唔影響回報已成功。
      }
      setReported(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (reported) {
    return (
      <span style={{ fontSize: 12, color: "#16a34a" }}>
        已回報，多謝。
      </span>
    );
  }

  return (
    <span>
      <button
        type="button"
        onClick={() => void report()}
        disabled={busy}
        style={{
          fontSize: 12,
          color: "#78716c",
          background: "none",
          border: "none",
          padding: 0,
          textDecoration: "underline",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "回報中…" : "回報資料過期／有誤"}
      </button>
      {error ? (
        <span style={{ fontSize: 12, color: "#dc2626", marginLeft: 8 }}>
          回報失敗，請稍後再試。
        </span>
      ) : null}
    </span>
  );
}
