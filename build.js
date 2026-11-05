// ============================================================================
// EARLY-ACCESS DROPS (summary; see README.md for the full process)
//
// - Drop products are NOT in products.js. They are packed into src/drop-data/bundle.enc
//   (AES-256-GCM, key kept as a Pages secret). The build reads only the public
//   src/drop-teaser.json to show the teaser.
// - Buyers pay on WhatsApp. The owner issues a code with tools/issue-access.mjs.
// - The drop page asks the server (functions/api/drop/*) for the products.
//   The server returns them only with a valid, signed, unexpired cookie.
// - On drop day the teaser disappears automatically. To make products public,
//   add them to products.js and rebuild.
// ============================================================================

// Builds the B.S.S multipage storefront into dist/.
// Zero dependencies: run with `node build.js`.
const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const SRC = path.join(ROOT_DIR, "src");
const OUT = path.join(ROOT_DIR, "dist");
const ART = require(path.join(SRC, "js", "art.js"));
const { PRODUCTS, BY_ID } = require(path.join(SRC, "js", "products.js"));

const WA_NUMBER = "233206764888";
const WA_DISPLAY = "+233 20 676 4888";
const WA_LINK = "https://wa.me/" + WA_NUMBER;

/* ---------- Drop teaser (public: name, date, price only) ---------- */
// The full catalog is encrypted in src/drop-data/bundle.enc and opened only by the server.
const DROP_FILE = path.join(ROOT_DIR, "src", "drop-teaser.json");
const DROP = fs.existsSync(DROP_FILE)
  ? JSON.parse(fs.readFileSync(DROP_FILE, "utf8"))
  : null;

function dropIsUpcoming() {
  return !!DROP && Date.now() < Date.parse(DROP.date + "T00:00:00Z");
}

function cedi(n) {
  return "GHS " + Number(n).toLocaleString("en-GH");
}
function waText(text) {
  return WA_LINK + "?text=" + encodeURIComponent(text);
}

/* ---------- Shared chrome ---------- */
function header(root, active) {
  const link = (href, label, key) =>
    `<a href="${root}${href}" class="${active === key ? "on" : ""}">${label}</a>`;
  return `
<header class="top">
  <a href="${root}index.html" class="wordmark" aria-label="B.S.S home">B.S.S</a>
  <nav class="nav" aria-label="Main">
    ${link("shop.html", "Shop", "shop")}
    ${link("journal.html", "Journal", "journal")}
    ${link("about.html", "About", "about")}
    ${link("size-guide.html", "Size Guide", "size")}
    ${link("contact.html", "Contact", "contact")}
  </nav>
  <div class="top-right">
    <details class="mnav">
      <summary aria-label="Menu">Menu</summary>
      <div class="mnav-panel">
        <a href="${root}shop.html">Shop</a>
        <a href="${root}journal.html">Journal</a>
        <a href="${root}about.html">About</a>
        <a href="${root}size-guide.html">Size Guide</a>
        <a href="${root}delivery.html">Delivery</a>
        <a href="${root}returns.html">Returns</a>
        <a href="${root}faq.html">FAQ</a>
        <a href="${root}track.html">Track Order</a>
        <a href="${root}contact.html">Contact</a>
      </div>
    </details>
    <a href="${root}cart.html" class="bag-btn" data-open-bag data-bag-count>Bag</a>
  </div>
</header>`;
}

function drawer(root) {
  return `
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="bag" aria-label="Your bag">
  <header>
    <h3>Your bag</h3>
    <button data-close-bag aria-label="Close">✕</button>
  </header>
  <div class="items" id="bag-items"></div>
  <footer>
    <div class="total"><span>Subtotal</span><span id="bag-total">GHS 0</span></div>
    <p class="note">Delivery is confirmed with you on WhatsApp before you pay.</p>
    <a class="btn btn-primary" id="bag-checkout" href="${root}checkout.html">Checkout</a>
    <a class="btn btn-ghost" style="margin-top:10px" href="${root}cart.html">View full bag</a>
  </footer>
</aside>
<div class="toast" id="toast" role="status"></div>`;
}

function footer(root) {
  return `
<footer class="site-footer" id="contact-footer">
  <div class="wrap">
    <div class="footer-links">
      <div>
        <div class="wordmark" style="font-size:40px">B.S.S</div>
        <p class="muted" style="margin-top:14px;max-width:300px">Screen-printed heavyweight tees and hoodies. Made in small runs in Accra.</p>
      </div>
      <div>
        <h5>Shop</h5>
        <a href="${root}shop.html">All pieces</a>
        <a href="${root}shop.html?cat=tees">Tees</a>
        <a href="${root}shop.html?cat=hoodies">Hoodies</a>
        <a href="${root}size-guide.html">Size guide</a>
      </div>
      <div>
        <h5>Help</h5>
        <a href="${root}delivery.html">Delivery</a>
        <a href="${root}returns.html">Returns and exchanges</a>
        <a href="${root}faq.html">FAQ</a>
        <a href="${root}track.html">Track an order</a>
      </div>
      <div>
        <h5>Talk to us</h5>
        <a data-wa-link>WhatsApp ${WA_DISPLAY}</a>
        <a href="${root}contact.html">Contact</a>
        <a href="${root}about.html">About B.S.S</a>
        <a href="${root}privacy.html">Privacy</a>
        <a href="${root}terms.html">Terms</a>
      </div>
    </div>
    <div class="big-mark" aria-hidden="true">B.S.S</div>
    <p class="muted" style="font-size:13px;margin-top:24px">© ${new Date().getFullYear()} B.S.S. All rights reserved.</p>
  </div>
</footer>`;
}

const EXTRA_HEAD_CSS = `
<style>
.top-right { display: flex; align-items: center; gap: 12px; }
.nav a.on { opacity: 1; text-decoration: underline; text-underline-offset: 6px; }
.mnav { display: none; position: relative; }
.mnav summary { list-style: none; cursor: pointer; font-size: 13px; text-transform: uppercase; letter-spacing: .14em; border: 1px solid currentColor; padding: 9px 14px; border-radius: 999px; }
.mnav summary::-webkit-details-marker { display: none; }
.mnav-panel { position: absolute; right: 0; top: 52px; background: var(--ink-2); border: 1px solid var(--line); padding: 10px; min-width: 200px; display: flex; flex-direction: column; }
.mnav-panel a { padding: 12px 14px; font-size: 14px; }
.mnav-panel a:hover { color: var(--signal); }
.site-footer { padding: 90px 28px 40px; border-top: 1px solid var(--line); overflow: hidden; }
.site-footer h5 { font-size: 12px; letter-spacing: .24em; text-transform: uppercase; color: var(--paper-dim); margin-bottom: 14px; font-weight: 400; }
.site-footer .footer-links a { display: block; font-size: 15px; margin-bottom: 9px; opacity: .9; }
.site-footer .footer-links a:hover { color: var(--signal); }
.site-footer .big-mark { font-family: var(--display); font-size: clamp(90px, 22vw, 340px); line-height: .8; color: transparent; -webkit-text-stroke: 1px var(--line); margin-top: 60px; }
@media (max-width: 900px) { .mnav { display: block; } }
</style>`;

function layout({
  title,
  desc,
  root = "",
  active = "",
  body,
  bodyClass = "",
  script = "",
  noindex = false,
}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${noindex ? '<meta name="robots" content="noindex, nofollow">\n  ' : ""}<title>${title}</title>
  <meta name="description" content="${desc || "B.S.S screen-printed heavyweight tees and hoodies from Accra. Order on WhatsApp."}">
  <link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${root}styles.css">
  <link rel="stylesheet" href="${root}pages.css">
  ${EXTRA_HEAD_CSS}
  <script>window.BSS_ROOT = ${JSON.stringify(root)};</script>
</head>
<body class="${bodyClass}">
${header(root, active)}
${body}
${drawer(root)}
${footer(root)}
<script src="${root}js/art.js"></script>
<script src="${root}js/products.js"></script>
<script src="${root}js/shared.js"></script>
${script}
</body>
</html>`;
}

/* ---------- Components ---------- */
function productCard(p, root, order) {
  const c = p.colors[0];
  return `<a class="card reveal" href="${root}product/${p.slug}.html" data-product-card data-id="${p.id}" data-category="${p.category}" data-price="${p.price}" data-order="${order}">
    <div class="card-media">
      <div class="shirt">${ART.shirtSVG(c.shirt, { hoodie: p.hoodie, mark: p.mark })}</div>
      <span class="card-tag ${p.tagStyle}">${p.tag}</span>
    </div>
    <div class="card-meta">
      <span class="card-name">${p.name}</span>
      <span class="card-price">${cedi(p.price)}</span>
    </div>
    <div class="card-colors">${p.colors.map((col) => `<span class="swatch" title="${col.name}" style="background:${col.hex}"></span>`).join("")}</div>
  </a>`;
}

function formatMonthDay(isoDate) {
  try {
    const d = new Date(isoDate);
    if (!isNaN(d.getTime())) {
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`;
    }
  } catch (e) {}
  return isoDate;
}

function renderUpcomingDropTeasers(root) {
  if (!dropIsUpcoming()) return "";
  const msg = `Hi B.S.S, I want early access to the ${DROP.name}.`;
  return `
<div class="drop-teaser-wrap">
  <div class="drop-teaser card" style="border: 2px solid var(--signal); background: var(--ink-2); padding: 36px 32px; display: flex; flex-direction: column; gap: 14px;">
    <div class="crumbs-line" style="color:var(--signal);font-weight:600;letter-spacing:.2em;text-transform:uppercase;">Early Access</div>
    <h2 class="teaser-title" style="font-family:var(--display);font-size:clamp(26px,4vw,40px);line-height:1.1;text-transform:uppercase;">${DROP.name} — Dropping ${formatMonthDay(DROP.date)}</h2>
    <div class="teaser-price" style="font-size:16px;color:var(--paper-dim);">Early access fee: ${cedi(DROP.price)} (credited to your order)</div>
    <div class="teaser-actions" style="display:flex;align-items:center;gap:18px;margin-top:8px;flex-wrap:wrap;">
      <a class="btn btn-primary" href="${waText(msg)}" target="_blank" rel="noopener">Get early access</a>
      <a class="link-btn" href="${root}drop.html" style="font-size:14px;">Have a code? Unlock here →</a>
    </div>
  </div>
</div>`;
}

function pageHero(kicker, title, lead, extra = "") {
  return `<section class="page-hero">
    <div class="wrap">
      <div class="crumbs-line">${kicker}</div>
      <h1 class="h1">${title}</h1>
      ${lead ? `<p>${lead}</p>` : ""}
      ${extra}
    </div>
  </section>`;
}

/* ---------- Pages ---------- */
const pages = {};

pages["index.html"] = (root = "") => {
  const visible = PRODUCTS;
  const body = `
<section class="hero" style="padding:0">
  <img class="hero-img" src="${root}assets/hero.jpg" alt="A black heavyweight tee hanging in a dim print studio">
  <div class="reg" style="top:120px;right:60px"></div>
  <div class="hero-inner" style="padding:0 28px 64px">
    <div class="hero-kicker">Screen-printed in Accra</div>
    <h1 class="hero-title">Local <span class="outline">Soul,</span><br><span class="signal">Global</span> Vision</h1>
    <p class="hero-sub">Heavyweight tees and hoodies, printed one colour at a time. Order in minutes on WhatsApp.</p>
    <div class="hero-cta">
      <a href="${root}shop.html" class="btn btn-primary">Shop the drop</a>
      <a href="#order" class="btn btn-ghost">How to order</a>
    </div>
  </div>
</section>

<div class="ticker" aria-hidden="true">
  <div class="ticker-track">
    <span>B.S.S · Heavyweight · Screen-printed · Accra · Limited runs · B.S.S · Heavyweight · Screen-printed · Accra · Limited runs ·</span>
    <span>B.S.S · Heavyweight · Screen-printed · Accra · Limited runs · B.S.S · Heavyweight · Screen-printed · Accra · Limited runs ·</span>
  </div>
</div>

<section id="drop">
  <div class="drop-head reveal" style="display:flex;justify-content:space-between;align-items:end;gap:24px;flex-wrap:wrap;margin-bottom:64px">
    <div>
      <span class="label">Current release</span>
      <h2 class="h2">The Drop</h2>
    </div>
    <p class="muted" style="max-width:380px">Four pieces, one print direction. Once a size sells out, it's gone until the next run.</p>
  </div>
  <div class="grid">
    ${visible.map((p, i) => productCard(p, root, i)).join("")}
  </div>
  <div style="margin-top:48px"><a class="btn btn-ghost" href="${root}shop.html">See every piece</a></div>
</section>

<section class="manifesto">
  <span class="label" style="color:rgba(13,13,11,.6)">About B.S.S</span>
  <h2 class="h2">Every print is<br>made by <span>hand.</span></h2>
  <div class="facts">
    <div class="fact reveal"><strong>1</strong><span>Screen per colour. No shortcuts, no transfers.</span></div>
    <div class="fact reveal"><strong>Limited</strong><span>Small runs, so the piece you wear is not on every street.</span></div>
    <div class="fact reveal"><strong>Accra</strong><span>Designed, printed and delivered from the city we live in.</span></div>
  </div>
  <div style="margin-top:56px"><a class="btn btn-primary" href="${root}about.html">Our story</a></div>
</section>

<section id="process">
  <span class="label">How it's made</span>
  <h2 class="h2">From idea<br>to street</h2>
  <div class="steps">
    <div class="step reveal"><b>01</b><h4>Design</h4><p>Each graphic is drawn and separated into one layer per colour.</p></div>
    <div class="step reveal"><b>02</b><h4>Screen</h4><p>Every colour is burned onto its own screen, then aligned to the crosshair.</p></div>
    <div class="step reveal"><b>03</b><h4>Print</h4><p>Ink goes down by hand, one colour at a time, and cures into the cotton.</p></div>
    <div class="step reveal"><b>04</b><h4>Finish</h4><p>Checked piece by piece, folded, and packed for delivery.</p></div>
  </div>
</section>

<section id="order">
  <div class="order reveal">
    <div>
      <span class="label">Ordering</span>
      <div class="wa-big">Message us on WhatsApp</div>
      <p>Pick your pieces, then send your order. We confirm your total and delivery fee, then you pay by mobile money or bank transfer.</p>
      <p style="margin-top:22px"><a class="btn btn-primary" data-wa-link>Open WhatsApp</a></p>
    </div>
    <ul class="order-list">
      <li><span>1. Choose your piece and size</span></li>
      <li><span>2. Checkout and send the order on WhatsApp</span></li>
      <li><span>3. Confirm total and delivery</span></li>
      <li><span>4. Pay and wear it</span></li>
    </ul>
  </div>
</section>`;
  return layout({
    title: "B.S.S · Wear the Print",
    root,
    active: "home",
    body,
  });
};

pages["shop.html"] = (root = "") => {
  const visible = PRODUCTS;
  const teaser = renderUpcomingDropTeasers(root);
  const body = `
${pageHero("The Drop · " + visible.length + " pieces", "Shop", "Every piece is screen-printed to order from a limited run. Filter by type or sort by price.")}
${teaser}
<div class="toolbar">
  <div class="chips" role="group" aria-label="Filter">
    <button class="chip on" data-filter="all">All</button>
    <button class="chip" data-filter="tees">Tees</button>
    <button class="chip" data-filter="hoodies">Hoodies</button>
  </div>
  <div style="display:flex;gap:16px;align-items:center">
    <span class="count" id="shop-count"></span>
    <select class="select" id="shop-sort" aria-label="Sort">
      <option value="new">Newest</option>
      <option value="price-asc">Price: low to high</option>
      <option value="price-desc">Price: high to low</option>
    </select>
  </div>
</div>
<div class="shop-grid" id="shop-grid">
  ${visible.map((p, i) => productCard(p, root, i)).join("")}
</div>`;
  return layout({ title: "Shop · B.S.S", root, active: "shop", body });
};

function productPage(p) {
  return (root = "../") => {
    const c = p.colors[0];
    const others = PRODUCTS.filter(
      (x) => x.id !== p.id,
    ).slice(0, 3);
    const body = `
<main class="pdp" data-product-page="${p.id}">
  <div class="pdp-gallery"><div id="pdp-art">${ART.shirtSVG(c.shirt, { hoodie: p.hoodie, mark: p.mark, print: c.print })}</div></div>
  <div class="pdp-info">
    <div class="crumbs"><a href="${root}index.html">Home</a> / <a href="${root}shop.html">Shop</a> / ${p.name}</div>
    <h1 class="pdp-name">${p.name}</h1>
    <div class="pdp-price">${cedi(p.price)}</div>
    <p class="pdp-desc">${p.desc}</p>

    <div>
      <span class="opt-label">Colour · <span id="pdp-color-name">${c.name}</span></span>
      <div class="colors">${p.colors.map((col) => `<button class="color-btn" data-name="${col.name}" title="${col.name}" aria-label="${col.name}" style="background:${col.hex}"></button>`).join("")}</div>
    </div>

    <div>
      <span class="opt-label">Size · <a href="${root}size-guide.html" style="text-decoration:underline">Size guide</a></span>
      <div class="sizes">${p.sizes.map((s) => `<button class="size" data-size="${s}" ${p.soldOut.includes(s) ? "disabled" : ""}>${s}</button>`).join("")}</div>
      <p class="delivery-note" style="margin-top:12px">Not sure about your size? <a data-wa-text="Hello B.S.S, I need help choosing a size for the ${p.name}." style="text-decoration:underline">Ask us on WhatsApp</a>.</p>
    </div>

    <div style="display:flex;align-items:center;gap:14px">
      <span class="opt-label" style="margin:0">Quantity</span>
      <div class="qty" style="margin:0">
        <button id="pdp-minus" aria-label="Less">−</button>
        <span id="pdp-qty">1</span>
        <button id="pdp-plus" aria-label="More">+</button>
      </div>
      <span id="pdp-line-total" style="margin-left:auto;font-family:var(--display)"></span>
    </div>

    <div class="pdp-buttons">
      <button id="pdp-add" class="btn btn-primary" disabled><span id="pdp-add-label">Choose a size</span></button>
      <button id="pdp-wa" class="btn btn-ghost">Order this on WhatsApp</button>
    </div>

    <div class="pdp-meta"><span>Screen-printed</span><span>Heavyweight cotton</span><span>Accra</span></div>

    <div class="details">
      <details open><summary>Details</summary><ul>${p.details.map((d) => `<li>${d}</li>`).join("")}</ul></details>
      <details><summary>Delivery</summary><p>Accra delivery is confirmed on WhatsApp with the exact fee before you pay. <a href="${root}delivery.html" style="text-decoration:underline">Read more</a>.</p></details>
      <details><summary>Returns</summary><p>Unworn items can be exchanged for another size within 7 days. <a href="${root}returns.html" style="text-decoration:underline">Read the policy</a>.</p></details>
      <details><summary>Care</summary><p>Wash cold, inside out. Hang to dry. Iron on low, avoiding the print.</p></details>
    </div>
  </div>
</main>

<section class="reco">
  <div class="section-head" style="margin-bottom:40px"><h2 class="h3">You may also like</h2><a class="btn btn-ghost" href="${root}shop.html">Full shop</a></div>
  <div class="grid">${others.map((x, i) => productCard(x, root, i)).join("")}</div>
</section>`;
    return layout({
      title: `${p.name} · B.S.S`,
      desc: p.desc,
      root,
      active: "shop",
      body,
    });
  };
}

pages["cart.html"] = (root = "") => {
  const body = `
<main class="cart-layout">
  <div>
    <div class="crumbs-line" style="margin-bottom:16px"><a href="${root}shop.html">Continue shopping</a></div>
    <h1 class="h1" style="font-family:var(--display);font-size:clamp(48px,7vw,100px);line-height:.9;text-transform:uppercase">Your bag</h1>
    <p id="cart-count" class="muted" style="margin:14px 0 30px"></p>
    <div id="cart-lines"></div>
  </div>
  <aside class="summary-box" id="cart-summary">
    <h3>Summary</h3>
    <div class="sum-row"><span>Subtotal</span><span id="cart-subtotal">GHS 0</span></div>
    <div class="sum-row"><span>Delivery</span><span>Confirmed on WhatsApp</span></div>
    <div class="sum-row total"><span>Total</span><span id="cart-subtotal2"></span></div>
    <a class="btn btn-primary" id="cart-checkout" href="${root}checkout.html">Checkout</a>
    <p class="note">You won't be charged yet. We confirm your total and delivery fee on WhatsApp first.</p>
  </aside>
</main>`;
  return layout({ title: "Your bag · B.S.S", root, body, script: "" });
};

pages["checkout.html"] = (root = "") => {
  const body = `
<main class="checkout-layout">
  <div>
    <div class="crumbs-line" style="margin-bottom:16px"><a href="${root}cart.html">Back to bag</a></div>
    <div class="checkout-form-head">
      <h1 style="font-family:var(--display);font-size:clamp(48px,7vw,100px);line-height:.9;text-transform:uppercase">Checkout</h1>
      <p class="muted" style="margin-top:14px;max-width:520px">Tell us where to bring your pieces. We'll open WhatsApp with your order ready to send, and confirm the delivery fee with you there.</p>
    </div>
    <form class="form" id="checkout-form" novalidate>
      <div class="form-row">
        <div class="field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" required><span class="err">Please enter your name.</span></div>
        <div class="field"><label for="phone">WhatsApp number</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="024 000 0000" required><span class="err">Enter a valid phone number.</span></div>
      </div>
      <div class="field">
        <label for="area">Delivery area</label>
        <select id="area" name="area" required>
          <option value="">Choose your area</option>
          <option>Accra Central</option>
          <option>East Legon</option>
          <option>Airport Residential</option>
          <option>Cantonments</option>
          <option>Labone</option>
          <option>Osu</option>
          <option>Spintex</option>
          <option>Tema</option>
          <option>Kasoa</option>
          <option>Other Accra area</option>
          <option>Outside Accra</option>
        </select>
        <span class="err">Choose a delivery area.</span>
      </div>
      <div class="field">
        <label for="address">Address or landmark</label>
        <textarea id="address" name="address" required placeholder="House number, street, and a landmark we'll recognise. A Ghana Digital Address works too."></textarea>
        <span class="err">Add a delivery address or landmark.</span>
      </div>
      <div class="field">
        <label>Preferred payment</label>
        <div class="radios">
          <label><input type="radio" name="payment" value="Mobile money" checked> Mobile money<small>We send the number on WhatsApp</small></label>
          <label><input type="radio" name="payment" value="Bank transfer"> Bank transfer<small>We send the account details on WhatsApp</small></label>
        </div>
      </div>
      <div class="field">
        <label for="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" placeholder="Sizes, gifts, delivery time, anything else"></textarea>
      </div>
      <div><button class="btn btn-primary" type="submit">Send order on WhatsApp</button></div>
      <p class="muted" style="font-size:13px">By sending your order you agree to our <a href="${root}terms.html" style="text-decoration:underline">terms</a> and <a href="${root}privacy.html" style="text-decoration:underline">privacy notice</a>.</p>
    </form>
  </div>
  <aside class="summary-box">
    <h3>Your order</h3>
    <div id="checkout-summary"></div>
  </aside>
</main>`;
  return layout({ title: "Checkout · B.S.S", root, body });
};

pages["order-sent.html"] = (root = "") => {
  const body = `
<main class="center-page">
  <div class="box">
    <div class="crumbs-line">Order ready</div>
    <h1>Almost<br>there.</h1>
    <p class="lead">Your order opened in WhatsApp. Press send to reach us, and we'll reply with your total, delivery fee and payment details.</p>
    <div class="preview" id="sent-preview">Your order message will show here.</div>
    <div class="row-btns">
      <a class="btn btn-primary" id="reopen-wa" target="_blank" rel="noopener">Open WhatsApp again</a>
      <a class="btn btn-ghost" href="${root}shop.html">Keep shopping</a>
    </div>
  </div>
</main>`;
  return layout({
    title: "Order sent · B.S.S",
    root,
    body,
    desc: "Your B.S.S order is ready to send on WhatsApp.",
  });
};

pages["track.html"] = (root = "") => {
  const body = `
${pageHero("Orders", "Track your order", "Send us your order number and we'll reply on WhatsApp with where your pieces are.")}
<main class="section-tight">
  <div class="wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start">
    <form class="form" id="track-form" style="max-width:520px">
      <div class="field"><label for="order">Order number</label><input id="order" name="order" placeholder="As shown in your WhatsApp chat" required><span class="err">Enter your order number.</span></div>
      <div><button class="btn btn-primary" type="submit">Ask on WhatsApp</button></div>
    </form>
    <div class="prose">
      <h2 class="h3">No order number?</h2>
      <p class="muted" style="margin-top:14px">Your order number is in the confirmation we send you on WhatsApp. If you can't find it, message us with your name and the phone number you ordered with.</p>
      <p class="muted"><a class="btn btn-ghost" data-wa-link style="margin-top:14px">Message us</a></p>
    </div>
  </div>
</main>`;
  return layout({ title: "Track your order · B.S.S", root, body, active: "" });
};

pages["about.html"] = (root = "") => {
  const body = `
${pageHero("About B.S.S", "Made by hand, in Accra", "B.S.S is a small screen-printing label. We print the designs ourselves, one colour at a time, and sell them in limited runs.")}
<section class="section-tight">
  <div class="wrap prose" style="max-width:760px">
    <h2 class="h3" style="margin-bottom:18px">Why we print by hand</h2>
    <p>A screen print takes longer than a transfer and costs more. It also lasts longer. The ink sits in the cotton instead of on top of it, so the print softens with wear rather than cracking.</p>
    <p>We would rather make fewer pieces well than many pieces quickly. That's why most designs come in limited runs. When a screen is retired, the print is gone.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:0">
  <div class="wrap values">
    <div class="reveal"><h3>Heavy cotton</h3><p>Weights that hold their shape, so each piece looks right after months of wear.</p></div>
    <div class="reveal"><h3>One colour at a time</h3><p>Each colour gets its own screen, aligned by hand to the crosshair.</p></div>
    <div class="reveal"><h3>Small runs</h3><p>Limited quantities keep the designs rare and the quality consistent.</p></div>
  </div>
</section>
<section class="section-tight" style="text-align:left">
  <div class="wrap"><a class="btn btn-primary" href="${root}shop.html">Shop the drop</a></div>
</section>`;
  return layout({ title: "About · B.S.S", root, active: "about", body });
};

pages["contact.html"] = (root = "") => {
  const body = `
${pageHero("Contact", "Say hello", "The fastest way to reach us is WhatsApp. We reply to sizing, delivery and order questions there.")}
<section class="section-tight">
  <div class="wrap contact-grid">
    <div class="contact-card">
      <h3>WhatsApp</h3>
      <div class="big">${WA_DISPLAY}</div>
      <p>Sizing, delivery, orders and anything else. Message us and we'll reply.</p>
      <div><a class="btn btn-primary" data-wa-link>Open WhatsApp</a></div>
    </div>
    <div class="contact-card">
      <h3>Find us</h3>
      <p>We're based in Accra. Pickup is available by arrangement. Message us to set a time.</p>
      <div><a class="btn btn-ghost" data-wa-text="Hello B.S.S, I'd like to arrange pickup.">Arrange pickup</a></div>
    </div>
  </div>
</section>
<section class="section-tight" style="padding-top:0">
  <div class="wrap faq-group">
    <h2 class="h3" style="margin-bottom:18px">Common questions</h2>
    <div class="faq">
      <details><summary>How do I order?</summary><p>Add pieces to your bag, then checkout. Your order opens in WhatsApp, ready to send. We confirm the total and delivery fee before you pay.</p></details>
      <details><summary>Can I pick up my order?</summary><p>Yes, by arrangement. Message us on WhatsApp to set a time.</p></details>
      <details><summary>Do you deliver outside Accra?</summary><p>Message us with your area on WhatsApp and we'll confirm whether we can deliver there and the fee.</p></details>
    </div>
  </div>
</section>`;
  return layout({ title: "Contact · B.S.S", root, active: "contact", body });
};

pages["size-guide.html"] = (root = "") => {
  const body = `
${pageHero("Size guide", "Find your fit", "Our pieces are cut to a relaxed, heavyweight fit. If you're between sizes, go up for a looser fit.")}
<section class="section-tight">
  <div class="wrap" style="display:grid;gap:56px">
    <div>
      <h2 class="h3" style="margin-bottom:18px">Tees</h2>
      <div class="table-wrap"><table class="size-table">
        <thead><tr><th>Size</th><th>Chest (cm)</th><th>Length (cm)</th><th>Shoulder (cm)</th></tr></thead>
        <tbody>
          <tr><td>S</td><td>96</td><td>70</td><td>46</td></tr>
          <tr><td>M</td><td>102</td><td>72</td><td>48</td></tr>
          <tr><td>L</td><td>108</td><td>74</td><td>50</td></tr>
          <tr><td>XL</td><td>114</td><td>76</td><td>52</td></tr>
          <tr><td>XXL</td><td>120</td><td>78</td><td>54</td></tr>
        </tbody>
      </table></div>
    </div>
    <div>
      <h2 class="h3" style="margin-bottom:18px">Hoodies</h2>
      <div class="table-wrap"><table class="size-table">
        <thead><tr><th>Size</th><th>Chest (cm)</th><th>Length (cm)</th><th>Shoulder (cm)</th></tr></thead>
        <tbody>
          <tr><td>S</td><td>108</td><td>68</td><td>54</td></tr>
          <tr><td>M</td><td>114</td><td>70</td><td>56</td></tr>
          <tr><td>L</td><td>120</td><td>72</td><td>58</td></tr>
          <tr><td>XL</td><td>126</td><td>74</td><td>60</td></tr>
          <tr><td>XXL</td><td>132</td><td>76</td><td>62</td></tr>
        </tbody>
      </table></div>
    </div>
    <div class="prose">
      <h2 class="h3" style="margin-bottom:14px">How to measure</h2>
      <p><strong>Chest:</strong> measure around the fullest part of your chest, under the arms, with the tape level.</p>
      <p><strong>Length:</strong> measure from the highest point of the shoulder down to the hem.</p>
      <p><strong>Shoulder:</strong> measure straight across the back, from shoulder point to shoulder point.</p>
      <p class="muted" style="font-size:14px">Measurements are taken with the garment laid flat. Allow a few centimetres of variation between pieces.</p>
    </div>
  </div>
</section>`;
  return layout({ title: "Size guide · B.S.S", root, active: "size", body });
};

pages["delivery.html"] = (root = "") => {
  const body = `
${pageHero("Help", "Delivery", "Delivery is confirmed with you on WhatsApp before you pay, so you always know the exact cost.")}
<section class="section-tight"><div class="wrap prose">
  <h2>Accra</h2>
  <p>We deliver across Accra. Tell us your area and landmark when you order, and we'll confirm the delivery fee and timing on WhatsApp.</p>
  <h2>Outside Accra</h2>
  <p>Message us with your location and we'll confirm whether we deliver there, the fee, and how long it takes.</p>
  <h2>Pickup</h2>
  <p>Pickup is available by arrangement. Message us on WhatsApp to set a time.</p>
  <h2>Payment</h2>
  <p>We accept mobile money and bank transfer. We send the payment details on WhatsApp once your order is confirmed. Your pieces are packed once payment is received.</p>
  <h2>Tracking</h2>
  <p>We keep you updated on WhatsApp from packing through to delivery. <a href="${root}track.html">Ask about your order</a> with your order number.</p>
</div></section>`;
  return layout({ title: "Delivery · B.S.S", root, body });
};

pages["returns.html"] = (root = "") => {
  const body = `
${pageHero("Help", "Returns and exchanges", "We want you to love what you wear. If something isn't right, we'll make it right.")}
<section class="section-tight"><div class="wrap prose">
  <h2>Exchanges</h2>
  <p>Unworn items can be exchanged for another size within 7 days of delivery. The piece must have its tags and be in its original condition.</p>
  <h2>Faulty pieces</h2>
  <p>If a piece arrives damaged or the print is faulty, message us on WhatsApp with a photo within 48 hours of delivery. We'll replace it or refund it.</p>
  <h2>How to start a return</h2>
  <p>Message us on WhatsApp with your order number, the piece, and the size you'd like instead. We'll confirm the next steps.</p>
  <h2>Limited runs</h2>
  <p>When a size sells out in a limited run, an exchange may not be possible for that size. We'll tell you before you confirm.</p>
  <p><a class="btn btn-primary" data-wa-text="Hello B.S.S, I'd like to start an exchange.">Start an exchange on WhatsApp</a></p>
</div></section>`;
  return layout({ title: "Returns · B.S.S", root, body });
};

pages["faq.html"] = (root = "") => {
  const body = `
${pageHero("Help", "FAQ", "The questions we get most often.")}
<section class="section-tight"><div class="wrap">
  <div class="faq-group">
    <h2>Ordering</h2>
    <div class="faq">
      <details><summary>How do I order?</summary><p>Choose your piece, colour and size, then checkout. Your order opens in WhatsApp, ready to send. We reply with your total and delivery fee.</p></details>
      <details><summary>Can I order without the website?</summary><p>Yes. Message us on WhatsApp with the piece, colour, size and your delivery details.</p></details>
      <details><summary>Can I change my order?</summary><p>Yes, if it hasn't been packed yet. Message us on WhatsApp as soon as you can.</p></details>
    </div>
  </div>
  <div class="faq-group">
    <h2>Sizing and product</h2>
    <div class="faq">
      <details><summary>How do I choose my size?</summary><p>Check the <a href="${root}size-guide.html" style="text-decoration:underline">size guide</a>. If you're between sizes, go up for a looser fit, or message us for help.</p></details>
      <details><summary>How do you print the designs?</summary><p>Each colour is screen-printed by hand. The ink sits in the cotton rather than on top of it, so the print softens with wear rather than cracking.</p></details>
      <details><summary>How do I care for my piece?</summary><p>Wash cold, inside out. Hang to dry. Iron on low, avoiding the print.</p></details>
    </div>
  </div>
  <div class="faq-group">
    <h2>Delivery and payment</h2>
    <div class="faq">
      <details><summary>How much is delivery?</summary><p>We confirm the fee with you on WhatsApp once we know your area, before you pay.</p></details>
      <details><summary>How do I pay?</summary><p>By mobile money or bank transfer. We send the details on WhatsApp.</p></details>
      <details><summary>Can I pick up my order?</summary><p>Yes, by arrangement. Message us on WhatsApp.</p></details>
    </div>
  </div>
</div></section>`;
  return layout({ title: "FAQ · B.S.S", root, body });
};

pages["journal.html"] = (root = "") => {
  const body = `
${pageHero("Journal", "Notes from the screen", "Process, care and the stories behind the prints.")}
<section class="section-tight"><div class="wrap journal-grid">
  <a class="journal-card reveal" href="${root}journal/how-screen-printing-works.html">
    <div><div class="meta">Process</div><h3 style="margin-top:14px">How a screen print is made</h3></div>
    <p>Why each colour gets its own screen, and why the ink lasts longer than a transfer.</p>
  </a>
  <a class="journal-card reveal" href="${root}journal/caring-for-heavy-cotton.html">
    <div><div class="meta">Care</div><h3 style="margin-top:14px">Caring for heavy cotton</h3></div>
    <p>How to wash, dry and store your tees so the print and the fabric last.</p>
  </a>
</div></section>`;
  return layout({ title: "Journal · B.S.S", root, active: "journal", body });
};

pages["journal/how-screen-printing-works.html"] = (root = "../") => {
  const body = `
<article class="article">
  <div class="crumbs-line"><a href="${root}journal.html">Journal</a> / Process</div>
  <h1>How a screen print is made</h1>
  <p class="lead">A B.S.S print starts as a drawing and ends as a colour that sits inside the cotton. Here is what happens in between.</p>
  <p>Every colour in a design is separated onto its own layer. Each layer is burned onto a fine mesh screen, so the ink can only pass through the open parts of the design.</p>
  <h2>One colour at a time</h2>
  <p>The shirt is placed under the first screen and aligned to the crosshair marks. Ink is pulled across the screen, and then the next colour follows. Each one has to line up exactly with the one before it.</p>
  <div class="pull">The print is only as good as the <span>alignment.</span></div>
  <h2>Why it lasts</h2>
  <p>A screen print sits in the fibres rather than on top of them. The ink flexes with the cotton, so it softens with wear instead of cracking.</p>
  <p><a href="${root}shop.html" style="text-decoration:underline">See the current pieces</a></p>
</article>`;
  return layout({
    title: "How a screen print is made · B.S.S",
    root,
    active: "journal",
    body,
  });
};

pages["journal/caring-for-heavy-cotton.html"] = (root = "../") => {
  const body = `
<article class="article">
  <div class="crumbs-line"><a href="${root}journal.html">Journal</a> / Care</div>
  <h1>Caring for heavy cotton</h1>
  <p class="lead">Heavyweight cotton is built to last. A few simple habits keep it looking new.</p>
  <h2>Wash</h2>
  <p>Wash cold, inside out, on a gentle cycle. Hot water and harsh detergents fade colour and wear the print.</p>
  <h2>Dry</h2>
  <p>Hang to dry in the shade. Avoid direct sun and tumble drying, which can shrink the fabric and crack the print.</p>
  <h2>Iron</h2>
  <p>Iron on low, inside out. If you iron the print side, cover it with a cloth first.</p>
  <h2>Store</h2>
  <p>Fold rather than hang heavy pieces, so the shoulders keep their shape.</p>
</article>`;
  return layout({
    title: "Caring for heavy cotton · B.S.S",
    root,
    active: "journal",
    body,
  });
};

pages["privacy.html"] = (root = "") => {
  const body = `
${pageHero("Legal", "Privacy", "How we handle the information you give us when you order.")}
<section class="section-tight"><div class="wrap prose">
  <p>We collect only what we need to fulfil your order: your name, WhatsApp number, delivery area and address. You share these with us when you checkout and on WhatsApp.</p>
  <h2>What we use it for</h2>
  <p>To confirm your order, arrange payment and delivery, and reply to your messages. We don't sell your information.</p>
  <h2>Your choices</h2>
  <p>You can ask us to see, correct or delete your information at any time by messaging us on WhatsApp.</p>
  <h2>Cookies</h2>
  <p>We store your bag in your browser so it's still there when you come back. We don't use advertising cookies on this site.</p>
  <p class="legal-date">Last updated: this version is a draft pending legal review.</p>
</div></section>`;
  return layout({ title: "Privacy · B.S.S", root, body });
};

pages["terms.html"] = (root = "") => {
  const body = `
${pageHero("Legal", "Terms", "The basics of buying from B.S.S.")}
<section class="section-tight"><div class="wrap prose">
  <h2>Orders</h2>
  <p>An order is confirmed when we reply on WhatsApp with your total and delivery fee and you confirm. Prices are in Ghana cedis.</p>
  <h2>Stock</h2>
  <p>Limited runs sell out. If a piece you ordered is no longer available, we'll tell you on WhatsApp and offer an alternative or a refund.</p>
  <h2>Returns</h2>
  <p>See our <a href="${root}returns.html">returns and exchanges</a> policy.</p>
  <h2>Prints and colours</h2>
  <p>Screen printing is made by hand. Small variations in colour and placement are part of the craft and are not defects.</p>
  <p class="legal-date">Draft pending legal review.</p>
</div></section>`;
  return layout({ title: "Terms · B.S.S", root, body });
};

pages["404.html"] = (root = "") => {
  const body = `
<main class="center-page">
  <div class="box">
    <div class="crumbs-line">Error 404</div>
    <h1>Off the<br>registration.</h1>
    <p class="lead">This page doesn't exist, or it has moved. Head back to the drop.</p>
    <div class="row-btns" style="margin-top:28px">
      <a class="btn btn-primary" href="${root}index.html">Home</a>
      <a class="btn btn-ghost" href="${root}shop.html">Shop</a>
    </div>
  </div>
</main>`;
  return layout({ title: "Page not found · B.S.S", root, body });
};

pages["drop.html"] = (root = "") => {
  const body = `
${pageHero("Early access", DROP ? DROP.name : "Early access", "Paid buyers with an access code can see and reserve the collection here before it goes public.")}
<section class="section-tight" id="drop-gate">
  <div class="wrap" style="max-width:560px">
    <h2 class="h3" style="margin-bottom:12px">Enter your access code</h2>
    <p class="muted" style="margin-bottom:28px">Your code arrived on WhatsApp after your early-access payment. It starts with BSS.</p>
    <form class="form" id="drop-form" novalidate>
      <div class="field">
        <label for="drop-code">Access code</label>
        <input id="drop-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="BSS-0000-XXXX-XXXX-XXXX-XXXX">
        <span class="err">That code isn't valid. Check it and try again.</span>
      </div>
      <div><button class="btn btn-primary" type="submit" id="drop-submit">Unlock early access</button></div>
    </form>
    <p class="muted" style="font-size:13px;margin-top:22px">Haven't paid yet? <a data-wa-text="Hi B.S.S, I'd like early access to the ${DROP ? DROP.name : "next drop"}." style="text-decoration:underline">Message us on WhatsApp</a>.</p>
  </div>
</section>
<section class="section-tight" id="drop-content" hidden>
  <div class="wrap">
    <div class="section-head">
      <div>
        <span class="label">Early access · your ref <span id="drop-ref"></span></span>
        <h2 class="h2">Reserve before the drop</h2>
      </div>
      <p class="muted" id="drop-date-note"></p>
    </div>
    <div class="grid" id="drop-grid"></div>
  </div>
</section>
<section class="section-tight" id="drop-closed" hidden>
  <div class="wrap prose">
    <h2 class="h3" style="margin-bottom:14px">Early access has ended</h2>
    <p class="muted">The collection is now open to everyone.</p>
    <p style="margin-top:22px"><a class="btn btn-primary" id="drop-closed-link" href="shop.html">Shop the collection</a></p>
  </div>
</section>
<section class="section-tight" id="drop-unavailable" hidden>
  <div class="wrap prose">
    <h2 class="h3" style="margin-bottom:14px">Not open yet</h2>
    <p class="muted">Early access isn't available right now. Check back soon, or message us on WhatsApp.</p>
  </div>
</section>`;
  return layout({
    title: "Early access · B.S.S",
    desc: "Early access for B.S.S buyers.",
    root,
    body,
    noindex: true,
    script: `<script src="${root}js/drop.js"></script>`,
  });
};

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name),
      d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Top-level pages
for (const [rel, render] of Object.entries(pages)) {
  if (rel.includes("/")) continue;
  write(rel, render(""));
}
// Sub-folder pages
for (const [rel, render] of Object.entries(pages)) {
  if (!rel.includes("/")) continue;
  write(rel, render("../"));
}
// Product pages (only for public products)
const publicProducts = PRODUCTS;
for (const p of publicProducts)
  write(`product/${p.slug}.html`, productPage(p)("../"));

// Assets and scripts
copyDir(path.join(ROOT_DIR, "assets"), path.join(OUT, "assets"));
fs.copyFileSync(path.join(SRC, "styles.css"), path.join(OUT, "styles.css"));
if (fs.existsSync(path.join(SRC, "drop-data"))) copyDir(path.join(SRC, "drop-data"), path.join(OUT, "drop-data"));
fs.copyFileSync(path.join(SRC, "pages.css"), path.join(OUT, "pages.css"));
copyDir(path.join(SRC, "js"), path.join(OUT, "js"));

// Write public products only to dist/js/products.js so no plaintext premium data leaks
const clientProductsJS = `// B.S.S catalog (generated). Public products only.
(function (root) {
  const PRODUCTS = ${JSON.stringify(publicProducts, null, 2)};
  const API = {
    PRODUCTS: PRODUCTS,
    BY_ID: Object.fromEntries(PRODUCTS.map(function (p) { return [p.id, p]; }))
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.BSS_PRODUCTS = API;
})(typeof window !== "undefined" ? window : globalThis);
`;
fs.writeFileSync(path.join(OUT, "js", "products.js"), clientProductsJS);

console.log(
  "Built",
  Object.keys(pages).length + publicProducts.length,
  "page templates into dist/",
);
