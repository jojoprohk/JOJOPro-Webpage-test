"use client";

import { useCallback, useEffect, useState } from "react";
import { DraftCard } from "./draft-card";
import type { Draft } from "./review-lib";

export default function ReviewPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const res = await fetch("/api/review/drafts?status=needs_review", {
      cache: "no-store",
    });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (!res.ok) {
      setLoadError("載入草稿失敗，請重試。");
      return;
    }
    const data = (await res.json()) as { drafts?: Draft[] };
    setDrafts(data.drafts ?? []);
    setAuthed(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/review/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setLoginError("密碼錯誤。");
        return;
      }
      setAuthed(true);
      await load();
    } catch {
      setLoginError("登入失敗，請重試。");
    } finally {
      setLoggingIn(false);
    }
  }

  if (authed === null) {
    return (
      <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <p>載入中…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main
        style={{
          maxWidth: 360,
          margin: "80px auto",
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h1 style={{ fontSize: 18, marginTop: 0 }}>JoPoJo 審核後台</h1>
        <form onSubmit={login}>
          <label style={{ fontSize: 13, color: "#555" }}>審核密碼</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "8px",
              margin: "6px 0 12px",
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            disabled={loggingIn}
            style={{
              width: "100%",
              padding: "10px",
              background: "#222",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: loggingIn ? "default" : "pointer",
            }}
          >
            {loggingIn ? "登入中…" : "登入"}
          </button>
          {loginError && (
            <p style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>
              {loginError}
            </p>
          )}
        </form>
      </main>
    );
  }

  const pending = drafts ?? [];

  return (
    <main style={{ maxWidth: 820, margin: "24px auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h1 style={{ fontSize: 20 }}>待審核場地</h1>
        <span style={{ fontSize: 13, color: "#666" }}>
          {pending.length} 張草稿
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#777" }}>
        黃色格 = AI 唔肯定／要你核對。改完撳「批准」，唔收錄就「拒絕」。
      </p>

      {loadError && <p style={{ color: "#c0392b" }}>{loadError}</p>}
      {drafts === null && <p>載入中…</p>}
      {drafts !== null && pending.length === 0 && (
        <p style={{ color: "#555" }}>
          冇待審核草稿。將場地貼文 forward 去 Telegram bot 就會喺呢度出現。
        </p>
      )}

      {pending.map((d) => (
        <DraftCard
          key={d.id}
          draft={d}
          onDone={(id) =>
            setDrafts((list) => (list ?? []).filter((x) => x.id !== id))
          }
        />
      ))}
    </main>
  );
}
