# Phase 4 設計 spec — Typography + Mid-Autumn Mood

最後更新：2026-09-04
狀態：進行中（中秋開窗 9/4-9/27）

呢份 spec 處理兩件 design 決定：

1. **全站字體** — 源柔ゴシック + 繁體中文 fallback，加 typography scale
2. **中秋 mood（時效性裝飾）** — 兩隻 SVG 元素，加 MID_AUTUMN_2026 feature flag

兩者都係「公開頁視覺」範圍，屬於品味決定。

---

## A. Typography

### A.1 字體選擇

- **主字體**：源柔ゴシック（Gen Jyuu Gothic）
  - 由 鍋田 慶 / fln 製作嘅開源日文 gothic
  - SIL Open Font License 1.1（商用免費，**需要 source attribution**）
  - **用 `next/font/local`**載入（next/font/google 唔支援呢個 font 名）
  - weights：`400`（Regular）、`500`（Medium）、`700`（Bold）
- **繁體中文 fallback**：Noto Sans TC（400/500/700），next/font/google
- **系統 fallback**：`-apple-system, BlinkMacSystemFont, "PingFang HK", "Microsoft JhengHei", sans-serif`

最終 CSS font-family stack：

```
"源柔ゴシック", "Gen Jyuu Gothic", "Noto Sans TC",
-apple-system, BlinkMacSystemFont, "PingFang HK", "Microsoft JhengHei", sans-serif
```

源柔ゴシック冇嘅字（主要係繁體中文異體）由 Noto Sans TC 接力。

### A.2 載入方式

- 源柔ゴシック：`next/font/local`，3 個 .woff2 放 `apps/web/src/app/fonts/`，產 `--font-genjyuu`
- Noto Sans TC：`next/font/google`，產 `--font-noto-tc`（無 subset param）
- 兩個 font 都用 `display: "swap"`，`variable` mode
- 喺 `layout.tsx` 將 `${genjyuu.variable} ${notoTC.variable}` 加去 `<html>` 嘅 className
- 喺 `globals.css :root` 將 `--font` 改成新 stack

源 attribution 加喺 `disclaimer/page.tsx` 嘅頁尾（"字體來源" 一節）。

### A.3 Typography scale（CSS 變數）

| Token | Size | 用處 |
|---|---|---|
| `--text-xs` | 11px | eyebrow / meta 細標 |
| `--text-sm` | 13px | badge / small caption |
| `--text-base` | 15px | body 正文 |
| `--text-md` | 17px | tagline / intro |
| `--text-lg` | 22px | card title / h3 |
| `--text-xl` | 26px | brand / nav |
| `--text-2xl` | clamp(28px, 3.6vw, 40px) | section h2 |
| `--text-display` | clamp(42px, 7.2vw, 92px) | hero h1 |

行高同字距維持現狀：
- `body`: `line-height: 1.5`
- `h1/h2/h3`: `line-height: 1.08`，`letter-spacing: -0.02em`

### A.4 唔做啲咩

- 唔引入多過 3 個 weights（400/500/700 夠用；900 用 system 黑體）
- 唔做 variable font 設定（源柔ゴシック static font 已夠）
- 唔改現有 hero h1 嘅 clamp 範圍同 line-height
- 唔改 `brand` 嘅 26px / 900 weight（保持品牌字重感）

---

## B. Mid-Autumn Mood

### B.1 觸發條件

- Feature flag：**`MID_AUTUMN_2026`**（常數，喺 `apps/web/src/lib/seasonal.ts`）
- 預設開窗：**2026-09-04 至 2026-09-27**（香港時區 UTC+8）
- 過咗 9/27 自動消失

判定用 `todayInHongKong()`（`lib/listing-filter.ts` 已有），server / client 兩邊都安全。

### B.2 兩個元素

兩隻都係純 SVG，inline 喺 component 內，無外部檔案，`pointer-events: none`、`aria-hidden="true"`。

#### B.2.a FloatingRabbitLantern（飄浮兔仔燈籠）

- **位置**：fixed 右上，`top: clamp(72px, 9vh, 110px)`、`right: clamp(14px, 2.4vw, 32px)`
- **尺寸**：64×80px
- **動畫**（非 reduced-motion）：整體上下飄 8s + 燈籠微擺 5s

#### B.2.b MoonGazingRabbit（望月白兔）

- **位置**：fixed 右下，`bottom: clamp(20px, 3vh, 40px)`、`right: clamp(20px, 3vw, 48px)`
- **尺寸**：120×120px
- **動畫**（非 reduced-motion）：月亮極慢漂 12s，白兔靜止

#### B.2.c 層級

```
<SiteBackground /> z-index: 0
<SeasonalDecorations> z-index: 1
  ├ FloatingRabbitLantern
  └ MoonGazingRabbit
<div className="page-content">     z-index: 1
```

### B.3 唔做啲咩

- 唔加配樂 / 音效 / 互動 / hover 動畫
- 唔改 SiteBackground 嘅 WebGL
- 唔出 review page（只係公開 `/` 同 `/disclaimer` 出現）
- 唔影響 listing card / filter / hero h1 排版

### B.4 開關 / 後續

- 改期 / 提早收檔：直接改 `MID_AUTUMN_2026` 常數
- 之後其他節日：加新 flag 喺 `seasonal.ts`
- 永久移除：刪 `seasonal.ts` + layout import + components

---

## C. 唔做嘅嘢（總）

- 唔出 chat、報名、預約功能
- 唔做 A/B testing
- 唔變 listing DTO
- 唔加新 page route
- 唔引入新 npm 依賴

---

## D. 開放問題

- 兔仔燈籠擺右上定左上？（揀右上）
- 望月兔擺右下定內嵌 hero？（揀右下 fixed）
- 顏色飽和度：依家偏柔，唔搶 WebGL 嘅桃粉
- 中秋過咗 9/27 之後，兩隻元素直接 unmount

任何一項改，spec 先改、code 後改。
