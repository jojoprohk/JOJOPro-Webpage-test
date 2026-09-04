import type { Metadata } from "next";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { SiteFooter } from "../components/site-footer.js";

export const metadata: Metadata = {
  title: "免責條款 | JoJoPro 香港短租場地情報",
  description:
    "JoJoPro 僅聚合公開場地資訊，唔參與交易、唔保證資料真確，用戶需自行核實並慎防受騙。",
};

export const dynamic = "force-static";

export default function DisclaimerPage() {
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <a href="/" className="brand" aria-label="JoJoPro 首頁">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jojopro-logo.png" alt="JoJoPro" className="brand-logo" />
          </a>
          <a href="/" className="review-home">
            <ArrowLeft />
            返主頁
          </a>
        </div>
      </header>

      <main className="wrap wrap--narrow legal-page">
        <h1 className="legal-title">
          <ShieldAlert />
          免責條款
        </h1>
        <p className="legal-updated">最後更新：2026 年 9 月</p>

        <section className="legal-section">
          <p>
            JoJoPro（下稱「本平台」）係一個<strong>公開資訊聚合平台</strong>，
            目的係將市面公開流傳、散佈於不同渠道（包括但不限於社交媒體、群組、
            轉發訊息）有關香港短期租用舖位、booth、pop-up、展銷及市集場地嘅資訊，
            集中一處，方便有需要嘅用戶查閱同比較。請你喺使用本平台前，細閱以下條款。
            你一經使用本平台，即表示你已閱讀、明白並同意受本條款約束。
          </p>
        </section>

        <section className="legal-section">
          <h2>1. 資訊性質與來源</h2>
          <p>
            本平台刊載嘅所有場地資訊（包括但不限於場地名稱、地區、日期、檔期、租金、
            檔位數目、面積、設備、聯絡方法、相片等，下稱「場地資訊」），均<strong>收集自
            第三方公開渠道</strong>，由本平台以自動化方式或人手整理、轉載或重新發布。
            本平台<strong>唔係</strong>任何場地嘅業主、出租方、承辦方、代理商、經紀或交易方，
            亦唔代表任何場地負責人。
          </p>
        </section>

        <section className="legal-section">
          <h2>2. 唔參與交易、唔收取費用</h2>
          <p>
            本平台只提供資訊展示，<strong>唔參與、唔促成、亦唔代理</strong>任何租賃、
            預訂、付款或其他交易。用戶與任何場地負責人之間嘅一切洽談、約定、付款及
            租務安排，一概係雙方自行負責，同本平台無關。本平台唔會就任何交易向用戶或
            場地方收取佣金、介紹費或任何形式嘅費用；如有人士自稱本平台職員並要求付款，
            必屬假冒，請即拒絕並舉報。
          </p>
        </section>

        <section className="legal-section">
          <h2>3. 唔保證資料真確，用戶須自行核實</h2>
          <p>
            場地資訊可能存在錯誤、過時、遺漏、變更或未經證實嘅情況（例如檔期已滿、
            價錢調整、地點或聯絡方法有誤等）。本平台<strong>唔會就場地資訊嘅準確性、
            完整性、可靠性、時效性或適用性作出任何明示或默示嘅保證或陳述</strong>。
            用戶於作出任何決定或付款前，<strong>必須自行直接向場地負責人核實</strong>
            所有重要事項（包括檔期是否仍空置、實際租金及按金、場地是否合法用作有關用途、
            設施及圖片是否屬實等），切勿單憑本平台資訊行事。
          </p>
        </section>

        <section className="legal-section">
          <h2>4. 慎防受騙與個人資料保障</h2>
          <p>本平台提醒用戶時刻保持警惕，慎防詐騙。請注意以下事項：</p>
          <ul>
            <li>付款前務必親身或透過可靠渠道核實對方身份及場地真偽，切勿向陌生人預先轉賬大額款項。</li>
            <li>切勿輕信「超低價」「限時逼定」「代留位要先畀全款」等催促手段。</li>
            <li>避免在公開渠道或向未核實人士提供身份證、銀行戶口、信用卡、密碼、驗證碼等敏感資料。</li>
            <li>妥善保管個人財物同個人資料；如遇到懷疑詐騙，應立即停止聯絡並向警方或相關平台舉報。</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. 責任限制</h2>
          <p>
            在法律容許嘅最大範圍內，對於任何人因使用或依賴本平台刊載嘅場地資訊、
            或因與第三方進行交易而引致嘅任何直接或間接損失、損害、糾紛、人身或財產損失
            （包括金錢損失、誤工、商譽受損等），<strong>本平台及其營運者一概不承擔任何
            法律責任或賠償責任</strong>。用戶明白並同意自行承擔使用本平台嘅一切風險。
          </p>
        </section>

        <section className="legal-section">
          <h2>6. 第三方內容與連結</h2>
          <p>
            本平台可能包含或引用第三方提供嘅內容、圖片或連結。該等內容嘅知識產權歸
            原權利人所有；本平台對第三方網站或內容嘅準確性、合法性或可用性唔負責。
            如相關內容涉及權利問題，權利人可聯絡本平台跟進移除。
          </p>
        </section>

        <section className="legal-section">
          <h2>7. 條款修訂</h2>
          <p>
            本平台可不時修訂本免責條款，修訂後嘅條款於本頁公布後即時生效。
            用戶繼續使用本平台，即視為接受經修訂嘅條款。
          </p>
        </section>

        <p className="legal-back">
          <a href="/" className="btn btn--ghost">
            <ArrowLeft />
            返主頁瀏覽場地
          </a>
        </p>

        <SiteFooter />
      </main>
    </>
  );
}
