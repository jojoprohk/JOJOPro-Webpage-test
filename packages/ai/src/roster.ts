import type {
  IntakeInput,
  MultiVenueResult,
  VenueDraft,
  VenueDraftEntry,
} from "./types.js";

// 「樂妹式」結構化場地清單：每行一個場，格式約為
//   10-12良景B（代放三粒）
//   4-10天平新城（私人場代）
//   28-3/11石圍角（私人場）   ← 跨月
// 呢類格式規律，用規則直接拆比靠大模型列舉穩定，亦唔會漏行。

interface ParsedRow {
  month: number;
  startYear: number;
  endYear: number;
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
  venueName: string;
  zone: string;
  tag: string;
  raw: string;
}

// 一行開頭係日期範圍：「10-12」「8-15」「28-3/11」「31/10-2」「31-2/11」。
// 開始日可帶月份「31/10」；結束日可帶月份「3/11」或最尾「-2/11」。
const DATE_PREFIX_RE =
  /^(\d{1,2})(?:\/(\d{1,2}))?\s*[-–—]\s*(\d{1,2})(?:\/(\d{1,2}))?\s*(?:\/(\d{1,2}))?\b(.*)$/;

const MONTH_HEADING_RE = /(十[一二]?月|九|[九十]?月份|[0-9]{1,2})\s*月/;

function monthFromHeading(text: string): number | null {
  if (/十一/.test(text)) return 11;
  if (/十二/.test(text)) return 12;
  if (/十/.test(text) && !/十一|十二/.test(text)) return 10;
  if (/九/.test(text)) return 9;
  const m = text.match(/([0-9]{1,2})\s*月/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
}

function isAgentTag(tag: string): boolean {
  const t = tag.replace(/\s+/g, "");
  return (
    /代放|代租/.test(t) ||
    /私人場代|場代(?![表幣理])/.test(t) ||
    /代\s*(?:[0-9０-９一二三四五六七八九十]+\s*)?粒/.test(t)
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 解一條跨月日期範圍。開始日 d1、結束日 d2（均 1-31）；
// m2start = 開始日後面標住嘅月份（31/10），mAfter = 結束日後/最尾標住嘅月份（/11）；
// headingMonth = 目前月份欄標題。傳回最合理（日期真實存在、唔倒轉、最貼近月份欄）嘅解法。
function resolveRange(
  d1: number,
  d2: number,
  m2start: number | null,
  mAfter: number | null,
  headingMonth: number,
  year: number,
): { startMonth: number; endMonth: number; startYear: number; endYear: number } {
  type Cand = {
    startMonth: number;
    endMonth: number;
    startYear: number;
    endYear: number;
  };

  const wrap = (startMonth: number, endMonth: number): Cand => {
    let sy = year;
    let ey = year;
    let sm = startMonth;
    let em = endMonth;
    while (sm < 1) {
      sm += 12;
      sy -= 1;
    }
    while (sm > 12) {
      sm -= 12;
      sy += 1;
    }
    while (em < 1) {
      em += 12;
      ey -= 1;
    }
    while (em > 12) {
      em -= 12;
      ey += 1;
    }
    // 跨年：結束月喺年份上「早過」開始月先加一年；同年但月份較大（11→12）唔加。
    if (em < sm) ey += 1;
    return { startMonth: sm, endMonth: em, startYear: sy, endYear: ey };
  };

  const valid = (c: Cand): boolean =>
    d1 <= daysInMonth(c.startYear, c.startMonth) &&
    d2 <= daysInMonth(c.endYear, c.endMonth) &&
    (c.endYear > c.startYear ||
      c.endMonth > c.startMonth ||
      (c.endMonth === c.startMonth && d2 >= d1));

  // 優先保留開始日真實存在嘅解法（例如 31/10 合法、31/11 唔合法）。
  const startExists = (c: Cand): boolean =>
    d1 <= daysInMonth(c.startYear, c.startMonth);

  const dist = (c: Cand): number =>
    Math.min(
      Math.abs(c.startMonth - headingMonth),
      12 - Math.abs(c.startMonth - headingMonth),
    );

  const candidates: Cand[] = [];

  if (m2start !== null) {
    // 開始月有明示（31/10-2）。
    candidates.push(wrap(m2start, mAfter ?? (d2 < d1 ? m2start + 1 : m2start)));
  } else if (mAfter !== null) {
    // 最尾 /N 明示「結束日屬 N 月」（例如 31-2/11 → 2/11、28-3/11 → 3/11、
    // 27-4/12 → 4/12）。結束日細過開始日就一定係跨月：開始日屬 N 月嘅上一個月
    // （31-2/11 → 10/31~11/2；28-3/11 → 10/28~11/3）。結束日大過或等於開始日
    // 就同月（例如 20-26/11 → 11/20~11/26）。呢個規則由日期記法本身決定，
    // 唔靠估開始月，亦唔理開始日喺 N 月存唔存在。
    candidates.push(wrap(d2 < d1 ? mAfter - 1 : mAfter, mAfter));
  } else {
    // 冇標月份：同月，或結束日細過開始日就跨下個月。
    const sm = headingMonth;
    candidates.push(wrap(sm, d2 < d1 ? sm + 1 : sm));
  }

  // 先剔走開始日唔存在（例如 11 月 31 日）嘅解法，再要求完整合理（唔倒轉）。
  const startOk = candidates.filter(startExists);
  const good = (startOk.length > 0 ? startOk : candidates).filter(valid);
  const pool = good.length > 0 ? good : startOk.length > 0 ? startOk : candidates;
  pool.sort((a, b) => dist(a) - dist(b));
  return pool[0] ?? wrap(headingMonth, headingMonth);
}

function parseRow(line: string, month: number, year: number): ParsedRow | null {
  const cleaned = line.replace(/[*🔥😁🎀🛍️🈹🉑]/g, "").trim();
  const m = DATE_PREFIX_RE.exec(cleaned);
  if (!m) return null;

  const startDay = Number(m[1]);
  const endDay = Number(m[3]);
  const m2start = m[2] ? Number(m[2]) : null;
  const mAfter = m[4] ? Number(m[4]) : m[5] ? Number(m[5]) : null;
  const range = resolveRange(
    startDay,
    endDay,
    m2start,
    mAfter,
    month,
    year,
  );
  const startMonth = range.startMonth;
  const endMonth = range.endMonth;

  const rest = (m[6] ?? "").trim();
  // 拆出括號標記 同 場名/區位。
  const tagMatch = rest.match(/[（(]([^）)]*)[）)]/);
  const tag = (tagMatch?.[1] ?? "").trim();
  const namePart = rest.replace(/[（(][^）)]*[）)]/g, "").trim();
  // 場名：一連串中文（可含邨/商場/中心/新城等），緊接可選英數區位（A、B、C2、A2、01）。
  const nameMatch = namePart.match(
    /^([\u4e00-\u9fff][\u4e00-\u9fff]{1,11}?)\s*([A-Za-z0-9]{0,3})$/,
  );
  let venueName = nameMatch?.[1]?.trim() || namePart;
  const zone = nameMatch?.[2]?.trim() || "";
  // 「28-3/11月石圍角」呢類跨月寫法，開頭個「月」字係上一個日期嘅一部分，
  // 唔係場名，要剔走。
  venueName = venueName.replace(/^月+/, "").trim();
  venueName = venueName.replace(/[（(].*$/, "").trim();

  // 剔走明顯唔係場地（例如標題行「9-11月份領展及私人商場展銷攤位」）。
  if (!venueName || venueName.length < 2) return null;
  if (/攤位|展銷|月份|領展/.test(rest)) {
    return null;
  }

  return {
    month: startMonth,
    startYear: range.startYear,
    endYear: range.endYear,
    startDay,
    startMonth,
    endDay,
    endMonth,
    venueName,
    zone,
    tag,
    raw: cleaned,
  };
}

function buildDraft(
  row: ParsedRow,
  contact: { text: string | null; waLink: string | null },
): VenueDraft {
  const startDate = `${row.startYear}-${pad(row.startMonth)}-${pad(row.startDay)}`;
  const endDate = `${row.endYear}-${pad(row.endMonth)}-${pad(row.endDay)}`;
  const isPrivate = /私人場/.test(row.tag);

  const title = `${row.venueName}${row.zone ? row.zone : ""} ${row.startDay}-${row.endDay}${
    row.endMonth !== row.startMonth ? "/" + pad(row.endMonth) : ""
  }`.trim();

  return {
    title,
    district: null,
    venueName: row.venueName + (row.zone ? ` ${row.zone}` : ""),
    sessionDates: [],
    startDate,
    endDate,
    priceText: null,
    priceAmountHkd: null,
    priceUnit: "unknown",
    boothSizeText: row.tag || null,
    contactText: contact.text,
    contactWhatsappLink: contact.waLink,
    areaType: isPrivate ? "private_venue" : "market",
    hasAircon: null,
    isPrimeSpot: false,
    isCartSpot: false,
    allowsFood: null,
    allowsDryGoods: null,
    allowsBeauty: null,
    allowsService: null,
    requiresProductApproval: false,
    isUrgent: false,
    isDiscounted: /特|平|割|🉐|🈹/.test(row.tag),
    summary: `${row.venueName}${row.zone ? " " + row.zone : ""}，${startDate} 至 ${endDate}${
      isPrivate ? "（私人場）" : ""
    }；租金未列明。`,
  };
}

// 偵測係咪「樂妹式」清單，並逐行拆做場地。唔係呢類格式就回 null（交返俾大模型）。
export function parseRosterPost(
  input: IntakeInput,
  receivedYear: number,
): MultiVenueResult | null {
  if ((input.photoFileIds?.length ?? 0) > 0) return null; // 圖片交俾 vision
  const raw = input.rawContent;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dateRows: ParsedRow[] = [];
  let currentMonth = new Date().getMonth() + 1;
  let matchedHeading = false;

  for (const line of lines) {
    const cleanedLine = line.replace(/[*🔥😁🎀🛍️🈹🉑]/g, "").trim();
    const hm = monthFromHeading(cleanedLine);
    if (hm && /月/.test(cleanedLine) && cleanedLine.length <= 12) {
      currentMonth = hm;
      matchedHeading = true;
      continue;
    }

    const row = parseRow(line, currentMonth, receivedYear);
    if (row) dateRows.push(row);
  }

  // 要似清單：至少 8 個日期行，而且有月份標題。呢個門檻避開普通單一場貼文
  // （嗰啲通常 1-3 行日期），亦確保係「樂妹式」大排檔清單先用規則解析。
  if (!matchedHeading || dateRows.length < 8) return null;

  // 清單通常喺最尾附一個共用聯絡（wa.me link）。全清單共用同一個聯絡人。
  const waMatch = raw.match(/wa\.me\/(852)?(\d{6,8})/i);
  const contact = waMatch
    ? {
        text: `WhatsApp ${waMatch[2] ?? ""}`,
        waLink: `https://wa.me/${waMatch[1] ? "852" : ""}${waMatch[2] ?? ""}`,
      }
    : { text: null, waLink: null };

  const entries: VenueDraftEntry[] = dateRows.map((row) => {
    const agent = isAgentTag(row.tag);
    const crossMonth =
      row.startMonth !== row.endMonth || row.startYear !== row.endYear;
    return {
      draft: buildDraft(row, contact),
      confidenceScore: agent ? 40 : 78,
      lowConfidenceFields: ["priceText", "contactText", "district"],
      unconfirmedFields: [
        "priceText",
        "contactText",
        "district",
        ...(crossMonth ? (["startDate", "endDate"] as const) : []),
      ] as VenueDraftEntry["unconfirmedFields"],
      reviewNote: agent
        ? "⚠️ 代放/代理資訊，非業主直接發布，需向場地核實，唔好直接發布。"
        : crossMonth
          ? "跨月/跨年日期，需人手核對。租金未列明，建議直接聯絡業主或出租負責人查詢。"
          : "租金未列明，建議直接聯絡業主或出租負責人查詢。",
      isAgentListing: agent,
    };
  });

  return {
    isVenuePost: true,
    entries,
    note: `結構化場地清單，已按行拆出 ${entries.length} 個場（規則解析，未經大模型）。`,
  };
}
