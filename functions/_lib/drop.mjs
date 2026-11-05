// Shared server logic for the drop endpoints.
// The drop catalog and product images live in a private R2 bucket (binding: DROP_BUCKET).
// Nothing here is ever bundled into the public site.
import { dropClosesAt, getCookie, readCookie } from "./access.mjs";

export const COOKIE_NAME = "bss_drop";
export const CATALOG_KEY = "drop-catalog.json";
const IMAGE_RE = /^[a-f0-9]{16}\.webp$/;

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

export async function loadCatalog(env) {
  if (!env.DROP_BUCKET) return null;
  const obj = await env.DROP_BUCKET.get(CATALOG_KEY);
  if (!obj) return null;
  try {
    return await obj.json();
  } catch {
    return null;
  }
}

export function isRevoked(env, ref) {
  const list = String(env.DROP_REVOKED || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(ref);
}

/** Returns the cookie payload if this request may see the drop, otherwise null. */
export async function authorise(request, env, catalog, now = Date.now()) {
  if (!env.BSS_ACCESS_SECRET || !catalog) return null;
  const raw = getCookie(request.headers.get("Cookie"), COOKIE_NAME);
  const payload = await readCookie(env.BSS_ACCESS_SECRET, raw, now);
  if (!payload || payload.drop !== catalog.id) return null;
  if (now >= dropClosesAt(catalog.date)) return null;
  if (isRevoked(env, payload.ref)) return null;
  return payload;
}

export function imageNameIsValid(name) {
  return IMAGE_RE.test(name);
}
