"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UserPlus } from "lucide-react";
import { ROLE_LABEL } from "@/lib/permissions";
import type { Profile, Role } from "@/lib/types";

interface Props {
  profiles: Profile[];
  me: string;
}

/**
 * Il team: una riga per persona con il ruolo modificabile sul posto, e il
 * modulo per aggiungere un collega. Il server rifiuta indirizzi fuori dal
 * dominio e la retrocessione dell'ultimo approvatore.
 */
export function ProfilesAdmin({ profiles, me }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = async () => {
    setBusy("add");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${email.trim()}@timevision.it`, name, role }),
      });
      const data = (await res.json().catch(() => ({}))) as { profile?: Profile; error?: string };
      if (!res.ok || !data.profile) throw new Error(data.error ?? "Non sono riuscito ad aggiungere il collega.");
      setNotice(`${data.profile.email} puo' entrare con Google da subito, come ${ROLE_LABEL[data.profile.role].toLowerCase()}.`);
      setEmail("");
      setName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (profile: Profile, next: Role) => {
    setBusy(profile.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Cambio di ruolo non riuscito.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="tv-card flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-ink)" }}>
          Team e ruoli
        </h2>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--color-ink-soft)" }}>
          Gli editor creano e chiedono approvazione; gli approvatori approvano, pubblicano e amministrano.
        </p>
      </div>

      <ul className="flex flex-col divide-y" style={{ borderColor: "var(--color-line)" }}>
        {profiles.map((p) => (
          <li key={p.id} className="flex items-center gap-4 py-2.5">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
              style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}
            >
              {(p.name ?? p.email).slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
                {p.name ?? p.email.split("@")[0]}
                {p.email === me ? <span className="ml-2 text-[11.5px] font-normal" style={{ color: "var(--color-ink-faint)" }}>sei tu</span> : null}
              </span>
              <span className="block truncate text-[12px]" style={{ color: "var(--color-ink-faint)" }}>
                {p.email}
              </span>
            </span>
            <select
              value={p.role}
              disabled={busy === p.id}
              onChange={(e) => changeRole(p, e.target.value as Role)}
              aria-label={`Ruolo di ${p.email}`}
              className="h-[36px] cursor-pointer rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus"
              style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" }}
            >
              <option value="editor">Editor</option>
              <option value="approver">Approvatore</option>
            </select>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-2.5 rounded-[12px] p-3.5" style={{ background: "var(--color-line-soft)" }}>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="tv-label">NOME</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e cognome" className={field} style={fieldStyle} />
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="tv-label">EMAIL</span>
          <span className="flex items-center overflow-hidden rounded-[10px]" style={fieldStyle}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value.replace(/@.*$/, ""))}
              onKeyDown={(e) => e.key === "Enter" && email && add()}
              placeholder="nome.cognome"
              aria-label="Parte locale dell'indirizzo"
              className="h-[38px] min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none"
              style={{ color: "var(--color-ink)" }}
            />
            <span className="h-[38px] shrink-0 px-3 text-[13px] leading-[38px]" style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)", fontWeight: 600 }}>
              @timevision.it
            </span>
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="tv-label">RUOLO</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={field + " cursor-pointer"} style={fieldStyle}>
            <option value="editor">Editor</option>
            <option value="approver">Approvatore</option>
          </select>
        </label>
        <button
          type="button"
          onClick={add}
          disabled={!email.trim() || busy === "add"}
          className="tv-pill h-[38px] gap-2 px-4 text-[13px]"
          style={{ background: email.trim() ? "var(--color-wine)" : "var(--color-mute)", color: "#ffffff", cursor: email.trim() ? "pointer" : "not-allowed" }}
        >
          {busy === "add" ? <LoaderCircle size={14} strokeWidth={2.2} className="tv-anim-spin" /> : <UserPlus size={14} strokeWidth={2.2} />}
          Aggiungi collega
        </button>
      </div>

      {error ? (
        <p className="text-[12.5px]" style={{ color: "var(--color-warning)" }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-[12.5px]" style={{ color: "var(--color-success)" }}>
          {notice}
        </p>
      ) : null}
    </section>
  );
}

const field = "h-[38px] rounded-[10px] px-3 text-[13px] outline-none focus:shadow-focus";
const fieldStyle = { border: "1px solid var(--color-line)", background: "var(--color-paper)", color: "var(--color-ink)" } as const;
