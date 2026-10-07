import type { ReactNode } from "react";
import type { StudioUser } from "@/auth";
import { studioNav } from "./nav";
import { TopBar } from "./top-bar";

interface Props {
  user: StudioUser;
  title: string;
  description?: string;
  /** Un'azione in testata, a destra del titolo. */
  action?: ReactNode;
  children: ReactNode;
  /** Larghezza massima del contenuto. */
  width?: number;
}

/**
 * La cornice delle pagine intorno alla console: la stessa barra vino, la
 * stessa navigazione, un titolo e il contenuto che scorre.
 */
export function PageFrame({ user, title, description, action, children, width = 1100 }: Props) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <TopBar user={user} nav={studioNav(user.role)} brandKit="Brand Kit 2026" />
      <main className="tv-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full flex-col gap-5 px-8 py-7" style={{ maxWidth: width }}>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-[-0.01em]" style={{ color: "var(--color-ink)" }}>
                {title}
              </h1>
              {description ? (
                <p className="mt-1 text-[13.5px]" style={{ color: "var(--color-ink-soft)" }}>
                  {description}
                </p>
              ) : null}
            </div>
            {action}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
