#!/usr/bin/env node
// Packs the private drop catalog and photos into one encrypted file that is safe to commit.
//
//   node tools/pack-drop.mjs --keygen      print a new DROP_CONTENT_KEY (do this once)
//   DROP_CONTENT_KEY=... node tools/pack-drop.mjs
//
// Reads:   private/drop-catalog.json, private/drops/*.webp
// Writes:  src/drop-data/bundle.enc   (encrypted; committed and deployed)
//          src/drop-teaser.json       (public: id, name, date, price only)
//
// The same DROP_CONTENT_KEY must be set as a Pages secret, or the drop will not open.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encryptBytes, newContentKey, base64FromBytes } from "../functions/_lib/access.mjs";
import { loadDotEnv } from "./env.mjs";

loadDotEnv();

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const catalogPath = path.join(root, "private", "drop-catalog.json");
const imagesDir = path.join(root, "private", "drops");
const outDir = path.join(root, "src", "drop-data");
const teaserPath = path.join(root, "src", "drop-teaser.json");

if (process.argv.includes("--keygen")) {
  console.log(newContentKey());
  process.exit(0);
}

const key = process.env.DROP_CONTENT_KEY;
if (!key) {
  console.error("Error: set DROP_CONTENT_KEY first (use --keygen to make one).");
  process.exit(1);
}
if (!fs.existsSync(catalogPath)) {
  console.error("Error: private/drop-catalog.json not found.");
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const IMAGE_RE = /^[a-f0-9]{16}\.webp$/;

const images = {};
for (const p of catalog.products) {
  if (!IMAGE_RE.test(p.image)) {
    console.error(`Error: product ${p.id} has image "${p.image}". Use 16 lowercase hex characters plus .webp.`);
    process.exit(1);
  }
  const file = path.join(imagesDir, p.image);
  if (!fs.existsSync(file)) {
    console.error(`Error: missing image ${file}`);
    process.exit(1);
  }
  images[p.image] = base64FromBytes(fs.readFileSync(file));
}

const payload = new TextEncoder().encode(JSON.stringify({ catalog, images }));
const blob = await encryptBytes(key, payload);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "bundle.enc"), blob);

const teaser = {
  id: catalog.id,
  name: catalog.name,
  date: catalog.date,
  price: catalog.price,
  siteUrl: catalog.siteUrl || "",
};
fs.writeFileSync(teaserPath, JSON.stringify(teaser, null, 2) + "\n");

console.log(`Packed ${catalog.products.length} product(s) and ${Object.keys(images).length} photo(s).`);
console.log("Wrote src/drop-data/bundle.enc (encrypted) and src/drop-teaser.json (public).");
