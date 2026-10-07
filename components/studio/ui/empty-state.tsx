import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
  /** Il contorno tratteggiato, per le zone che aspettano qualcosa. */
  dashed?: boolean;
  className?: string;
}

/** Quando non c'e' niente: dice cosa comparira' qui e come farlo comparire. */
export function EmptyState({ icon: Icon, title, text, action, dashed = false, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2.5 rounded-card px-5 py-8 text-center ${className}`}
      style={{
        background: dashed ? "transparent" : "var(--color-paper)",
        border: dashed ? "1.5px dashed var(--color-line)" : "1px solid var(--color-line)",
      }}
    >
      {Icon ? (
        <span className="flex h-[40px] w-[40px] items-center justify-center rounded-[12px]" style={{ background: "var(--color-wine-tint)", color: "var(--color-wine)" }}>
          <Icon size={19} strokeWidth={1.9} />
        </span>
      ) : null}
      <p className="text-[14.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
        {title}
      </p>
      {text ? (
        <p className="max-w-[420px] text-[13px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
          {text}
        </p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
