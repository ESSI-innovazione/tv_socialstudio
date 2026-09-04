"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Palette, RefreshCw } from "lucide-react";
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

export function TopBar({
  user,
  campaigns,
  campaignId,
  onCampaign,
  figmaSyncedAt,
  brandKit,
}: Props) {
  const active = campaigns.find((c) => c.id === campaignId) ?? campaigns[0] ?? null;

  return (
    <header
      className="flex h-[60px] shrink-0 items-center justify-between gap-6 px-5"
      style={{ background: "var(--color-wine)" }}
    >
      <div className="flex min-w-0 items-center gap-5">
        <Wordmark />
        <span className="h-6 w-px shrink-0" style={{ background: "rgba(255,255,255,.20)" }} />
        <CampaignPicker
          campaigns={campaigns}
          active={active}
          onPick={onCampaign}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className="tv-pill h-[32px] gap-2 px-3.5 text-[12px]"
          style={{ background: "rgba(255,255,255,.10)", color: "var(--color-on-wine)" }}
          title={figmaSyncedAt ? `Ultima sincronizzazione: ${figmaSyncedAt}` : undefined}
        >
          <RefreshCw size={14} strokeWidth={1.9} />
          {figmaSyncedAt ? `Figma · ${figmaSyncedAt}` : "Figma non sincronizzato"}
        </span>

        <span
          className="tv-pill h-[32px] gap-2 px-3.5 text-[12px]"
          style={{ background: "rgba(255,255,255,.10)", color: "var(--color-on-wine)" }}
        >
          <Palette size={14} strokeWidth={1.9} />
          {brandKit}
        </span>

        <span
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[12px] font-700"
          style={{
            background: "var(--color-rose)",
            color: "#ffffff",
            fontWeight: 700,
          }}
          title={`${user.name} · ${user.role === "approver" ? "approvatore" : "editor"}`}
        >
          {user.initials}
        </span>
      </div>
    </header>
  );
}

function CampaignPicker({
  campaigns,
  active,
  onPick,
}: {
  campaigns: Campaign[];
  active: Campaign | null;
  onPick: (id: string) => void;
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
        aria-haspopup="listbox"
        className="tv-pill h-[34px] max-w-[280px] gap-2 px-3.5 text-[13px] transition-colors"
        style={{ background: "rgba(255,255,255,.14)", color: "#ffffff" }}
      >
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: "var(--color-apricot)" }}
        />
        <span className="truncate">{active?.name ?? "Nessuna campagna"}</span>
        <ChevronDown size={15} strokeWidth={1.9} className="shrink-0 opacity-80" />
      </button>

      {open ? (
        <div
          role="listbox"
          className="tv-anim-rise absolute top-[44px] left-0 z-50 w-[268px] overflow-hidden rounded-card bg-paper p-1.5"
          style={{ border: "1px solid var(--color-line)", boxShadow: "var(--shadow-card)" }}
        >
          {campaigns.map((c) => {
            const on = c.id === active?.id;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onPick(c.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors"
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
      ) : null}
    </div>
  );
}
