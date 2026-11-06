# B.S.S Storefront

The online store for B.S.S, a screen-printing label in Accra that sells heavyweight tees and hoodies. Customers browse the shop, build a bag, and send their order on WhatsApp. Payment is arranged on WhatsApp by mobile money or bank transfer.

Early-access drops are paid on WhatsApp too. Buyers get a personal access code and unlock the drop on the site. The drop content is only ever sent by the server, after the code is checked.

## Quick start

Requirements: Node.js 18 or newer. No npm install is needed.

```bash
node build.js          # build the public site into dist/
node --test tools/     # run the access-code and endpoint tests
cd dist && python3 -m http.server 8080
```

## Project structure

```
bss/
├── build.js                 Generates every public page into dist/
├── wrangler.toml            Cloudflare Pages config (output folder and private bucket binding)
├── assets/                  Public images (hero, teaser)
├── src/
│   ├── styles.css           Design system
│   ├── pages.css            Inner-page styles
│   └── js/
│       ├── products.js      Public catalog (no drop products)
│       ├── art.js           SVG shirt and hoodie artwork
│       ├── shared.js        Bag, product options, shop, checkout, WhatsApp handoff
│       └── drop.js          Early-access page (asks the server, holds no secrets)
├── functions/               Server code (Cloudflare Pages Functions)
│   ├── _lib/access.mjs      Code signing and verification, cookie signing
│   ├── _lib/drop.mjs        Catalog loading, access check, revocation
│   └── api/drop/
│       ├── unlock.js        POST: check a code, set the access cookie
│       ├── catalog.js       GET: drop products, only with a valid cookie
│       └── image/[file].js  GET: drop photos, only with a valid cookie
├── src/drop-data/
│   └── bundle.enc           Encrypted drop catalog and photos (safe to commit)
├── src/drop-teaser.json     Public teaser: drop id, name, date, fee
├── tools/
│   ├── issue-access.mjs     Owner tool: issue a code for a paid buyer
│   ├── pack-drop.mjs        Owner tool: encrypt the drop catalog and photos
│   ├── env.mjs              Loads .env for the tools
│   ├── test-access.mjs      Tests for codes and cookies
│   └── test-endpoints.mjs   Tests for the server endpoints
├── .env                     NEVER COMMITTED: BSS_ACCESS_SECRET, DROP_CONTENT_KEY
└── private/                 NEVER COMMITTED (gitignored)
    ├── drop-catalog.json    Full drop catalog (source for pack-drop.mjs)
    ├── drops/               Drop product photos (source)
    └── issued-access.csv    Ledger of codes issued (buyer reference and name)
```

## Public pages

| Page | Path |
|---|---|
| Home | `index.html` |
| Shop | `shop.html` (shows the early-access teaser while a drop is upcoming) |
| Product | `product/<slug>.html` |
| Bag and checkout | `cart.html`, `checkout.html`, `order-sent.html` |
| Early access | `drop.html` (not linked from the menu, noindex) |
| Other | About, Journal, Size Guide, Delivery, Returns, FAQ, Contact, Track Order, Privacy, Terms, 404 |

## How early access works

```
Buyer ──WhatsApp──► Owner confirms payment
                         │
                         ▼
          node tools/issue-access.mjs 0042 --name "Ama"
                         │   prints code: BSS-0042-XXXX-XXXX-XXXX-XXXX
                         ▼
          Owner sends the code on WhatsApp
                         │
Buyer opens /drop.html, enters the code
                         │
                         ▼
   POST /api/drop/unlock ── checks code (HMAC) ── sets signed HttpOnly cookie
                         │
   GET  /api/drop/catalog ── cookie valid? ── returns products
   GET  /api/drop/image/…  ── cookie valid? ── returns photo
                         │
Buyer taps "Reserve on WhatsApp" ──► order message with their ref
```

### Security model

- **Products are never in the public site as readable data.** The drop catalog and photos are packed into `src/drop-data/bundle.enc`, encrypted with AES-256-GCM. The key (`DROP_CONTENT_KEY`) is a Pages secret. Without it the file is random bytes. The server decrypts it only after the cookie check.
- **Codes are signed, not stored.** Each code is an HMAC-SHA256 of the drop ID and buyer reference, using a secret that exists only in Cloudflare and on the owner's machine. The 80-bit signature cannot be guessed, and a code for one drop does not work on another.
- **Access is a signed cookie.** It is HttpOnly, Secure, and SameSite=Strict. It expires when the drop closes. Its contents are signed, so it can't be edited.
- **The date is checked on the server.** Changing the device clock does nothing.
- **Revocation.** Add a buyer reference to `DROP_REVOKED` and redeploy. Their code and cookie stop working.
- **Errors reveal nothing.** A wrong code and a revoked code get the same response.
- **The encrypted file is safe to publish, but the key is not.** If `DROP_CONTENT_KEY` leaks, the drop content can be decrypted from the public file. If you rotate the key, re-run `pack-drop.mjs` and redeploy.

### What this does not protect against

- **Screenshots and sharing.** Anything shown on screen can be captured. The name on the unlocked page and the buyer reference discourage this. Watermarking the photos is not yet implemented.
- **Code sharing.** A buyer can give their code to someone else. The ledger shows which buyer it belonged to.
- **Brute force** is limited by the code's strength (80 bits). A rate-limit rule on `/api/drop/unlock` in the Cloudflare dashboard adds a second layer if the plan allows it.

## Owner runbook

### One-time setup (no card needed)

Everything runs on Cloudflare Pages' free plan. There is no R2 bucket or other paid service.

1. **Generate the two secrets** (once):
   ```bash
   cp .env.example .env
   node -e "console.log('BSS_ACCESS_SECRET=' + require('crypto').randomBytes(32).toString('base64url'))"
   node tools/pack-drop.mjs --keygen      # prints DROP_CONTENT_KEY
   ```
   Put both values in `.env`, and keep a copy in a password manager.
2. **Pack the drop** (whenever the catalog or photos change):
   ```bash
   node tools/pack-drop.mjs               # reads .env, writes src/drop-data/bundle.enc
   ```
   Commit `src/drop-data/bundle.enc` and `src/drop-teaser.json`. Do not commit `private/` or `.env`.
3. **Create the Pages project.** Connect the repo, with build command `node build.js` and output directory `dist`.
4. **Add the secrets** in the Pages dashboard (Settings → Environment variables, encrypted): `BSS_ACCESS_SECRET` and `DROP_CONTENT_KEY`. Redeploy after adding them.

### Issuing a code

After you've confirmed the payment on WhatsApp:

```bash
BSS_ACCESS_SECRET=... node tools/issue-access.mjs 0042 --name "Ama Mensah"
```

Send the printed WhatsApp message. Use a new reference for each buyer (0001, 0002, and so on). The ledger in `private/issued-access.csv` records each one.

### Revoking a buyer

Add the reference to `DROP_REVOKED` in the Pages dashboard (comma-separated, e.g. `0042,0051`) and redeploy.

### Changing the drop

- Edit `private/drop-catalog.json` or add photos to `private/drops/`. Photo names must be 16 lowercase hex characters plus `.webp`.
- Run `node tools/pack-drop.mjs`, commit `src/drop-data/bundle.enc` and `src/drop-teaser.json`, and redeploy.

### Ending early access

On drop day, the early-access endpoints close automatically at 00:00 GMT (which is Ghana time). To make the products public:

1. Add them to `src/js/products.js` in the normal format.
2. Rebuild and deploy.

The teaser disappears from the shop once the drop date passes.

### Rotating the secret

Changing `BSS_ACCESS_SECRET` invalidates every code and cookie that was issued. Buyers would need new codes. Changing `DROP_CONTENT_KEY` means re-packing the drop. Only do either if a leak is suspected.

## Changing the WhatsApp number

Set it in these places and keep them identical:
- `build.js`: `WA_NUMBER` and `WA_DISPLAY`
- `src/js/shared.js` and `src/js/drop.js`: `WA_NUMBER`

Use the international format without `+` or a leading zero. `0206764888` becomes `233206764888`.

## Design system

- **Themes** (`src/styles.css`): a light studio-cream theme by default (`--ink` cream canvas, `--ink-2` linen surfaces, `--paper` deep charcoal text, `--signal` emerald `#0e774c`, `--plate` cobalt `#1d4ed8`), and a dark ink theme via `prefers-color-scheme: dark` (`--ink` deep charcoal, `--paper` studio cream, `--signal` luminous emerald, `--plate` electric blue). Product artwork tiles always use a fixed dark studio panel (`--tile`), so light garments stay visible in both themes. The accent band (`.ticker`) uses `--signal`.
- **Type:** `Arial Black` for display, Helvetica or Arial for text. Both are system fonts, so nothing is downloaded. Swap `--display` and `--text` to use licensed (or self-hosted open-licensed) fonts — none are bundled yet.
- **Components:** `.btn`, `.card`, `.drawer`, `.field`, `.ticker`.

## Known gaps

- Orders and early-access reservations are handled manually on WhatsApp. There's no order database.
- Stock is set by hand in `products.js` (`soldOut`).
- Drop photos are not watermarked yet.
- Early-access photos can be captured from the screen. The name on the unlocked page and the buyer reference discourage sharing.
- The drop page reserves one item per click. Quantities are handled on WhatsApp.
- The bag is per device. It does not sync across devices.
- Product photography is still illustrated artwork.
