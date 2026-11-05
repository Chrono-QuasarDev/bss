// GET /api/drop/catalog
// Returns the drop products only to a request carrying a valid, unexpired access cookie.
import { json, loadCatalog, authorise } from "../../_lib/drop.mjs";

export async function onRequestGet({ request, env }) {
  const catalog = await loadCatalog(env);
  if (!catalog) return json({ error: "unavailable" }, 404);

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
