import { currentUser } from "@/auth";
import { getJob } from "@/lib/db-videos";
import { objectStore } from "@/lib/storage";

/**
 * Serve l'MP4 archiviato.
 *
 * Un `<video>` chiede il file a pezzi (`Range`) per fare scorrere la barra:
 * senza il 206 l'anteprima parte ma non si puo' cercare dentro. Con
 * `?download=1` il browser lo salva invece di aprirlo.
 */

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const { id } = await context.params;
  const job = await getJob(id);
  if (!job || job.status !== "ready" || !job.stored_path) {
    return new Response("Video non trovato", { status: 404 });
  }

  const file = await objectStore().get(job.stored_path);
  if (!file) return new Response("File non trovato", { status: 404 });

  const total = file.data.byteLength;
  const name = `timevision-v${job.variant_index + 1}-${job.format}.mp4`;
  const download = new URL(request.url).searchParams.get("download") === "1";

  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
    "Cache-Control": "private, max-age=3600",
  };

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;

  if (match) {
    const start = match[1] ? Number.parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(Number.parseInt(match[2], 10), total - 1) : total - 1;

    if (Number.isNaN(start) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${total}` },
      });
    }

    return new Response(new Uint8Array(file.data.subarray(start, end + 1)), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  return new Response(new Uint8Array(file.data), {
    headers: { ...headers, "Content-Length": String(total) },
  });
}
