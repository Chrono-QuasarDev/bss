// GET /api/drop/image/<name>.webp
// Returns a drop product photo only to a request with a valid access cookie.
import { json, loadBundle, authorise, imageNameIsValid, imageBytes } from "../../../_lib/drop.mjs";

export async function onRequestGet({ request, env, params }) {
  const file = String(params.file || "");
  if (!imageNameIsValid(file)) return json({ error: "not found" }, 404);

  const bundle = await loadBundle(request, env);
  if (!bundle) return json({ error: "unavailable" }, 404);
  const catalog = bundle.catalog;

  const access = await authorise(request, env, catalog);
  if (!access) return json({ error: "locked" }, 401);

  const bytes = imageBytes(bundle, file);
  if (!bytes) return json({ error: "not found" }, 404);

  return new Response(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
