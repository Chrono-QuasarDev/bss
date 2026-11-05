import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { issueCode, newContentKey, encryptBytes, base64FromBytes } from "../functions/_lib/access.mjs";
import { onRequestPost as unlock } from "../functions/api/drop/unlock.js";
import { onRequestGet as catalog } from "../functions/api/drop/catalog.js";
import { onRequestGet as image } from "../functions/api/drop/image/[file].js";

const SECRET = "test-secret-not-real-0123456789";
const FUTURE = "2099-01-01";
const PAST = "2001-01-01";
const IMG = "9f1a2b3c4d5e6f7a.webp";
const IMG_BYTES = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);

// Builds an encrypted bundle exactly as tools/pack-drop.mjs does, and serves it as a static asset.
async function assetsFor(catalogObj, key = newContentKey()) {
  const payload = new TextEncoder().encode(
    JSON.stringify({ catalog: catalogObj, images: { [IMG]: base64FromBytes(IMG_BYTES) } }),
  );
  const blob = await encryptBytes(key, payload);
  return {
    fetch: async (req) => {
      const url = new URL(req instanceof URL ? req.href : typeof req === "string" ? req : req.url);
      if (url.pathname !== "/drop-data/bundle.enc") return new Response("nope", { status: 404 });
      return new Response(blob, { status: 200 });
    },
  };
}

function makeCatalog(date = FUTURE) {
  return {
    id: "signal-drop-01",
    name: "Signal Collection",
    date,
    price: 20,
    products: [{ id: "p1", name: "Test Tee", price: 240, desc: "d", details: [], sizes: ["M"], colors: [{ name: "Ink", hex: "#000" }], image: IMG }],
  };
}

// Each environment gets its own content key, so the per-isolate bundle cache never mixes test cases.
async function env(catalogObj = makeCatalog(), extra = {}) {
  const key = newContentKey();
  return { BSS_ACCESS_SECRET: SECRET, DROP_CONTENT_KEY: key, ASSETS: await assetsFor(catalogObj, key), ...extra };
}

function post(code) {
  return new Request("https://x.test/api/drop/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

function cookieFrom(res) {
  const sc = res.headers.get("Set-Cookie") || "";
  const m = /bss_drop=([^;]+)/.exec(sc);
  return m ? `bss_drop=${m[1]}` : null;
}

function get(url, cookie) {
  return new Request(url, { headers: cookie ? { Cookie: cookie } : {} });
}

test("a wrong code gets 401 and no cookie", async () => {
  const res = await unlock({ request: post("BSS-0000-AAAA-AAAA-AAAA-AAAA"), env: await env() });
  assert.equal(res.status, 401);
  assert.equal(cookieFrom(res), null);
});

test("a garbage body gets 400", async () => {
  const req = new Request("https://x.test/api/drop/unlock", { method: "POST", body: "not json" });
  const res = await unlock({ request: req, env: await env() });
  assert.equal(res.status, 400);
});

test("catalog is locked without a cookie", async () => {
  const res = await catalog({ request: get("https://x.test/api/drop/catalog"), env: await env() });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.products, undefined);
});

test("a valid code unlocks; catalog then returns products with the buyer ref", async () => {
  const e = await env();
  const code = await issueCode(SECRET, "signal-drop-01", "0042");
  const res = await unlock({ request: post(code), env: e });
  assert.equal(res.status, 200);
  const cookie = cookieFrom(res);
  assert.ok(cookie, "cookie set");
  assert.match(res.headers.get("Set-Cookie"), /HttpOnly/);
  assert.match(res.headers.get("Set-Cookie"), /Secure/);
  assert.match(res.headers.get("Set-Cookie"), /SameSite=Strict/);

  const c = await catalog({ request: get("https://x.test/api/drop/catalog", cookie), env: e });
  assert.equal(c.status, 200);
  const data = await c.json();
  assert.equal(data.ref, "0042");
  assert.equal(data.products[0].name, "Test Tee");
});

test("a code typed in lowercase with spaces still unlocks", async () => {
  const code = await issueCode(SECRET, "signal-drop-01", "0009");
  const res = await unlock({ request: post(code.toLowerCase().replace(/-/g, " ")), env: await env() });
  assert.equal(res.status, 200);
});

test("a forged cookie is rejected", async () => {
  const forged = "bss_drop=" + Buffer.from(JSON.stringify({ drop: "signal-drop-01", ref: "0001", exp: Date.now() + 1e9 })).toString("base64url") + ".deadbeef";
  const res = await catalog({ request: get("https://x.test/api/drop/catalog", forged), env: await env() });
  assert.equal(res.status, 401);
});

test("the cookie does not unlock a different drop", async () => {
  const e = await env();
  const code = await issueCode(SECRET, "signal-drop-01", "0042");
  const cookie = cookieFrom(await unlock({ request: post(code), env: e }));
  const other = makeCatalog();
  other.id = "another-drop";
  const res = await catalog({ request: get("https://x.test/api/drop/catalog", cookie), env: await env(other) });
  assert.equal(res.status, 401);
});

test("a revoked buyer reference is refused at unlock and at catalog", async () => {
  const code = await issueCode(SECRET, "signal-drop-01", "0042");
  const revoked = await env(makeCatalog(), { DROP_REVOKED: "0041, 0042" });
  const res = await unlock({ request: post(code), env: revoked });
  assert.equal(res.status, 401);

  // A cookie issued before revocation stops working once the list is updated.
  const before = cookieFrom(await unlock({ request: post(code), env: await env() }));
  const after = await catalog({ request: get("https://x.test/api/drop/catalog", before), env: revoked });
  assert.equal(after.status, 401);
});

test("after the drop date, unlock returns 410 and the catalog is closed", async () => {
  const past = await env(makeCatalog(PAST));
  const code = await issueCode(SECRET, "signal-drop-01", "0042");
  const res = await unlock({ request: post(code), env: past });
  assert.equal(res.status, 410);
});

test("images require a valid cookie and a valid file name", async () => {
  const locked = await image({ request: get("https://x.test/api/drop/image/" + IMG), env: await env(), params: { file: IMG } });
  assert.equal(locked.status, 401);

  const e = await env();
  const code = await issueCode(SECRET, "signal-drop-01", "0042");
  const cookie = cookieFrom(await unlock({ request: post(code), env: e }));
  const ok = await image({ request: get("https://x.test/api/drop/image/" + IMG, cookie), env: e, params: { file: IMG } });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("Content-Type"), "image/webp");
  assert.match(ok.headers.get("Cache-Control"), /private/);

  const traversal = await image({ request: get("https://x.test/x", cookie), env: e, params: { file: "../drop-catalog.json" } });
  assert.equal(traversal.status, 404);
});

test("no secret configured means nothing is unlocked", async () => {
  const res = await unlock({ request: post("BSS-0042-AAAA-AAAA-AAAA-AAAA"), env: { ASSETS: await assetsFor(makeCatalog()) } });
  assert.equal(res.status, 500);
});

test("a wrong content key means the drop cannot be opened", async () => {
  const e = { BSS_ACCESS_SECRET: SECRET, DROP_CONTENT_KEY: newContentKey(), ASSETS: await assetsFor(makeCatalog()) };
  const code = await issueCode(SECRET, "signal-drop-01", "0042");
  const res = await unlock({ request: post(code), env: e });
  assert.equal(res.status, 404);
});

test("the encrypted bundle shipped in the repo reveals no product names", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(here, "..", "src", "drop-data", "bundle.enc");
  if (!fs.existsSync(file)) return; // not packed yet
  const bytes = fs.readFileSync(file);
  for (const word of ["Phantom", "Signal Tee", "Signal Collection", "SIGNAL07", "BSS-0"]) {
    assert.equal(bytes.includes(Buffer.from(word)), false, `shipped bundle contains "${word}"`);
  }
});
