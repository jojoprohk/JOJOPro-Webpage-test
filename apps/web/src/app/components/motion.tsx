"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Scroll-reveal wrapper. Content is visible by default (no-JS / reduced-motion
// safe); GSAP only hides then animates it in when motion is allowed.
export function Reveal({
  children,
  className,
  y = 22,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(el, { opacity: 0, y });
        const tween = gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.55,
          delay,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// Batched stagger reveal for a grid of cards rendered by a server component.
// Wrap the grid; each direct child matching `childSelector` reveals in a batch.
export function RevealGrid({
  children,
  className,
  childSelector = ":scope > *",
}: {
  children: ReactNode;
  className?: string;
  childSelector?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items = gsap.utils.toArray<HTMLElement>(childSelector, root);
        if (items.length === 0) return;
        gsap.set(items, { opacity: 0, y: 26 });
        const triggers = ScrollTrigger.batch(items, {
          start: "top 94%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.55,
              ease: "power3.out",
              stagger: 0.07,
              overwrite: true,
            }),
        });
        return () => {
          triggers.forEach((t) => t.kill());
        };
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// Intro animation for the public hero. Targets [data-motion] children.
export function HeroIntro({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-motion]", root);
        gsap.set(items, { opacity: 0, y: 18 });
        gsap.to(items, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.12,
          delay: 0.1,
        });
      });
    },
    { scope: ref },
  );

  return <div ref={ref}>{children}</div>;
}
