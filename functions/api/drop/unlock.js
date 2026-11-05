// POST /api/drop/unlock  { "code": "BSS-0042-..." }
// Checks the access code, then sets a signed, HttpOnly cookie that lasts until the drop closes.
import { verifyCode, signCookie, dropClosesAt } from "../../_lib/access.mjs";
import { COOKIE_NAME, json, loadBundle, isRevoked } from "../../_lib/drop.mjs";

export async function onRequestPost({ request, env }) {
  if (!env.BSS_ACCESS_SECRET) return json({ error: "unavailable" }, 500);

  const bundle = await loadBundle(request, env);
  if (!bundle) return json({ error: "unavailable" }, 404);
  const catalog = bundle.catalog;

  const closesAt = dropClosesAt(catalog.date);
  if (Date.now() >= closesAt) return json({ error: "closed" }, 410);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid" }, 400);
  }

  const ref = await verifyCode(env.BSS_ACCESS_SECRET, catalog.id, body && body.code);
  // Same response for "wrong code" and "revoked", so attackers learn nothing.
  if (!ref || isRevoked(env, ref)) return json({ error: "invalid" }, 401);

  const cookie = await signCookie(env.BSS_ACCESS_SECRET, {
    drop: catalog.id,
    ref,
    exp: closesAt,
  });
  const maxAge = Math.max(0, Math.floor((closesAt - Date.now()) / 1000));

  return json({ ok: true, name: catalog.name, date: catalog.date }, 200, {
    "Set-Cookie": `${COOKIE_NAME}=${cookie}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
  });
}
