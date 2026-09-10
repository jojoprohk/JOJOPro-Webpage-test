"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, Lock, ArrowLeft, CheckCircle2, XCircle, Search } from "lucide-react";
import { DraftCard, type CardAct } from "./draft-card";
import { ApprovedCard } from "./approved-card";
import { Reveal, RevealGrid } from "../components/motion.js";
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
  // 已批准分頁嘅搜尋字串（搜 title / district / venue_name / source_label / price_text）
  const [approvedQuery, setApprovedQuery] = useState("");

  const actsRef = useRef<Map<string, CardAct>>(new Map());
  const registerAct = useCallback((id: string, act: CardAct) => {
    actsRef.current.set(id, act);
  }, []);

  // 由 ApprovedCard 改動之後更新本地 list，咁 reload 前嘅 UI 都即時反映。
  const updateApproved = useCallback((next: Draft) => {
    setApproved((prev) =>
      (prev ?? []).map((d) => (d.id === next.id ? next : d)),
    );
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

  function handleResult(id: string, action: "approve" | "reject" | "save") {
    // 純儲存：唔移走張卡，等用戶繼續改／稍後先批准。
    if (action === "save") return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    window.setTimeout(() => {
      setDrafts((list) => (list ?? []).filter((d) => d.id !== id));
      if (action === "approve") void load();
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
      <main className="wrap wrap--narrow loading" style={{ paddingTop: 40 }}>
        載入中…
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="wrap" style={{ paddingTop: 0 }}>
        <div className="card login-card">
          <h1 className="login-title">
            <Lock />
            JoJoPro 審核後台
          </h1>
          <form onSubmit={login}>
            <label htmlFor="review-password" className="field-label">
              審核密碼
            </label>
            <input
              id="review-password"
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={loggingIn} className="btn btn--primary btn--block">
              {loggingIn ? "登入中…" : "登入"}
            </button>
            {loginError && <p className="login-error">{loginError}</p>}
          </form>
        </div>
      </main>
    );
  }

  const pending = drafts ?? [];
  const approvedList = approved ?? [];
  // 過濾 approved list：match title / venue_name / district / source_label / price_text
  const approvedQueryTrim = approvedQuery.trim().toLowerCase();
  const filteredApproved = approvedQueryTrim === ""
    ? approvedList
    : approvedList.filter((d) => {
        const hay = [
          d.title,
          d.venue_name ?? "",
          d.district ?? "",
          d.intake?.source_label ?? "",
          d.price_text ?? "",
          d.booth_size_text ?? "",
          d.contact_text ?? "",
        ].join(" ").toLowerCase();
        return hay.includes(approvedQueryTrim);
      });
  const allSelected = pending.length > 0 && selected.size === pending.length;

  return (
    <main className="wrap wrap--narrow" style={{ paddingTop: 28 }}>
      <div className="review-header">
        <h1 className="review-title">
          <ClipboardCheck />
          場地審核
        </h1>
        <a href="/" className="review-home">
          <ArrowLeft />
          返公開頁
        </a>
      </div>

      <div className="tabs">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={"tab" + (tab === "pending" ? " tab--active" : "")}
        >
          待審核
          <span className="tab-count">{pending.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("approved")}
          className={"tab" + (tab === "approved" ? " tab--active" : "")}
        >
          已批准
          <span className="tab-count">{approvedList.length}</span>
        </button>
      </div>

      {loadError && <p className="review-error">{loadError}</p>}

      {tab === "pending" ? (
        <>
          <p className="review-hint">
            黃色欄位 = AI 唔肯定／要核對。改完撳「批准」；唔改就勾選左邊，用底部批量掣。
          </p>

          {drafts === null && <p className="loading">載入中…</p>}
          {drafts !== null && pending.length === 0 && (
            <p className="notice">
              冇待審核草稿。將場地貼文 forward 去 Telegram bot 就會喺呢度出現。
            </p>
          )}

          {pending.length > 0 && (
            <label className="select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              全選（{pending.length} 張）
            </label>
          )}

          {drafts !== null && (
            <RevealGrid>
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
            </RevealGrid>
          )}

          {selected.size > 0 && (
            <Reveal y={18}>
              <div className="batch-bar">
                <span className="batch-count">已選 {selected.size} 張</span>
                <button
                  type="button"
                  disabled={batchBusy}
                  onClick={() => void runBatch("approve")}
                  className="btn btn--success btn--sm"
                >
                  <CheckCircle2 />
                  {batchBusy ? "處理中…" : "批量批准"}
                </button>
                <button
                  type="button"
                  disabled={batchBusy}
                  onClick={() => void runBatch("reject")}
                  className="btn btn--reject-ghost btn--sm"
                >
                  <XCircle />
                  批量拒絕
                </button>
                {batchMsg && <span className="batch-msg">{batchMsg}</span>}
              </div>
            </Reveal>
          )}
        </>
      ) : (
        <>
          {approved === null && <p className="loading">載入中…</p>}
          <div className="review-search">
            <Search size={16} />
            <input
              type="search"
              value={approvedQuery}
              onChange={(e) => setApprovedQuery(e.target.value)}
              placeholder="搜尋標題、地區、場地名、來源、價錢…"
              aria-label="搜尋已批准場地"
            />
            {approvedQuery && (
              <span className="review-search__count">
                {filteredApproved.length} / {approvedList.length}
              </span>
            )}
          </div>
          {approved !== null && approvedList.length === 0 && (
            <p className="notice">未有已批准場地。</p>
          )}
          {approved !== null && approvedList.length > 0 && filteredApproved.length === 0 && (
            <p className="notice">冇符合「{approvedQuery}」嘅已批准場地。</p>
          )}
          {approved !== null && filteredApproved.length > 0 && (
            <RevealGrid>
              {filteredApproved.map((d) => (
                <ApprovedCard key={d.id} draft={d} onChanged={updateApproved} />
              ))}
            </RevealGrid>
          )}
        </>
      )}
    </main>
  );
}
