import type {
  AssetFormat,
  AssetRenderer,
  CampaignFacts,
  RenderedAsset,
  TemplateSpec,
} from "@/lib/integrations/types";
import { renderWithOg } from "./og-renderer";
import { renderForPrint } from "./print-renderer";

/**
 * Un'interfaccia, due motori, scelti dal formato.
 *
 * Social con Satori: gratis, veloce, nessun binario. Stampa con Chromium:
 * CSS completo, PDF vero, 300 dpi. Chi chiama non deve saperlo.
 */

const PRINT_FORMATS: AssetFormat[] = ["poster-a4"];

export function isPrintFormat(format: AssetFormat): boolean {
  return PRINT_FORMATS.includes(format);
}

export function createRenderer(baseUrl: string): AssetRenderer {
  return {
    async render(spec: TemplateSpec, facts: CampaignFacts, format: AssetFormat) {
      if (!spec.frames[format]) {
        throw new Error(
          `Il template «${spec.name}» non ha un frame per il formato ${format}. ` +
            `Formati disponibili: ${spec.formats.join(", ")}.`,
        );
      }

      return isPrintFormat(format)
        ? renderForPrint(spec, facts, format, baseUrl, "png")
        : renderWithOg(spec, facts, format, baseUrl);
    },
  };
}

/** Il PDF del poster, per la stampa vera. */
export async function renderPdf(
  spec: TemplateSpec,
  facts: CampaignFacts,
  baseUrl: string,
): Promise<RenderedAsset> {
  return renderForPrint(spec, facts, "poster-a4", baseUrl, "pdf");
}

export { renderWithOg, renderForPrint };
export { PRINT_SCALE } from "./print-renderer";
