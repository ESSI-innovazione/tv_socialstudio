"use client";

import { useRef, type KeyboardEvent } from "react";

export interface TabItem<K extends string> {
  key: K;
  label: string;
  /** Un numero accanto all'etichetta. */
  count?: number;
}

interface Props<K extends string> {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  "aria-label": string;
  /** `pill` e' il segmento su fondo linea; `line` e' la riga sotto, per le schede. */
  variant?: "pill" | "line";
  size?: "sm" | "md";
}

/**
 * Le schede: un `tablist` vero, con le frecce per spostarsi e Home/End per
 * andare in fondo. Il pannello che controllano e' di chi le usa.
 */
export function SegmentedTabs<K extends string>({ items, value, onChange, variant = "pill", size = "md", ...rest }: Props<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % items.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].key);
    refs.current[next]?.focus();
  };

  const h = size === "sm" ? "h-[34px]" : "h-[40px]";

  if (variant === "line") {
    return (
      <div role="tablist" aria-label={rest["aria-label"]} className="flex gap-1 overflow-x-auto" style={{ borderBottom: "1px solid var(--color-line)" }}>
        {items.map((item, i) => {
          const on = item.key === value;
          return (
            <button
              key={item.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(item.key)}
              onKeyDown={(e) => onKey(e, i)}
              className={`-mb-px flex ${h} shrink-0 cursor-pointer items-center gap-2 px-3.5 text-[13.5px] whitespace-nowrap transition-colors`}
              style={{ color: on ? "var(--color-wine)" : "var(--color-ink-soft)", fontWeight: on ? 600 : 500, borderBottom: `2px solid ${on ? "var(--color-wine)" : "transparent"}` }}
            >
              {item.label}
              {item.count !== undefined ? <Count on={on} value={item.count} /> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label={rest["aria-label"]} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full p-0.5" style={{ background: "var(--color-line-soft)" }}>
      {items.map((item, i) => {
        const on = item.key === value;
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={`tv-pill ${size === "sm" ? "h-[30px] px-3 text-[12.5px]" : "h-[36px] px-4 text-[13px]"} shrink-0 cursor-pointer gap-2 transition-colors`}
            style={{ background: on ? "var(--color-paper)" : "transparent", color: on ? "var(--color-wine)" : "var(--color-ink-soft)", boxShadow: on ? "var(--shadow-card-soft)" : "none" }}
          >
            {item.label}
            {item.count !== undefined ? <Count on={on} value={item.count} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function Count({ on, value }: { on: boolean; value: number }) {
  return (
    <span className="tv-pill h-[18px] px-1.5 text-[10.5px] tabular-nums" style={{ background: on ? "var(--color-wine-tint)" : "var(--color-paper)", color: on ? "var(--color-wine)" : "var(--color-ink-faint)" }}>
      {value}
    </span>
  );
}
