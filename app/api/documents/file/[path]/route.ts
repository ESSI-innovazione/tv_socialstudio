import { objectStore } from "@/lib/storage";

/**
 * Serve il nostro file archiviato.
 *
 * Esiste perche' l'indirizzo di export di Gamma non e' un indirizzo da
 * mostrare: scade in circa una settimana e chiunque ce l'abbia scarica il
 * file. Questo invece resta valido e sta dietro l'autenticazione dell'app.
 */

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ path: string }> }) {
  const { path } = await context.params;
  const decoded = decodeURIComponent(path);

  const file = await objectStore().get(decoded);
  if (!file) return new Response("File non trovato", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.byteLength),
      "Content-Disposition": `inline; filename="${decoded.split("/").pop()}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
