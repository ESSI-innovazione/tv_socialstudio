/** Formattazioni di UI, tutte in italiano. */

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "giorno" : "giorni"} fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function durationLabel(ms: number | null | undefined): string {
  if (!ms || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s - m * 60)} s`;
}

export function clock(at: number): string {
  return new Date(at).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** "10 novembre 2026, ore 12:00" da una data ISO. */
export function deadlineLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ore ${time}`;
}

/** Giorni pieni che mancano a una scadenza. Negativo se e' passata. */
export function daysUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now) / 86_400_000);
}
