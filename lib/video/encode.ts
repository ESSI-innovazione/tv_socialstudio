import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, chmod, constants, copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/**
 * La codifica: fotogrammi PNG dentro, MP4 fuori.
 *
 * ffmpeg e' un binario di `ffmpeg-static`, incluso nel pacchetto come
 * Chromium. I fotogrammi entrano da stdin (`image2pipe`): il disco serve
 * solo per il file finale, perche' `+faststart` deve riscrivere l'indice
 * in testa e non puo' farlo su un flusso.
 *
 * H.264 `yuv420p` e' il formato che Instagram, LinkedIn e i telefoni
 * accettano senza discutere. Una traccia audio c'e' sempre: con la base
 * musicale se esiste, silenziosa altrimenti, perche' qualche piattaforma
 * rifiuta un video muto.
 */

export interface EncodeOptions {
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  /** Percorso della base musicale, o `null` per il silenzio. */
  music: string | null;
}

/**
 * Il binario, eseguibile. Dopo il tracciamento su Vercel il bit di
 * esecuzione puo' non esserci: in quel caso se ne fa una copia in /tmp.
 */
async function binary(): Promise<string> {
  if (!ffmpegPath) throw new Error("ffmpeg-static non ha un binario per questa piattaforma.");

  try {
    await access(ffmpegPath, constants.X_OK);
    return ffmpegPath;
  } catch {
    const copy = path.join(os.tmpdir(), "tv-ffmpeg");
    try {
      await access(copy, constants.X_OK);
    } catch {
      await copyFile(ffmpegPath, copy);
      await chmod(copy, 0o755);
    }
    return copy;
  }
}

export async function encodeMp4(
  frames: AsyncIterable<Uint8Array>,
  options: EncodeOptions,
): Promise<Uint8Array> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tv-video-"));
  const out = path.join(dir, "out.mp4");

  const seconds = options.durationMs / 1000;
  const fadeOutAt = Math.max(0, seconds - 1).toFixed(3);

  const audioInput = options.music
    ? ["-stream_loop", "-1", "-i", options.music]
    : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];

  const audioFilter = options.music
    ? `[1:a]afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutAt}:d=1[a]`
    : "[1:a]anull[a]";

  const args = [
    "-y",
    "-loglevel", "error",
    "-f", "image2pipe",
    "-framerate", String(options.fps),
    "-i", "pipe:0",
    ...audioInput,
    "-filter_complex",
    `[0:v]crop=${options.width}:${options.height}:0:0,format=yuv420p[v];${audioFilter}`,
    "-map", "[v]",
    "-map", "[a]",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-profile:v", "high",
    "-level", "4.0",
    "-r", String(options.fps),
    "-c:a", "aac",
    "-b:a", "128k",
    "-t", seconds.toFixed(3),
    "-movflags", "+faststart",
    out,
  ];

  try {
    await run(await binary(), args, frames);
    return new Uint8Array(await readFile(out));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function run(bin: string, args: string[], frames: AsyncIterable<Uint8Array>): Promise<void> {
  const child = spawn(bin, args, { stdio: ["pipe", "ignore", "pipe"] });

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  // Se ffmpeg muore a meta', il prossimo write su stdin da' EPIPE. Va
  // raccolto, non lasciato esplodere: il messaggio buono e' su stderr.
  let broken: Error | null = null;
  child.stdin.on("error", (error: Error) => {
    broken = error;
  });

  const exit = new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? -1));
  });

  try {
    for await (const frame of frames) {
      if (broken) break;
      if (!child.stdin.write(frame)) {
        await once(child.stdin, "drain").catch(() => undefined);
      }
    }
  } finally {
    child.stdin.end();
  }

  const code = await exit;
  if (code !== 0) {
    throw new Error(`ffmpeg è uscito con codice ${code}${stderr ? `: ${stderr.trim()}` : ""}`);
  }
}
