import { encodeLayout } from "./layout-model";
import type { Asset } from "./types";

/**
 * L'indirizzo di un asset reso, nel formato chiesto.
 *
 * `render_url` e' la rotta senza estensione; qui si aggiunge il tipo di file
 * e, se il brand-guard ha salvato un'impaginazione, la si porta nel link:
 * e' quella approvata, ed e' quella che deve uscire.
 */
export function assetFileUrl(asset: Asset, extension: "png" | "jpg" | "pdf" = "png", baseUrl = ""): string {
  const query = asset.layout ? `?layout=${encodeLayout(asset.layout)}` : "";
  return `${baseUrl}${asset.render_url}.${extension}${query}`;
}

/** Il nome del file scaricato: leggibile, con variante e formato. */
export function assetFileName(asset: Asset, extension: "png" | "jpg" | "pdf" = "png", prefix = "timevision"): string {
  return `${prefix}-v${asset.variant_index + 1}-${asset.format}.${extension}`;
}
