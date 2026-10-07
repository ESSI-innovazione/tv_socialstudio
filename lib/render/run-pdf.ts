import { getCampaigns, getTools } from "@/lib/db";
import { archetypeFromLabel, decodeLayout, templateLayout, type AssetLayout, type BlockText } from "@/lib/layout-model";
import type { Run } from "@/lib/types";
import { assetDocument, type AssetPageInput } from "./asset-page";
import { pdfFileName, type PrintSetup } from "./print-geometry";
import { snapshotAsset } from "./snapshot";

/**
 * Il PDF di stampa di un'esecuzione: una o tutte le varianti del poster A4,
 * un foglio per pagina. L'impaginazione e' quella che il brand-guard ha
 * controllato e salvato sull'asset; se chi scarica ne manda una ritoccata
 * nell'indirizzo, vale quella, come per il PNG.
 */

export class PdfRefused extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PdfRefused";
    this.status = status;
  }
}

export interface RunPdfOptions extends PrintSetup {
  /** Gli indici delle varianti da stampare, nell'ordine delle pagine. */
  variants: number[];
  /** Un'impaginazione ritoccata, dal link: vale per una variante sola. */
  layoutParam: string | null;
}

export async function runPdf(run: Run, options: RunPdfOptions, baseUrl: string): Promise<{ bytes: Uint8Array; filename: string }> {
  if (!run.formats.includes("poster-a4")) throw new PdfRefused("Questa esecuzione non ha il poster A4: il PDF esiste solo per la stampa.");

  const inputs: AssetPageInput[] = [];
  for (const index of options.variants) {
    const copy = run.variants.find((v) => v.index === index);
    if (!copy) throw new PdfRefused(`Variante ${index + 1} non trovata.`, 404);
    const archetype = archetypeFromLabel(copy.layout);
    const text: BlockText = { eyebrow: copy.eyebrow, headline: copy.headline, subhead: copy.subhead, body: copy.body, badge: copy.badge, disclaimer: copy.disclaimer };
    const asset = run.assets.find((a) => a.variant_index === index && a.format === "poster-a4");
    const layout: AssetLayout =
      (options.variants.length === 1 ? decodeLayout(options.layoutParam, "poster-a4") : null) ??
      asset?.layout ??
      templateLayout("poster-a4", archetype, text);
    inputs.push({ copy, layout, archetype, photo: run.brief?.photo ?? "tv-digitale.jpg", format: "poster-a4" });
  }

  const { html, page } = await assetDocument(inputs, baseUrl, { bleedMm: options.bleedMm, marks: options.marks });
  const snapshot = await snapshotAsset(html, "poster-a4", "pdf", page);

  const [campaigns, tools] = await Promise.all([getCampaigns(), getTools()]);
  const campaign = campaigns.find((c) => c.id === run.campaign_id)?.name ?? run.brief?.campaign_name ?? "campagna";
  const tool = tools.find((t) => t.slug === run.tool_slug)?.title ?? (run.tool_slug === "libero" ? "brief" : run.tool_slug);
  const filename = pdfFileName(campaign, tool, options.variants.length === 1 ? options.variants[0] + 1 : "tutte");

  return { bytes: snapshot.bytes, filename };
}

/** I parametri dell'indirizzo: `bleed=1` sono i 3 mm di abbondanza, `marks=1` i segni. */
export function printSetupFrom(params: URLSearchParams): PrintSetup {
  const bleed = params.get("bleed");
  const bleedMm = bleed === "1" || bleed === "true" ? 3 : bleed && !Number.isNaN(Number(bleed)) ? Math.min(10, Math.max(0, Number(bleed))) : 0;
  const marks = params.get("marks") === "1" || params.get("marks") === "true";
  return { bleedMm, marks };
}

/** La risposta con il PDF: in download, con il nome parlante. */
export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
