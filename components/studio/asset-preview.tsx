import { BRAND, FONT_FAMILY, FORMATS, type FormatId } from "@/lib/brand";
import type { VariantCopy } from "@/lib/types";

/**
 * Composizione di un asset alla sua dimensione nativa, riscalata per stare
 * nella console. Le stesse tre impaginazioni che il rendering server-side
 * dovra' produrre al passo 3: qui sono la verita' visiva di riferimento.
 */

interface Props {
  variant: VariantCopy;
  format: FormatId;
  photo?: string;
  /** Larghezza a cui mostrare l'anteprima. L'altezza segue il rapporto. */
  displayWidth: number;
}

export function AssetPreview({ variant, format, photo = "tv-digitale.jpg", displayWidth }: Props) {
  const spec = FORMATS[format];
  const scale = displayWidth / spec.width;

  return (
    <div
      style={{
        width: displayWidth,
        height: Math.round(spec.height * scale),
        overflow: "hidden",
        borderRadius: 8,
        background: BRAND.canvas,
      }}
    >
      <div
        style={{
          width: spec.width,
          height: spec.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <Composition variant={variant} format={format} photo={photo} />
      </div>
    </div>
  );
}

/** L'impaginazione vera e propria, sempre a dimensione nativa. */
export function Composition({
  variant,
  format,
  photo = "tv-digitale.jpg",
}: Omit<Props, "displayWidth"> & { photo?: string }) {
  const spec = FORMATS[format];
  const w = spec.width;
  const h = spec.height;
  const k = Math.min(w, h) / 1000;
  const pad = spec.safeArea;
  const f = (px: number) => Math.round(px * k);
  const short = variant.headline.length <= 14;
  const headlineSize = short ? f(170) : f(76);

  const shell: React.CSSProperties = {
    width: w,
    height: h,
    fontFamily: FONT_FAMILY,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  };

  if (variant.layout === "foto a tutta pagina") {
    return (
      <div style={{ ...shell, background: BRAND.paper }}>
        <div style={{ position: "relative", flex: "1 1 auto", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/brand/${photo}`}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, rgba(114,0,38,.72) 0%, rgba(114,0,38,.30) 42%, rgba(114,0,38,.92) 100%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: pad,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Mark k={k} color={BRAND.paper} />
            <div>
              <Eyebrow k={k} color={BRAND.apricot} text={variant.eyebrow} />
              <div
                style={{
                  fontSize: headlineSize,
                  lineHeight: 1.02,
                  fontWeight: 800,
                  color: BRAND.paper,
                  letterSpacing: "-0.02em",
                  marginTop: f(18),
                }}
              >
                {variant.headline}
              </div>
              <div
                style={{
                  fontSize: f(30),
                  lineHeight: 1.35,
                  fontWeight: 400,
                  color: BRAND.onWine,
                  marginTop: f(16),
                  maxWidth: "88%",
                }}
              >
                {variant.subhead}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: f(20), marginTop: f(30) }}>
                <Cta k={k} label={variant.cta_label} bg={BRAND.coral} fg={BRAND.paper} />
                {variant.badge ? <Badge k={k} text={variant.badge} tone="on-dark" /> : null}
              </div>
            </div>
          </div>
        </div>
        <Disclaimer k={k} pad={pad} text={variant.disclaimer} tone="light" />
      </div>
    );
  }

  if (variant.layout === "countdown in evidenza") {
    return (
      <div style={{ ...shell, background: BRAND.paper }}>
        <div style={{ padding: pad, paddingBottom: f(24) }}>
          <Mark k={k} color={BRAND.wine} />
          <Eyebrow k={k} color={BRAND.rose} text={variant.eyebrow} style={{ marginTop: f(40) }} />
          <div
            style={{
              fontSize: headlineSize,
              lineHeight: 1.04,
              fontWeight: 800,
              color: BRAND.ink,
              letterSpacing: "-0.02em",
              marginTop: f(16),
            }}
          >
            {variant.headline}
          </div>
          <div
            style={{
              fontSize: f(30),
              lineHeight: 1.35,
              fontWeight: 500,
              color: BRAND.inkSoft,
              marginTop: f(18),
            }}
          >
            {variant.subhead}
          </div>
        </div>

        {variant.badge ? (
          <div
            style={{
              background: BRAND.coral,
              color: BRAND.paper,
              padding: `${f(22)}px ${pad}px`,
              fontSize: f(30),
              fontWeight: 700,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {variant.badge}
          </div>
        ) : null}

        <div
          style={{
            flex: "1 1 auto",
            padding: `${f(28)}px ${pad}px`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: f(24),
              lineHeight: 1.5,
              color: BRAND.inkSoft,
              maxWidth: "92%",
            }}
          >
            {variant.body}
          </div>
          <div style={{ marginTop: f(26) }}>
            <Cta k={k} label={variant.cta_label} bg={BRAND.rose} fg={BRAND.paper} />
          </div>
        </div>

        <Disclaimer k={k} pad={pad} text={variant.disclaimer} tone="dark" />
      </div>
    );
  }

  /* impianto di default: dato dominante su fondo wine */
  return (
    <div style={{ ...shell, background: BRAND.wine }}>
      <div
        style={{
          flex: "1 1 auto",
          padding: pad,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Mark k={k} color={BRAND.paper} />
          <Eyebrow k={k} color={BRAND.apricot} text={variant.eyebrow} style={{ marginTop: f(44) }} />
        </div>

        <div>
          <div
            style={{
              fontSize: headlineSize,
              lineHeight: 0.98,
              fontWeight: 800,
              color: BRAND.paper,
              letterSpacing: "-0.03em",
            }}
          >
            {variant.headline}
          </div>
          <div
            style={{
              fontSize: f(34),
              lineHeight: 1.3,
              fontWeight: 500,
              color: BRAND.onWine,
              marginTop: f(18),
              maxWidth: "86%",
            }}
          >
            {variant.subhead}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: f(23),
              lineHeight: 1.5,
              color: BRAND.onWine,
              maxWidth: "88%",
              marginBottom: f(28),
            }}
          >
            {variant.body}
          </div>
          <Cta k={k} label={variant.cta_label} bg={BRAND.coral} fg={BRAND.paper} />
        </div>
      </div>

      {variant.badge ? (
        <div
          style={{
            background: BRAND.coral,
            color: BRAND.paper,
            padding: `${f(20)}px ${pad}px`,
            fontSize: f(28),
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {variant.badge}
        </div>
      ) : null}

      <Disclaimer k={k} pad={pad} text={variant.disclaimer} tone="on-wine" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Mark({ k, color }: { k: number; color: string }) {
  const size = Math.round(38 * k);
  return (
    <span style={{ display: "flex", alignItems: "center", gap: Math.round(12 * k) }}>
      <svg width={size} height={size * (108 / 105)} viewBox="0 0 105 108" aria-hidden>
        <path
          d="M52.44,1.18a52.44,52.44,0,1,0,52.44,52.44A52.44,52.44,0,0,0,52.44,1.18m6.07,92.48v-34h14V47.55H46.37V93.66a40.49,40.49,0,1,1,12.14,0"
          fill={color}
        />
      </svg>
      <span
        style={{
          fontSize: Math.round(22 * k),
          fontWeight: 800,
          color,
          letterSpacing: "-0.01em",
        }}
      >
        Time Vision
      </span>
    </span>
  );
}

function Eyebrow({
  k,
  color,
  text,
  style,
}: {
  k: number;
  color: string;
  text: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: Math.round(20 * k),
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

function Cta({ k, label, bg, fg }: { k: number; label: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: Math.round(26 * k),
        fontWeight: 700,
        padding: `${Math.round(18 * k)}px ${Math.round(38 * k)}px`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Badge({ k, text, tone }: { k: number; text: string; tone: "on-dark" | "on-light" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        border: `${Math.max(1, Math.round(2 * k))}px solid ${
          tone === "on-dark" ? "rgba(255,255,255,.55)" : BRAND.line
        }`,
        color: tone === "on-dark" ? BRAND.paper : BRAND.ink,
        fontSize: Math.round(21 * k),
        fontWeight: 600,
        padding: `${Math.round(13 * k)}px ${Math.round(26 * k)}px`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function Disclaimer({
  k,
  pad,
  text,
  tone,
}: {
  k: number;
  pad: number;
  text: string | null;
  tone: "dark" | "light" | "on-wine";
}) {
  if (!text) return null;
  const palette =
    tone === "on-wine"
      ? { bg: BRAND.wine, fg: BRAND.onWineFaint }
      : tone === "light"
        ? { bg: BRAND.wine, fg: BRAND.onWineFaint }
        : { bg: BRAND.wineTint, fg: BRAND.wine };
  return (
    <div
      style={{
        background: palette.bg,
        color: palette.fg,
        padding: `${Math.round(16 * k)}px ${pad}px`,
        fontSize: Math.round(15 * k),
        lineHeight: 1.45,
      }}
    >
      {text}
    </div>
  );
}
