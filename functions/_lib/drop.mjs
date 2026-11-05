// Shared server logic for the drop endpoints.
// The drop catalog and photos are stored as one encrypted file (src/drop-data/bundle.enc),
// deployed as a static asset. It is only decrypted here, on the server, after the
// access cookie has been checked. Without DROP_CONTENT_KEY the file is random bytes.
import { dropClosesAt, getCookie, readCookie, decryptBytes, bytesFromBase64 } from "./access.mjs";

export const COOKIE_NAME = "bss_drop";
export const BUNDLE_PATH = "/drop-data/bundle.enc";
const IMAGE_RE = /^[a-f0-9]{16}\.webp$/;

// Decrypted bundle is cached per isolate. The cache is keyed on the key, so a rotated key reloads.
let cached = null;

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

/** Returns { catalog, images } or null if the bundle is missing, the key is wrong, or the data is altered. */
export async function loadBundle(request, env) {
  if (!env.DROP_CONTENT_KEY || !env.ASSETS) return null;
  if (cached && cached.key === env.DROP_CONTENT_KEY) return cached.data;

  const res = await env.ASSETS.fetch(new URL(BUNDLE_PATH, request.url));
  if (!res.ok) return null;
  const plain = await decryptBytes(env.DROP_CONTENT_KEY, new Uint8Array(await res.arrayBuffer()));
  if (!plain) return null;

  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
  if (!data || !data.catalog || typeof data.images !== "object") return null;

  cached = { key: env.DROP_CONTENT_KEY, data };
  return data;
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

export function imageBytes(bundle, name) {
  const b64 = bundle.images[name];
  if (!b64) return null;
  return bytesFromBase64(b64);
}
