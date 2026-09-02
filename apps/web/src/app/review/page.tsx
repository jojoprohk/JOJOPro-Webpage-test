"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DraftCard, type CardAct } from "./draft-card";
import { ApprovedCard } from "./approved-card";
import type { Draft } from "./review-lib";

type Tab = "pending" | "approved";

export default function ReviewPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>("pending");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [approved, setApproved] = useState<Draft[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMsg, setBatchMsg] = useState("");

  const actsRef = useRef<Map<string, CardAct>>(new Map());
  const registerAct = useCallback((id: string, act: CardAct) => {
    actsRef.current.set(id, act);
  }, []);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        fetch("/api/review/drafts?status=needs_review", { cache: "no-store" }),
        fetch("/api/review/drafts?status=approved", { cache: "no-store" }),
      ]);
      if (pendingRes.status === 401 || approvedRes.status === 401) {
        setAuthed(false);
        return;
      }
      if (!pendingRes.ok || !approvedRes.ok) {
        setLoadError("載入草稿失敗，請重試。");
        return;
      }
      const pendingData = (await pendingRes.json()) as { drafts?: Draft[] };
      const approvedData = (await approvedRes.json()) as { drafts?: Draft[] };
      setDrafts(pendingData.drafts ?? []);
      setApproved(approvedData.drafts ?? []);
      setAuthed(true);
    } catch {
      setLoadError("載入失敗，請檢查網絡。");
    }
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

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    const list = drafts ?? [];
    setSelected(checked ? new Set(list.map((d) => d.id)) : new Set());
  }

  // 單張完成：短暫顯示狀態橫額後，先從待審列表移除，再刷新已批准列表。
  function handleResult(id: string, action: "approve" | "reject") {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    window.setTimeout(() => {
      setDrafts((list) => (list ?? []).filter((d) => d.id !== id));
      if (action === "approve") {
        void load();
      }
    }, 1200);
  }

  async function runBatch(action: "approve" | "reject") {
    const ids = [...selected];
    if (ids.length === 0 || batchBusy) return;
    setBatchBusy(true);
    setBatchMsg("");
    let okCount = 0;
    let failCount = 0;
    for (const id of ids) {
      const act = actsRef.current.get(id);
      if (!act) {
        failCount++;
        continue;
      }
      const ok = await act(action);
      if (ok) okCount++;
      else failCount++;
    }
    setBatchMsg(
      `已${action === "approve" ? "批准" : "拒絕"} ${okCount} 張` +
        (failCount > 0 ? `，${failCount} 張失敗` : ""),
    );
    setBatchBusy(false);
    window.setTimeout(() => void load(), 1300);
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
  const approvedList = approved ?? [];
  const allSelected = pending.length > 0 && selected.size === pending.length;

  return (
    <main style={{ maxWidth: 820, margin: "24px auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h1 style={{ fontSize: 20 }}>場地審核</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setTab("pending")}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: tab === "pending" ? "#222" : "#fff",
            color: tab === "pending" ? "#fff" : "#222",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          待審核（{pending.length}）
        </button>
        <button
          type="button"
          onClick={() => setTab("approved")}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: tab === "approved" ? "#222" : "#fff",
            color: tab === "approved" ? "#fff" : "#222",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          已批准（{approvedList.length}）
        </button>
      </div>

      {loadError && <p style={{ color: "#c0392b" }}>{loadError}</p>}

      {tab === "pending" ? (
        <>
          <p style={{ fontSize: 13, color: "#777" }}>
            黃色格 = AI 唔肯定／要核對。改完撳「批准」；唔改就勾選左邊，用底部批量掣。
          </p>

          {drafts === null && <p>載入中…</p>}
          {drafts !== null && pending.length === 0 && (
            <p style={{ color: "#555" }}>
              冇待審核草稿。將場地貼文 forward 去 Telegram bot 就會喺呢度出現。
            </p>
          )}

          {pending.length > 0 && (
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
                marginBottom: 12,
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              全選
            </label>
          )}

          {pending.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              selected={selected.has(d.id)}
              onToggleSelect={toggleSelect}
              onResult={handleResult}
              registerAct={registerAct}
            />
          ))}

          {selected.size > 0 && (
            <div
              style={{
                position: "sticky",
                bottom: 16,
                background: "#222",
                color: "#fff",
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 14 }}>已選 {selected.size} 張</span>
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => void runBatch("approve")}
                style={{
                  padding: "8px 16px",
                  background: "#1a7f37",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: batchBusy ? "default" : "pointer",
                  fontSize: 14,
                }}
              >
                {batchBusy ? "處理中…" : "批量批准"}
              </button>
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => void runBatch("reject")}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#ffb4ab",
                  border: "1px solid #ffb4ab",
                  borderRadius: 6,
                  cursor: batchBusy ? "default" : "pointer",
                  fontSize: 14,
                }}
              >
                批量拒絕
              </button>
              {batchMsg && (
                <span style={{ fontSize: 13, color: "#bdf5c8" }}>{batchMsg}</span>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {approved === null && <p>載入中…</p>}
          {approved !== null && approvedList.length === 0 && (
            <p style={{ color: "#555" }}>未有已批准場地。</p>
          )}
          {approvedList.map((d) => (
            <ApprovedCard key={d.id} draft={d} />
          ))}
        </>
      )}
    </main>
  );
}
