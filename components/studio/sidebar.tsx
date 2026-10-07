"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Frame,
  History,
  LayoutGrid,
  Menu,
  PencilRuler,
  Plus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { CAMPAIGN_COOKIE, CAMPAIGN_COOKIE_MAX_AGE } from "@/lib/campaign-cookie";
import { roleLabel } from "@/lib/permissions";
import type { Campaign } from "@/lib/types";
import type { StudioUser } from "@/auth";
import { Wordmark } from "./logo";
import { isNavActive, type NavIcon, type NavSection } from "./nav";

interface Props {
  user: StudioUser;
  sections: NavSection[];
  campaigns: Campaign[];
  campaignId: string | null;
  pendingCount: number;
  children: ReactNode;
}

const ICONS: Record<NavIcon, LucideIcon> = {
  tools: LayoutGrid,
  runs: History,
  archive: Archive,
  approvals: ClipboardCheck,
  calendar: CalendarDays,
  templates: Frame,
  "edit-tools": PencilRuler,
  team: Users,
};

/**
 * La cornice: barra laterale a sinistra, contenuto a destra. Sotto i 900px
 * la barra si ripiega in una riga in alto con un pulsante, e la colonna
 * scorre da sinistra quando la si apre.
 */
export function StudioFrame({ user, sections, campaigns, campaignId, pendingCount, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Cambiare pagina chiude il cassetto; Escape anche.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <div className="tv-shell bg-canvas">
      <header className="tv-topbar h-[56px] shrink-0 items-center justify-between gap-3 px-4" style={{ background: "var(--color-wine)" }}>
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri il menu"
          aria-expanded={open}
          className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-[12px]"
          style={{ color: "#ffffff", background: "rgba(255,255,255,.12)" }}
        >
          <Menu size={20} strokeWidth={1.9} />
        </button>
      </header>

      <div className="tv-sidebar-scrim" data-open={open} onClick={() => setOpen(false)} aria-hidden />

      <Sidebar
        user={user}
        sections={sections}
        campaigns={campaigns}
        campaignId={campaignId}
        pendingCount={pendingCount}
        open={open}
        onClose={() => setOpen(false)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function Sidebar({
  user,
  sections,
  campaigns,
  campaignId,
  pendingCount,
  open,
  onClose,
}: Omit<Props, "children"> & { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="tv-sidebar" data-open={open} aria-label="Navigazione dello Studio">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Wordmark />
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi il menu"
          className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-[12px] md:hidden"
          style={{ color: "#ffffff" }}
        >
          <X size={20} strokeWidth={1.9} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <Link
          href="/studio"
          className="tv-pill h-[44px] w-full justify-center gap-2 text-[14px] transition-[filter] hover:brightness-105"
          style={{ background: "var(--color-apricot)", color: "var(--color-ink)" }}
        >
          <Plus size={17} strokeWidth={2.2} />
          Nuova creazione
        </Link>
      </div>

      <nav className="tv-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pt-1 pb-4">
        {sections.map((section) => (
          <div key={section.title ?? "main"}>
            {section.title ? (
              <p className="px-3 pb-1.5 text-[10.5px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--color-on-wine-faint)" }}>
                {section.title}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const on = isNavActive(item.href, pathname);
                const Icon = ICONS[item.icon];
                const badge = item.badge === "approvals" && pendingCount > 0 ? pendingCount : null;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={on ? "page" : undefined}
                      className="flex h-[44px] items-center gap-3 rounded-[12px] px-3 text-[14px] transition-colors"
                      style={{
                        background: on ? "rgba(255,255,255,.14)" : "transparent",
                        color: on ? "#ffffff" : "var(--color-on-wine)",
                        fontWeight: on ? 600 : 500,
                      }}
                    >
                      <Icon size={17} strokeWidth={1.9} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge !== null ? (
                        <span
                          className="tv-pill h-[22px] min-w-[22px] justify-center px-1.5 text-[11.5px] tabular-nums"
                          style={{ background: "var(--color-apricot)", color: "var(--color-ink)" }}
                          aria-label={`${badge} in attesa`}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-3 px-4 pt-3 pb-5" style={{ borderTop: "1px solid rgba(255,255,255,.12)" }}>
        {campaigns.length > 0 ? <CampaignSwitcher campaigns={campaigns} campaignId={campaignId} /> : null}
        <div className="flex items-center gap-3 px-1">
          <span
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-[12px]"
            style={{ background: "var(--color-rose)", color: "#ffffff", fontWeight: 700 }}
            aria-hidden
          >
            {user.initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold" style={{ color: "#ffffff" }}>
              {user.name}
            </span>
            <span className="block truncate text-[12px]" style={{ color: "var(--color-on-wine)" }}>
              {roleLabel(user)}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}

/**
 * La campagna attiva. La scelta va in un cookie e la pagina si ricarica dal
 * server: cosi' la console, la home e il calendario leggono la stessa cosa.
 */
function CampaignSwitcher({ campaigns, campaignId }: { campaigns: Campaign[]; campaignId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const active = campaigns.find((c) => c.id === campaignId) ?? campaigns[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  const choose = (id: string) => {
    document.cookie = `${CAMPAIGN_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${CAMPAIGN_COOKIE_MAX_AGE}; samesite=lax`;
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={box} className="relative">
      <p className="px-1 pb-1.5 text-[10.5px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--color-on-wine-faint)" }}>
        Campagna attiva
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-3 text-left text-[13.5px] transition-colors"
        style={{ background: "rgba(255,255,255,.10)", color: "#ffffff" }}
      >
        <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: "var(--color-apricot)" }} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-semibold">{active?.name ?? "Nessuna campagna"}</span>
        <ChevronDown size={16} strokeWidth={1.9} className="shrink-0 opacity-80" />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Campagna"
          className="tv-anim-rise absolute right-0 bottom-[52px] left-0 z-50 overflow-hidden rounded-card bg-paper p-1.5"
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
                onClick={() => choose(c.id)}
                className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-line-soft"
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
