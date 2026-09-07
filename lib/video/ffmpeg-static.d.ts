/**
 * `ffmpeg-static` non porta i tipi: esporta il percorso del binario per la
 * piattaforma corrente, o `null` se non ne ha uno.
 */
declare module "ffmpeg-static" {
  const ffmpegPath: string | null;
  export default ffmpegPath;
}
