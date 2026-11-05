// GET /api/drop/image/<name>.webp
// Streams a drop product photo only to a request with a valid access cookie.
import { json, loadCatalog, authorise, imageNameIsValid } from "../../../_lib/drop.mjs";

export async function onRequestGet({ request, env, params }) {
  const file = String(params.file || "");
  if (!imageNameIsValid(file)) return json({ error: "not found" }, 404);

  const catalog = await loadCatalog(env);
  if (!catalog) return json({ error: "unavailable" }, 404);

  const access = await authorise(request, env, catalog);
  if (!access) return json({ error: "locked" }, 401);

  const obj = await env.DROP_BUCKET.get(`images/${file}`);
  if (!obj) return json({ error: "not found" }, 404);

  return new Response(obj.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
