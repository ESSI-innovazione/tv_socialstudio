import { readJson, requireCan } from "@/lib/admin";
import { createTool, getTools } from "@/lib/db";

/**
 * Gli strumenti: l'elenco e la nascita di uno nuovo. Uno strumento nuovo e'
 * una bozza con un campo d'esempio: si scrive nell'editor e si pubblica
 * quando e' pronto, prima il team non lo vede.
 */

export const runtime = "nodejs";

function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function GET() {
  const gate = await requireCan("editTools");
  if ("response" in gate) return gate.response;
  return Response.json({ tools: await getTools() });
}

export async function POST(request: Request) {
  const gate = await requireCan("editTools");
  if ("response" in gate) return gate.response;

  const payload = await readJson<{ title?: unknown; category?: unknown }>(request);
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  if (title.length < 3) return Response.json({ error: "Dai un nome allo strumento, almeno tre lettere." }, { status: 400 });
  const category = payload?.category === "social" || payload?.category === "stampa" ? payload.category : null;

  const base = slugify(title) || "strumento";
  const taken = new Set((await getTools()).map((t) => t.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  try {
    const tool = await createTool({ slug, title, category });
    return Response.json({ tool }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
