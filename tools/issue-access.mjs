#!/usr/bin/env node
// Issues an early-access code for a buyer after you've confirmed their payment on WhatsApp.
//
// Usage:
//   BSS_ACCESS_SECRET=... node tools/issue-access.mjs 0042 --name "Ama Mensah"
//
// Prints the code and a message to paste into WhatsApp, and records the code in
// private/issued-access.csv (never committed). The secret must match the one set in
// Cloudflare Pages, or codes will be rejected.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { issueCode } from "../functions/_lib/access.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const catalogPath = path.join(root, "private", "drop-catalog.json");
const ledgerPath = path.join(root, "private", "issued-access.csv");

const args = process.argv.slice(2);
const ref = args[0];
const nameIdx = args.indexOf("--name");
const name = nameIdx >= 0 ? args[nameIdx + 1] : "";

function fail(msg) {
  console.error("Error: " + msg);
  process.exit(1);
}

if (!process.env.BSS_ACCESS_SECRET) fail("set BSS_ACCESS_SECRET first (same value as in Cloudflare).");
if (!ref || !/^\d{4}$/.test(ref)) fail('give a 4-digit buyer reference, e.g. 0042 --name "Ama"');
if (!fs.existsSync(catalogPath)) fail("private/drop-catalog.json not found.");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const code = await issueCode(process.env.BSS_ACCESS_SECRET, catalog.id, ref);

fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
if (!fs.existsSync(ledgerPath)) fs.writeFileSync(ledgerPath, "issued_at,ref,drop,buyer\n");
const safeName = String(name).replace(/[",\n]/g, " ");
fs.appendFileSync(ledgerPath, `${new Date().toISOString()},${ref},${catalog.id},${safeName}\n`);

console.log("\nCode:", code);
console.log("\nWhatsApp message to send:\n");
console.log(
  `Your ${catalog.name} early access code is ${code}\n\n` +
    `Go to ${catalog.siteUrl || "our site"}/drop.html and enter it. ` +
    `Access closes on ${catalog.date}, so order before then.`,
);
console.log("\nRecorded in private/issued-access.csv");
