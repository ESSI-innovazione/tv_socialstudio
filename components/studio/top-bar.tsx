"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Frame, Palette } from "lucide-react";
import type { Campaign } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { Wordmark } from "./logo";

interface Props {
  user: StudioUser;
  campaigns: Campaign[];
  campaignId: string | null;
  onCampaign: (id: string) => void;
  figmaSyncedAt: string | null;
  brandKit: string;
}

/**
 * La barra: marchio, campagna, persona. Lo stato di Figma e del Brand Kit
 * non e' qualcosa su cui il team agisce, quindi sta nel menu della persona.
 */
export function TopBar({ user, campaigns, campaignId, onCampaign, figmaSyncedAt, brandKit }: Props) {
  const active = campaigns.find((c) => c.id === campaignId) ?? campaigns[0] ?? null;

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between gap-6 px-5" style={{ background: "var(--color-wine)" }}>
      <div className="flex min-w-0 items-center gap-5">
        <Wordmark />
        <span className="h-6 w-px shrink-0" style={{ background: "rgba(255,255,255,.20)" }} />
        <Dropdown
          label={
            <>
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "var(--color-apricot)" }} />
              <span className="truncate">{active?.name ?? "Nessuna campagna"}</span>
              <ChevronDown size={15} strokeWidth={1.9} className="shrink-0 opacity-80" />
            </>
          }
          ariaLabel="Campagna"
          width={268}
        >
          {(close) => (
            <div role="listbox" className="p-1.5">
              {campaigns.map((c) => {
                const on = c.id === active?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      onCampaign(c.id);
                      close();
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13.5px] transition-colors hover:bg-line-soft"
                    style={{
                      background: on ? "var(--color-wine-tint)" : "transparent",
                      color: on ? "var(--color-wine)" : "var(--color-ink)",
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    <span className="truncate">{c.name}</span>
                    {on ? <Check size={15} strokeWidth={2.2} className="shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </Dropdown>
      </div>

      <Dropdown
        label={
          <span
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[12px]"
            style={{ background: "var(--color-rose)", color: "#ffffff", fontWeight: 700 }}
          >
            {user.initials}
          </span>
        }
        ariaLabel="Account e stato"
        width={280}
        align="right"
        bare
      >
        {() => (
          <div className="p-2">
            <div className="px-3 py-2.5">
              <p className="text-[13.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
                {user.name}
              </p>
              <p className="text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                {user.email} · {user.role === "approver" ? "approvatore" : "editor"}
              </p>
            </div>
            <div className="mx-3 my-1 h-px" style={{ background: "var(--color-line)" }} />
            <StatusRow icon={<Frame size={15} strokeWidth={1.9} />} label="Libreria Figma" value={figmaSyncedAt ?? "mai sincronizzata"} />
            <StatusRow icon={<Palette size={15} strokeWidth={1.9} />} label="Brand Kit" value={brandKit} />
          </div>
        )}
      </Dropdown>
    </header>
  );
}

function StatusRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 text-[13px]">
      <span style={{ color: "var(--color-wine)" }}>{icon}</span>
      <span style={{ color: "var(--color-ink-soft)" }}>{label}</span>
      <span className="ml-auto truncate" style={{ color: "var(--color-ink-faint)" }}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Dropdown({
  label,
  ariaLabel,
  width,
  align = "left",
  bare = false,
  children,
}: {
  label: ReactNode;
  ariaLabel: string;
  width: number;
  align?: "left" | "right";
  /** Senza la pillola attorno: per l'avatar. */
  bare?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={ariaLabel}
        className={bare ? "flex cursor-pointer rounded-full" : "tv-pill h-[34px] max-w-[280px] cursor-pointer gap-2 px-3.5 text-[13px] transition-colors"}
        style={bare ? undefined : { background: "rgba(255,255,255,.14)", color: "#ffffff" }}
      >
        {label}
      </button>

      {open ? (
        <div
          className="tv-anim-rise absolute top-[44px] z-50 overflow-hidden rounded-card bg-paper"
          style={{ width, [align]: 0, border: "1px solid var(--color-line)", boxShadow: "var(--shadow-card)" }}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
