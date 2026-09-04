// 全站共享頁尾：簡明免責聲明＋完整條款連結。
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__summary">
        JoJoPro 只係一個公開資訊聚合平台，收集市面公開流傳嘅短租場地情報，
        方便用戶集中查閱。本平台<strong>唔係場地業主、代理或交易方</strong>，
        唔參與任何租務交易、唔收取佣金、亦<strong>唔保證資料嘅真確、完整或時效</strong>。
        一切場地資訊（日期、價錢、檔位、聯絡方法等）請用戶自行向場地負責人核實；
        請慎防受騙，妥善保護個人資料同財產。
      </p>
      <p className="site-footer__links">
        <a href="/disclaimer">完整免責條款</a>
        <span aria-hidden="true">·</span>
        <span>© {new Date().getFullYear()} JoJoPro</span>
      </p>
    </footer>
  );
}
