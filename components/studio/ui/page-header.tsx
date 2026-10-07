import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: Crumb[];
  /** Un'etichetta accanto al titolo: lo stato, di solito. */
  aside?: ReactNode;
  actions?: ReactNode;
}

/**
 * La testata di ogni pagina: briciole, titolo, una riga sotto, le azioni a
 * destra. E' una sola cosi' le pagine si somigliano senza copiarsi.
 */
export function PageHeader({ title, subtitle, breadcrumb, aside, actions }: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Percorso" className="flex flex-wrap items-center gap-1 pb-1.5 text-[12.5px] font-semibold">
            {breadcrumb.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight size={13} strokeWidth={2.2} style={{ color: "var(--color-ink-faint)" }} aria-hidden /> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="transition-colors hover:text-wine" style={{ color: "var(--color-rose-ink)" }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span style={{ color: "var(--color-ink-faint)" }}>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
            {title}
          </h1>
          {aside}
        </div>
        {subtitle ? (
          <p className="mt-1 text-[13.5px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
