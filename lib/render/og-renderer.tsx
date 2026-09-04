import { ImageResponse } from "next/og";
import {
  FORMAT_SIZE,
  type AssetFormat,
  type CampaignFacts,
  type RenderedAsset,
  type TemplateSpec,
} from "@/lib/integrations/types";
import { lexend } from "./fonts";
import { Composition } from "./composition";

/**
 * I tre formati social, via Satori.
 *
 * Non costa niente, non serve un binario del browser e sta dentro i tempi di
 * una funzione. In cambio conosce solo un sottoinsieme di CSS: flexbox si,
 * CSS grid no, e niente backdrop-filter o filtri. Il vincolo e' rispettato
 * nel componente condiviso, non aggirato qui.
 *
 * Il font va passato come buffer. Un @font-face che punta a Google Fonts non
 * viene risolto: il testo uscirebbe con un ripiego di sistema, senza errori.
 */
export async function renderWithOg(
  spec: TemplateSpec,
  facts: CampaignFacts,
  format: AssetFormat,
  baseUrl: string,
): Promise<RenderedAsset> {
  const size = FORMAT_SIZE[format];
  const fonts = await lexend();

  const response = new ImageResponse(
    <Composition spec={spec} facts={facts} format={format} baseUrl={baseUrl} />,
    { width: size.w, height: size.h, fonts },
  );

  const bytes = Buffer.from(await response.arrayBuffer());

  return { format, bytes, mime: "image/png", width: size.w, height: size.h };
}
