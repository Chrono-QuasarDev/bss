// GET /api/drop/catalog
// Returns the drop products only to a request carrying a valid, unexpired access cookie.
import { json, loadBundle, authorise } from "../../_lib/drop.mjs";

export async function onRequestGet({ request, env }) {
  const bundle = await loadBundle(request, env);
  if (!bundle) return json({ error: "unavailable" }, 404);
  const catalog = bundle.catalog;

  const access = await authorise(request, env, catalog);
  if (!access) return json({ error: "locked" }, 401);

  return json({
    id: catalog.id,
    name: catalog.name,
    date: catalog.date,
    price: catalog.price,
    ref: access.ref,
    products: catalog.products,
  });
}
