"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eye,
  EyeOff,
  Lock,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { FORMATS, type FormatId } from "@/lib/brand";
import {
  BLOCK_LABELS,
  archetypeLabel,
  clampBlock,
  defaultLayout,
  fontSizeOf,
  ladderFor,
  minStepOf,
  safeInset,
  snap,
  updateBlock,
  type ArchetypeId,
  type AssetLayout,
  type Block,
} from "@/lib/layout-model";
import type { VariantCopy } from "@/lib/types";
import { AssetCanvas } from "./asset-canvas";

/**
 * Impaginazione diretta, dentro i binari del brand.
 *
 * Si trascina per spostare, si tira il bordo per allargare, si cambia il corpo
 * a passi. Quello che non si puo' fare: uscire dal margine di sicurezza,
 * scendere sotto il corpo minimo, scrivere una dimensione a mano. I vincoli
 * stanno nel modello, non in un controllo dopo.
 */

export interface AssetEditorProps {
  copy: VariantCopy;
  layout: AssetLayout;
  archetype: ArchetypeId;
  photo: string;
  onChange: (layout: AssetLayout) => void;
  /** Larghezza a cui mostrare la tela. L'altezza segue le proporzioni. */
  width: number;
}

type DragMode = "move" | "resize" | "focal";

interface DragState {
  mode: DragMode;
  blockId: string;
  startPointer: { x: number; y: number };
  startBlock: Block;
}

export function AssetEditor({
  copy,
  layout,
  archetype,
  photo,
  onChange,
  width,
}: AssetEditorProps) {
  const spec = FORMATS[layout.format];
  const scale = width / spec.width;
  const height = spec.height * scale;

  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const selected = layout.blocks.find((b) => b.id === selectedId) ?? null;
  const inset = safeInset(layout.format);

  /* ---------------- trascinamento ---------------- */

  const onPointerDown = useCallback(
    (event: React.PointerEvent, block: Block, mode: DragMode) => {
      if (block.locked && mode === "move") {
        setSelectedId(block.id);
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      setSelectedId(block.id);
      dragRef.current = {
        mode,
        blockId: block.id,
        startPointer: { x: event.clientX, y: event.clientY },
        startBlock: block,
      };
      setDragging(true);
      (event.target as Element).setPointerCapture?.(event.pointerId);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;

    function move(event: PointerEvent) {
      const drag = dragRef.current;
      const surface = surfaceRef.current;
      if (!drag || !surface) return;

      const rect = surface.getBoundingClientRect();
      const dx = (event.clientX - drag.startPointer.x) / rect.width;
      const dy = (event.clientY - drag.startPointer.y) / rect.height;

      if (drag.mode === "move") {
        const raw = { x: drag.startBlock.x + dx, y: drag.startBlock.y + dy };
        // Shift tiene libero il posizionamento, per i casi che la griglia non prevede.
        const target = event.shiftKey ? raw : snap(layout.format, raw.x, raw.y);
        onChange(updateBlock(layout, drag.blockId, target));
        return;
      }

      if (drag.mode === "resize") {
        const next: Partial<Block> = { w: drag.startBlock.w + dx };
        if (drag.startBlock.h !== undefined) next.h = drag.startBlock.h + dy;
        onChange(updateBlock(layout, drag.blockId, next));
        return;
      }

      // focal: si sposta il punto d'interesse dentro l'immagine.
      const start = drag.startBlock;
      const focal = start.focal ?? { x: 0.5, y: 0.5 };
      onChange(
        updateBlock(layout, drag.blockId, {
          focal: {
            x: Math.min(Math.max(focal.x + dx / Math.max(start.w, 0.01), 0), 1),
            y: Math.min(Math.max(focal.y + dy / Math.max(start.h ?? 0.25, 0.01), 0), 1),
          },
        }),
      );
    }

    function up() {
      dragRef.current = null;
      setDragging(false);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, layout, onChange]);

  /* ---------------- tastiera ---------------- */

  useEffect(() => {
    if (!selected) return;

    function onKey(event: KeyboardEvent) {
      if (!selected) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const nudge = event.shiftKey ? 0.02 : 0.004;
      const moves: Record<string, Partial<Block>> = {
        ArrowLeft: { x: selected.x - nudge },
        ArrowRight: { x: selected.x + nudge },
        ArrowUp: { y: selected.y - nudge },
        ArrowDown: { y: selected.y + nudge },
      };

      if (moves[event.key] && !selected.locked) {
        event.preventDefault();
        onChange(updateBlock(layout, selected.id, moves[event.key]));
        return;
      }

      if (event.key === "Escape") setSelectedId(null);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, layout, onChange]);

  /* ---------------- azioni del pannello ---------------- */

  const stepBy = (delta: number) => {
    if (!selected) return;
    const ladder = ladderFor(layout.format);
    const current = selected.step ?? 0;
    const next = Math.min(Math.max(current + delta, minStepOf(selected.kind)), ladder.length - 1);
    onChange(updateBlock(layout, selected.id, { step: next }));
  };

  const reset = () => {
    onChange(defaultLayout(layout.format, archetype));
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="tv-label">IMPAGINAZIONE</p>
        <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
          {FORMATS[layout.format].label} · impianto «{archetypeLabel(archetype)}» · trascina per
          spostare, Shift per uscire dalla griglia
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={reset}
          className="tv-pill h-[30px] gap-1.5 px-3 text-[12px] transition-colors"
          style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
        >
          <RotateCcw size={13} strokeWidth={2} />
          Ripristina template
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {/* ---------------- la tela ---------------- */}
        <div
          ref={surfaceRef}
          onPointerDown={() => setSelectedId(null)}
          className="relative shrink-0 overflow-hidden rounded-[10px]"
          style={{
            width,
            height,
            border: "1px solid var(--color-line)",
            touchAction: "none",
            cursor: dragging ? "grabbing" : "default",
          }}
        >
          <div
            style={{
              width: spec.width,
              height: spec.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
          >
            <AssetCanvas copy={copy} layout={layout} archetype={archetype} photo={photo} />
          </div>

          {/* margine di sicurezza: il confine invalicabile, sempre visibile */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: inset.x * width,
              top: inset.y * height,
              width: (1 - inset.x * 2) * width,
              height: (1 - inset.y * 2) * height,
              border: "1px dashed rgba(255,255,255,.28)",
              pointerEvents: "none",
            }}
          />

          {layout.blocks.map((b) =>
            b.visible ? (
              <Handle
                key={b.id}
                block={b}
                selected={b.id === selectedId}
                width={width}
                height={height}
                format={layout.format}
                onPointerDown={onPointerDown}
              />
            ) : null,
          )}
        </div>

        {/* ---------------- pannello proprieta' ---------------- */}
        <div className="flex min-w-[212px] flex-1 flex-col gap-2">
          {layout.blocks.map((b) => (
            <LayerRow
              key={b.id}
              block={b}
              format={layout.format}
              selected={b.id === selectedId}
              onSelect={() => setSelectedId(b.id)}
              onToggle={() => onChange(updateBlock(layout, b.id, { visible: !b.visible }))}
            />
          ))}

          {selected ? (
            <div
              className="mt-1 flex flex-col gap-2.5 rounded-[12px] p-3"
              style={{ background: "var(--color-line-soft)" }}
            >
              <p className="tv-label">{BLOCK_LABELS[selected.kind].toUpperCase()}</p>

              {selected.kind !== "image" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px]" style={{ color: "var(--color-ink-soft)" }}>
                      Corpo
                    </span>
                    <div className="flex-1" />
                    <StepButton
                      icon={<Minus size={13} strokeWidth={2.4} />}
                      label="Riduci"
                      disabled={(selected.step ?? 0) <= minStepOf(selected.kind)}
                      onClick={() => stepBy(-1)}
                    />
                    <span
                      className="tv-mono w-[46px] text-center text-[11.5px]"
                      style={{ color: "var(--color-ink)" }}
                    >
                      {fontSizeOf(layout.format, selected)} px
                    </span>
                    <StepButton
                      icon={<Plus size={13} strokeWidth={2.4} />}
                      label="Ingrandisci"
                      disabled={(selected.step ?? 0) >= ladderFor(layout.format).length - 1}
                      onClick={() => stepBy(1)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px]" style={{ color: "var(--color-ink-soft)" }}>
                      Allineamento
                    </span>
                    <div className="flex-1" />
                    {(
                      [
                        ["left", AlignLeft, "A sinistra"],
                        ["center", AlignCenter, "Al centro"],
                        ["right", AlignRight, "A destra"],
                      ] as const
                    ).map(([value, Icon, title]) => (
                      <button
                        key={value}
                        type="button"
                        title={title}
                        aria-label={title}
                        aria-pressed={selected.align === value}
                        onClick={() => onChange(updateBlock(layout, selected.id, { align: value }))}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] transition-colors"
                        style={{
                          background:
                            selected.align === value ? "var(--color-wine)" : "var(--color-paper)",
                          color: selected.align === value ? "#ffffff" : "var(--color-ink-soft)",
                          border: "1px solid var(--color-line)",
                        }}
                      >
                        <Icon size={13} strokeWidth={2} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[11.5px] leading-[1.5]" style={{ color: "var(--color-ink-soft)" }}>
                  Trascina il cerchio sull&apos;immagine per scegliere il punto che deve restare
                  visibile quando lo stesso visual passa al quadrato e alla story.
                </p>
              )}

              {selected.locked ? (
                <p
                  className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  <Lock size={12} strokeWidth={2} />
                  Il marchio non si sposta: lo decide il Brand Kit.
                </p>
              ) : null}
            </div>
          ) : (
            <p
              className="mt-1 text-[11.5px] leading-[1.5]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              Scegli un elemento sulla tela o dall&apos;elenco per spostarlo, ridimensionarlo o
              nasconderlo. Le frecce lo muovono di un passo, Shift di dieci.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Handle({
  block,
  selected,
  width,
  height,
  format,
  onPointerDown,
}: {
  block: Block;
  selected: boolean;
  width: number;
  height: number;
  format: FormatId;
  onPointerDown: (event: React.PointerEvent, block: Block, mode: DragMode) => void;
}) {
  const spec = FORMATS[format];
  const scale = width / spec.width;

  // Un blocco di testo non ha altezza propria: gli si da' un'area afferrabile.
  const boxHeight =
    block.h !== undefined ? block.h * height : Math.max(fontSizeOf(format, block) * 1.4 * scale, 22);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={BLOCK_LABELS[block.kind]}
      onPointerDown={(event) => onPointerDown(event, block, "move")}
      className="group absolute"
      style={{
        left: block.x * width,
        top: block.y * height,
        width: block.w * width,
        height: boxHeight,
        border: selected ? "1.5px solid var(--color-rose)" : "1px solid transparent",
        borderRadius: 4,
        cursor: block.locked ? "not-allowed" : "grab",
        background: selected ? "rgba(206,66,87,.06)" : "transparent",
        touchAction: "none",
      }}
    >
      {selected ? (
        <span
          className="absolute -top-[19px] left-0 whitespace-nowrap rounded-[5px] px-1.5 text-[10px] font-semibold"
          style={{ background: "var(--color-rose)", color: "#ffffff" }}
        >
          {BLOCK_LABELS[block.kind]}
        </span>
      ) : null}

      {selected && !block.locked ? (
        <span
          onPointerDown={(event) => onPointerDown(event, block, "resize")}
          className="absolute -right-[5px] -bottom-[5px] block h-[11px] w-[11px] rounded-full"
          style={{
            background: "#ffffff",
            border: "2px solid var(--color-rose)",
            cursor: "nwse-resize",
            touchAction: "none",
          }}
        />
      ) : null}

      {selected && block.kind === "image" ? (
        <span
          onPointerDown={(event) => onPointerDown(event, block, "focal")}
          className="absolute block h-[15px] w-[15px] rounded-full"
          style={{
            left: `calc(${(block.focal?.x ?? 0.5) * 100}% - 7.5px)`,
            top: `calc(${(block.focal?.y ?? 0.5) * 100}% - 7.5px)`,
            background: "rgba(255,255,255,.85)",
            border: "2px solid var(--color-coral)",
            cursor: "move",
            touchAction: "none",
          }}
        />
      ) : null}
    </div>
  );
}

function LayerRow({
  block,
  format,
  selected,
  onSelect,
  onToggle,
}: {
  block: Block;
  format: FormatId;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-[9px] px-2.5 py-1.5 transition-colors"
      style={{
        background: selected ? "var(--color-wine-tint)" : "transparent",
        color: selected ? "var(--color-wine)" : "var(--color-ink-soft)",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left text-[12.5px]"
        style={{ fontWeight: selected ? 600 : 400 }}
      >
        {BLOCK_LABELS[block.kind]}
      </button>

      {block.kind !== "image" ? (
        <span className="tv-mono text-[10.5px]" style={{ color: "var(--color-ink-faint)" }}>
          {fontSizeOf(format, block)}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        aria-label={block.visible ? "Nascondi" : "Mostra"}
        title={block.visible ? "Nascondi" : "Mostra"}
        style={{ color: "var(--color-ink-faint)" }}
      >
        {block.visible ? <Eye size={14} strokeWidth={1.9} /> : <EyeOff size={14} strokeWidth={1.9} />}
      </button>
    </div>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] transition-colors"
      style={{
        background: "var(--color-paper)",
        border: "1px solid var(--color-line)",
        color: disabled ? "var(--color-mute)" : "var(--color-ink-soft)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
    </button>
  );
}

/** Rende un blocco valido dopo una modifica esterna. */
export function normalise(layout: AssetLayout): AssetLayout {
  return { ...layout, blocks: layout.blocks.map((b) => clampBlock(layout.format, b)) };
}
