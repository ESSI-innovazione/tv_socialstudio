"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Mail, Send, UserPlus, UserX, Undo2, X } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { ACTIONS, ROLE_HINT, ROLE_LABEL, ROLES, can } from "@/lib/permissions";
import type { Profile, ProfileEvent, Role } from "@/lib/types";
import { Card, EmptyState, FieldRow, Toggle, inputClass, inputStyle } from "./ui";

interface Props {
  profiles: Profile[];
  events: ProfileEvent[];
  me: string;
  /** Vero se Resend e' configurato: altrimenti l'invito si consegna a voce. */
  mailConfigured: boolean;
}

const DOMAIN = "timevision.it";

/** Il puntino di presenza: verde se vista da poco, altrimenti grigio. */
function presence(profile: Profile): { color: string; label: string } {
  if (profile.active === false) return { color: "var(--color-mute)", label: "Accesso tolto" };
  if (!profile.last_seen_at) return { color: "var(--color-warm-edge)", label: "Invito in attesa" };
  const minutes = (Date.now() - new Date(profile.last_seen_at).getTime()) / 60_000;
  if (minutes < 70) return { color: "var(--color-success)", label: "Online di recente" };
  return { color: "var(--color-ink-faint)", label: `Ultimo accesso ${timeAgo(profile.last_seen_at)}` };
}

/**
 * Il team: una riga per persona con il ruolo modificabile sul posto, il
 * modulo per invitare un collega, e la tabella di cosa puo' fare ogni
 * ruolo, disegnata dalla stessa matrice che il server applica.
 */
export function TeamAdmin({ profiles, events, me, mailConfigured }: Props) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (id: string, path: string, body: Record<string, unknown> | null, method = "PATCH") => {
    setBusy(id);
    setNotice(null);
    try {
      const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = (await res.json().catch(() => ({}))) as { error?: string; mailed?: boolean; url?: string };
      if (!res.ok) throw new Error(data.error ?? "Modifica non riuscita.");
      if (method === "POST") {
        setNotice({ ok: true, text: data.mailed ? "Invito rimandato via email." : `Invito pronto: digli di entrare con Google su ${data.url ?? window.location.origin}.` });
      }
      router.refresh();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const active = profiles.filter((p) => p.active !== false);
  const removed = profiles.filter((p) => p.active === false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px]" style={{ color: "var(--color-ink-soft)" }}>
          I ruoli valgono subito. Ogni cambio resta registrato con chi l&apos;ha fatto.
        </p>
        <button
          type="button"
          onClick={() => setInviting((v) => !v)}
          aria-expanded={inviting}
          className="tv-pill h-[44px] gap-2 px-5 text-[13.5px]"
          style={{ background: "var(--color-coral)", color: "var(--color-ink)", boxShadow: "var(--shadow-coral)", cursor: "pointer" }}
        >
          <UserPlus size={16} strokeWidth={2} />
          Invita un collega
        </button>
      </div>

      {inviting ? (
        <InvitePanel
          mailConfigured={mailConfigured}
          onClose={() => setInviting(false)}
          onDone={(text) => {
            setInviting(false);
            setNotice({ ok: true, text });
            router.refresh();
          }}
        />
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-[10px] px-3.5 py-2.5 text-[13px] leading-[1.5]"
          style={{ background: notice.ok ? "var(--color-success-bg)" : "var(--color-danger-bg)", color: notice.ok ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {notice.text}
        </p>
      ) : null}

      {/* ---------------- persone ---------------- */}
      <Card flush as="section" aria-labelledby="team-people">
        <h2 id="team-people" className="px-5 pt-5 pb-3 text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
          Persone
        </h2>
        <div className="tv-scroll overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13.5px]">
            <thead>
              <tr className="tv-label" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <th scope="col" className="px-5 py-2 font-bold">PERSONA</th>
                <th scope="col" className="px-3 py-2 font-bold">RUOLO</th>
                <th scope="col" className="px-3 py-2 font-bold">ADMIN</th>
                <th scope="col" className="px-3 py-2 font-bold">ULTIMO ACCESSO</th>
                <th scope="col" className="px-5 py-2 text-right font-bold">AZIONI</th>
              </tr>
            </thead>
            <tbody>
              {[...active, ...removed].map((p) => {
                const self = p.email === me;
                const dot = presence(p);
                const pending = !p.last_seen_at && p.active !== false;
                const off = p.active === false;
                const working = busy === p.id;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--color-line-soft)", opacity: off ? 0.6 : 1 }}>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3">
                        <span
                          className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                          style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
                          aria-hidden
                        >
                          {(p.name ?? p.email).slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold" style={{ color: "var(--color-ink)" }}>
                            {p.name ?? p.email.split("@")[0]}
                            {self ? (
                              <span className="ml-2 text-[11.5px] font-normal" style={{ color: "var(--color-ink-faint)" }}>
                                Sei tu
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                            {p.email}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={p.role}
                        disabled={self || off || working}
                        onChange={(e) => call(p.id, `/api/admin/profiles/${p.id}`, { role: e.target.value as Role })}
                        aria-label={`Ruolo di ${p.email}`}
                        className="h-[40px] rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus"
                        style={{ ...inputStyle, minHeight: 40, cursor: self || off ? "not-allowed" : "pointer" }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <Toggle
                        checked={p.is_admin}
                        disabled={self || off || working}
                        onChange={(next) => call(p.id, `/api/admin/profiles/${p.id}`, { is_admin: next })}
                        aria-label={`${p.email} e' admin`}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2" style={{ color: "var(--color-ink-soft)" }}>
                        <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: dot.color }} aria-hidden />
                        <span suppressHydrationWarning>{dot.label}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {working ? (
                        <LoaderCircle size={16} strokeWidth={2.2} className="tv-anim-spin inline" style={{ color: "var(--color-ink-faint)" }} />
                      ) : off ? (
                        <RowAction icon={Undo2} onClick={() => call(p.id, `/api/admin/profiles/${p.id}`, { active: true })}>
                          Ridai accesso
                        </RowAction>
                      ) : pending ? (
                        <RowAction icon={Send} onClick={() => call(p.id, `/api/admin/profiles/${p.id}/invite`, null, "POST")}>
                          Reinvia
                        </RowAction>
                      ) : self ? null : (
                        <RowAction icon={UserX} danger onClick={() => call(p.id, `/api/admin/profiles/${p.id}`, { active: false })}>
                          Togli accesso
                        </RowAction>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------------- matrice ---------------- */}
      <Card flush as="section" aria-labelledby="team-matrix">
        <div className="px-5 pt-5 pb-3">
          <h2 id="team-matrix" className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
            Cosa puo&apos; fare ogni ruolo
          </h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
            La stessa tabella che il server applica a ogni richiesta. L&apos;admin e&apos; una spunta in piu&apos;, non un ruolo.
          </p>
        </div>
        <div className="tv-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="tv-label" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <th scope="col" className="px-5 py-2 font-bold">AZIONE</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className="px-3 py-2 text-center font-bold">
                    {ROLE_LABEL[r].toUpperCase()}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-center font-bold">ADMIN</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((action) => (
                <tr key={action.key} style={{ borderBottom: "1px solid var(--color-line-soft)" }}>
                  <td className="px-5 py-2.5" style={{ color: "var(--color-ink)" }}>
                    {action.label}
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      <Allowed yes={can({ role: r, isAdmin: false }, action.key)} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center">
                    <Allowed yes={can({ role: "editor", isAdmin: true }, action.key)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------------- storico ---------------- */}
      {events.length > 0 ? (
        <Card as="section" aria-labelledby="team-events">
          <h2 id="team-events" className="pb-3 text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
            Ultime modifiche
          </h2>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2" style={{ color: "var(--color-ink-soft)" }}>
                <span className="shrink-0 tabular-nums" style={{ color: "var(--color-ink-faint)" }} suppressHydrationWarning>
                  {timeAgo(e.at)}
                </span>
                <span>
                  <span style={{ color: "var(--color-ink)" }}>{e.changed_by}</span> {describe(e)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {profiles.length === 0 ? <EmptyState title="Nessuno nel team" text="Invita il primo collega: potra' entrare con Google da subito." /> : null}
    </div>
  );
}

function describe(e: ProfileEvent): string {
  const who = e.email;
  switch (e.field) {
    case "invited":
      return `ha invitato ${who} come ${e.to_value?.replace("+admin", " e admin") ?? "editor"}`;
    case "role":
      return `ha cambiato il ruolo di ${who}: da ${ROLE_LABEL[(e.from_value as Role) ?? "editor"] ?? e.from_value} a ${ROLE_LABEL[(e.to_value as Role) ?? "editor"] ?? e.to_value}`;
    case "is_admin":
      return e.to_value === "true" ? `ha reso admin ${who}` : `ha tolto la spunta admin a ${who}`;
    case "active":
      return e.to_value === "true" ? `ha ridato l'accesso a ${who}` : `ha tolto l'accesso a ${who}`;
  }
}

function Allowed({ yes }: { yes: boolean }) {
  return yes ? (
    <Check size={16} strokeWidth={2.6} className="inline" style={{ color: "var(--color-success)" }} aria-label="si'" />
  ) : (
    <span style={{ color: "var(--color-ink-faint)" }} aria-label="no">
      —
    </span>
  );
}

function RowAction({ icon: Icon, danger = false, onClick, children }: { icon: typeof Send; danger?: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tv-pill h-[40px] cursor-pointer gap-1.5 px-3.5 text-[12.5px] transition-colors hover:bg-line-soft"
      style={{ border: "1px solid var(--color-line)", color: danger ? "var(--color-danger)" : "var(--color-wine)", background: "var(--color-paper)" }}
    >
      <Icon size={14} strokeWidth={2} />
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Invito                                                               */
/* ------------------------------------------------------------------ */

function InvitePanel({ mailConfigured, onClose, onDone }: { mailConfigured: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const id = useId();
  const [name, setName] = useState("");
  const [local, setLocal] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localOk = /^[a-z0-9._%+-]+$/i.test(local.trim());

  const submit = async () => {
    if (!localOk) {
      setError("Scrivi solo la parte prima della chiocciola, senza spazi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${local.trim().toLowerCase()}@${DOMAIN}`, name, role, isAdmin: admin }),
      });
      const data = (await res.json().catch(() => ({}))) as { profile?: Profile; mailed?: boolean; url?: string; error?: string };
      if (!res.ok || !data.profile) throw new Error(data.error ?? "Non sono riuscito a creare l'invito.");
      onDone(
        data.mailed
          ? `Invito inviato a ${data.profile.email}: puo' entrare con Google da subito come ${ROLE_LABEL[data.profile.role].toLowerCase()}.`
          : `Invito creato: digli di entrare con Google su ${data.url ?? window.location.origin}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" size="lg" aria-labelledby={`${id}-title`} className="tv-anim-rise">
      <div className="flex items-start justify-between gap-3 pb-4">
        <div>
          <h2 id={`${id}-title`} className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
            Invita un collega
          </h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
            {mailConfigured ? "Riceve un'email e puo' entrare con Google da subito." : "La posta non e' configurata: l'invito si consegna a voce, l'accesso funziona lo stesso."}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-[12px] hover:bg-line-soft" style={{ color: "var(--color-ink-soft)" }}>
          <X size={18} strokeWidth={1.9} />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldRow htmlFor={`${id}-name`} label="Nome">
          <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e cognome" className={inputClass} style={inputStyle} autoComplete="off" />
        </FieldRow>
        <FieldRow htmlFor={`${id}-email`} label="Email" required help={`Solo la parte prima di @${DOMAIN}.`} error={local && !localOk ? "Niente spazi o chiocciole: solo la parte locale." : null}>
          <span className="flex items-stretch overflow-hidden rounded-[10px] focus-within:shadow-focus" style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)" }}>
            <input
              id={`${id}-email`}
              value={local}
              onChange={(e) => setLocal(e.target.value.replace(/@.*$/, ""))}
              onKeyDown={(e) => e.key === "Enter" && local && submit()}
              placeholder="nome.cognome"
              aria-describedby={`${id}-email-help`}
              className="min-w-0 flex-1 bg-transparent px-3.5 text-[14px] outline-none"
              style={{ color: "var(--color-ink)", minHeight: 44 }}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="flex shrink-0 items-center px-3 text-[13px] font-semibold" style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}>
              @{DOMAIN}
            </span>
          </span>
        </FieldRow>
      </div>

      <fieldset className="mt-4">
        <legend className="tv-label pb-2">RUOLO</legend>
        <div className="grid gap-2.5 md:grid-cols-3">
          {ROLES.map((r) => {
            const on = role === r;
            return (
              <label
                key={r}
                className="flex cursor-pointer items-start gap-3 rounded-card p-3.5 transition-[border-color,background-color]"
                style={{ border: `1.5px solid ${on ? "var(--color-rose)" : "var(--color-line)"}`, background: on ? "var(--color-wine-tint)" : "var(--color-paper)" }}
              >
                <input type="radio" name={`${id}-role`} value={r} checked={on} onChange={() => setRole(r)} className="mt-1 h-4 w-4 accent-[#ce4257]" />
                <span>
                  <span className="block text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    {ROLE_LABEL[r]}
                  </span>
                  <span className="block text-[12.5px] leading-[1.45]" style={{ color: "var(--color-ink-soft)" }}>
                    {ROLE_HINT[r]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13.5px]" style={{ color: "var(--color-ink)" }}>
        <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="h-4 w-4 accent-[#ce4257]" />
        Anche admin
        <span className="text-[12.5px]" style={{ color: "var(--color-ink-faint)" }}>
          puo&apos; invitare, cambiare ruoli e togliere accessi
        </span>
      </label>

      {error ? (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className="tv-pill h-[44px] cursor-pointer px-5 text-[13.5px] transition-colors hover:bg-line-soft" style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}>
          Annulla
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!local.trim() || busy}
          className="tv-pill h-[44px] gap-2 px-5 text-[13.5px]"
          style={{ background: local.trim() ? "var(--color-wine)" : "var(--color-mute)", color: local.trim() ? "#ffffff" : "var(--color-ink-soft)", cursor: local.trim() ? "pointer" : "not-allowed" }}
        >
          {busy ? <LoaderCircle size={15} strokeWidth={2.2} className="tv-anim-spin" /> : <Mail size={15} strokeWidth={2} />}
          Invia invito
        </button>
      </div>
    </Card>
  );
}
