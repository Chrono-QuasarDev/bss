// Access codes and signed cookies for early-access drops.
// Uses only Web Crypto, so the same code runs in Cloudflare Pages Functions,
// Node 18+, and the owner's local issuing tool.
//
// Code format:  BSS-0042-K7QM-9XPD-2RTW-M3HJ
//   BSS        fixed prefix
//   0042       buyer reference (4 digits, shown to the owner for records)
//   16 chars   signature: first 80 bits of HMAC-SHA256(secret, "access|<dropId>|<ref>"),
//              base32 encoded. Guessing one is not practical.

const encoder = new TextEncoder();
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CODE_RE = /^BSS(\d{4})([A-Z2-7]{16})$/;

function toBase32(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signatureFor(secret, dropId, ref) {
  const mac = await hmac(secret, `access|${dropId}|${ref}`);
  return toBase32(mac.slice(0, 10));
}

/** Build a code for a buyer reference, e.g. "0042". */
export async function issueCode(secret, dropId, ref) {
  if (!/^\d{4}$/.test(ref)) throw new Error("Reference must be exactly 4 digits, e.g. 0042");
  const sig = await signatureFor(secret, dropId, ref);
  return `BSS-${ref}-${sig.slice(0, 4)}-${sig.slice(4, 8)}-${sig.slice(8, 12)}-${sig.slice(12, 16)}`;
}

/** Normalise what a customer typed: remove spaces and hyphens, uppercase. */
export function normaliseCode(input) {
  return String(input || "").toUpperCase().replace(/[\s-]/g, "");
}

/** Returns the 4-digit buyer reference if the code is valid for this drop, otherwise null. */
export async function verifyCode(secret, dropId, input) {
  const match = CODE_RE.exec(normaliseCode(input));
  if (!match) return null;
  const [, ref, sig] = match;
  const expected = await signatureFor(secret, dropId, ref);
  return constantTimeEqual(sig, expected) ? ref : null;
}

/** Signs a cookie payload: base64url(JSON) + "." + HMAC. */
export async function signCookie(secret, payload) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const mac = toHex(await hmac(secret, `cookie|${body}`));
  return `${body}.${mac}`;
}

/** Returns the payload if the cookie is genuine and not expired, otherwise null. */
export async function readCookie(secret, value, now = Date.now()) {
  if (!value || typeof value !== "string") return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = toHex(await hmac(secret, `cookie|${body}`));
  if (!constantTimeEqual(mac, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now) return null;
  return payload;
}

/** Parses a Cookie header and returns the value of one cookie. */
export function getCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

/** Drops close at 00:00 Ghana time (GMT, UTC+0) on the drop date. */
export function dropClosesAt(dateIso) {
  return Date.parse(`${dateIso}T00:00:00Z`);
}
