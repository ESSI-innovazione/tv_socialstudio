import type { ReactNode } from "react";

interface Props {
  /** L'id del controllo, per `htmlFor`. */
  htmlFor: string;
  label: string;
  required?: boolean;
  /** Una riga sotto il controllo: l'esempio, la regola. */
  help?: ReactNode;
  /** Cosa manca o cosa non va. Ha la precedenza sull'aiuto. */
  error?: string | null;
  children: ReactNode;
  className?: string;
}

/** Etichetta, controllo, aiuto: la riga di ogni modulo. */
export function FieldRow({ htmlFor, label, required = false, help, error, children, className = "" }: Props) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="tv-label flex items-center gap-1.5">
        {label.toUpperCase()}
        {required ? (
          <span className="font-semibold normal-case tracking-normal" style={{ color: "var(--color-rose-ink)" }} aria-label="obbligatorio">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[12.5px] leading-[1.45]" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      ) : help ? (
        <p id={`${htmlFor}-help`} className="text-[12.5px] leading-[1.45]" style={{ color: "var(--color-ink-faint)" }}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** Lo stile condiviso dei campi di testo, per chi non usa un componente. */
export const inputClass = "w-full rounded-[10px] px-3.5 text-[14px] outline-none transition-[border-color,box-shadow] focus:shadow-focus";
export const inputStyle = {
  border: "1px solid var(--color-line)",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
  minHeight: 44,
} as const;
