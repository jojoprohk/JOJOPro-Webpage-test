"use client";

// Elastic accordion gallery for featured venues with a detail modal.
// Pure-CSS port of the 21st.dev "elastic gallery" pattern (no Tailwind/shadcn):
// a flex row where the active panel takes flex-grow ~4 and the rest ~1.
// Hover expands on desktop; click expands on touch. Clicking the expanded
// panel (or the "睇詳情" button) opens a modal with full venue details.

import { ArrowUpRight, X, MapPin, CalendarDays, Ruler } from "lucide-react";
import { useEffect, useState } from "react";
import type { FeaturedItem } from "./featured-items.js";

export function FeaturedGallery({ items }: { items: FeaturedItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(
    items[2]?.id ?? items[0]?.id ?? null,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = items.find((i) => i.id === openId) ?? null;

  // Lock body scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!openItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openItem]);

  if (items.length === 0) return null;

  const handlePanelClick = (id: string) => {
    if (id === activeId) {
      setOpenId(id); // already expanded -> open detail
    } else {
      setActiveId(id); // first tap/click expands
    }
  };

  return (
    <>
      <div className="elastic">
        <div className="elastic__track">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <div
                key={item.id}
                className={`elastic__panel${active ? " is-active" : ""}`}
                onMouseEnter={() => setActiveId(item.id)}
                onClick={() => handlePanelClick(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePanelClick(item.id);
                  }
                }}
                aria-expanded={active}
                aria-label={`${item.title}，按 Enter 睇詳情`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="elastic__img" src={item.photo} alt={item.title} loading="lazy" />
                <div className="elastic__scrim" />

                <div className="elastic__active">
                  <span className="elastic__tag">{item.category}</span>
                  <h3 className="elastic__title">{item.title}</h3>
                  <p className="elastic__place">{item.place}</p>
                  {item.price ? <span className="elastic__price">{item.price}</span> : null}
                  <button
                    type="button"
                    className="elastic__cta"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(item.id);
                    }}
                  >
                    睇詳情
                    <ArrowUpRight />
                  </button>
                </div>

                <div className="elastic__idle">
                  <span className="elastic__vtitle">{item.title}</span>
                  <span className="elastic__num">{item.category}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {openItem ? (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={openItem.title}
          onClick={() => setOpenId(null)}
        >
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal__close"
              onClick={() => setOpenId(null)}
              aria-label="關閉"
            >
              <X />
            </button>

            <div className="modal__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={openItem.photo} alt={openItem.title} />
              {openItem.price ? <span className="modal__price">{openItem.price}</span> : null}
            </div>

            <div className="modal__body">
              <span className="elastic__tag">{openItem.category}</span>
              <h3 className="modal__title">{openItem.title}</h3>

              <div className="modal__meta">
                <span><MapPin />{openItem.place}</span>
                <span><CalendarDays />{openItem.dates}</span>
                {openItem.size ? <span><Ruler />{openItem.size}</span> : null}
              </div>

              {openItem.badges.length > 0 ? (
                <div className="modal__badges">
                  {openItem.badges.map((b) => (
                    <span key={b.label} className={`badge${b.hot ? " badge--hot" : ""}`}>
                      {b.label}
                    </span>
                  ))}
                </div>
              ) : null}

              {openItem.summary ? <p className="modal__summary">{openItem.summary}</p> : null}

              <div className="modal__foot">
                {openItem.whatsapp ? (
                  <a className="btn btn--whatsapp" href={openItem.whatsapp} target="_blank" rel="noopener noreferrer">
                    WhatsApp 聯絡
                  </a>
                ) : openItem.contactText ? (
                  <span className="contact-text">聯絡：{openItem.contactText}</span>
                ) : (
                  <span className="contact-none">聯絡方法待確認</span>
                )}
                {openItem.href ? (
                  <a className="modal__source" href={openItem.href} target="_blank" rel="noopener noreferrer">
                    原始貼文（{openItem.sourceLabel}）
                    <ArrowUpRight />
                  </a>
                ) : null}
              </div>

              <p className="modal__note">
                來源：{openItem.sourceLabel} · 更新：{openItem.updated}。
                檔期同條款請向場地負責人確認，JoJoPro 唔參與租務交易。
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
