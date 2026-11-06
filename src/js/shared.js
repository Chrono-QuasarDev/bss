// B.S.S storefront behaviour: bag, product options, shop filters, cart, checkout, WhatsApp handoff.
// Customer-facing only.

function getWindowStore() {
  try {
    if (typeof window !== "undefined" && window.name) {
      var parsed = JSON.parse(window.name);
      if (parsed && typeof parsed === "object" && parsed._bss) return parsed._bss;
    }
  } catch (e) {}
  return {};
}

function setWindowStore(store) {
  try {
    if (typeof window === "undefined") return;
    var rootObj = {};
    try {
      var existing = JSON.parse(window.name);
      if (existing && typeof existing === "object") rootObj = existing;
    } catch (e) {}
    rootObj._bss = store;
    window.name = JSON.stringify(rootObj);
  } catch (e) {}
}

function storageGet(key, defaultVal) {
  var localVal = null, hasLocal = false, localTs = -1;
  var winVal = null, hasWin = false, winTs = -1;

  try {
    if (typeof localStorage !== "undefined") {
      var raw = localStorage.getItem(key);
      if (raw !== null) {
        hasLocal = true;
        try { localVal = JSON.parse(raw); } catch (e) { localVal = raw; }
        var rawTs = localStorage.getItem(key + "_ts");
        localTs = rawTs ? parseInt(rawTs, 10) : 0;
      }
    }
  } catch (e) {}

  try {
    var wStore = getWindowStore();
    if (wStore && Object.prototype.hasOwnProperty.call(wStore, key)) {
      hasWin = true;
      winVal = wStore[key];
      winTs = typeof wStore[key + "_ts"] === "number" ? wStore[key + "_ts"] : 0;
    }
  } catch (e) {}

  if (hasLocal && hasWin) {
    if (localTs >= winTs) {
      var w1 = getWindowStore();
      w1[key] = localVal;
      w1[key + "_ts"] = localTs;
      setWindowStore(w1);
      return localVal;
    } else {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(key, JSON.stringify(winVal));
          localStorage.setItem(key + "_ts", String(winTs));
        }
      } catch (e) {}
      return winVal;
    }
  } else if (hasLocal) {
    var w2 = getWindowStore();
    w2[key] = localVal;
    w2[key + "_ts"] = localTs >= 0 ? localTs : Date.now();
    setWindowStore(w2);
    return localVal;
  } else if (hasWin) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, JSON.stringify(winVal));
        localStorage.setItem(key + "_ts", String(winTs >= 0 ? winTs : Date.now()));
      }
    } catch (e) {}
    return winVal;
  }

  return defaultVal;
}

function storageSet(key, val) {
  var now = Date.now();
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(val));
      localStorage.setItem(key + "_ts", String(now));
    }
  } catch (e) {}
  try {
    var w = getWindowStore();
    w[key] = val;
    w[key + "_ts"] = now;
    setWindowStore(w);
  } catch (e) {}
}

(function (root) {
  var PRODUCTS = (root.BSS_PRODUCTS && root.BSS_PRODUCTS.PRODUCTS) || (typeof window !== "undefined" && window.BSS_PRODUCTS ? window.BSS_PRODUCTS.PRODUCTS : []);
  var BY_ID = (root.BSS_PRODUCTS && root.BSS_PRODUCTS.BY_ID) || (typeof window !== "undefined" && window.BSS_PRODUCTS ? window.BSS_PRODUCTS.BY_ID : {});
  var ART = root.BSS_ART || (typeof window !== "undefined" ? window.BSS_ART : null);
  if (!PRODUCTS.length && typeof require !== "undefined") {
    try {
      var prodMod = require("./products.js");
      PRODUCTS = prodMod.PRODUCTS || [];
      BY_ID = prodMod.BY_ID || {};
    } catch(e) {}
  }

  var WA_NUMBER = "233206764888";
  var WA_DISPLAY = "+233 20 676 4888";
  var BAG_KEY = "bss-bag";
  var LAST_ORDER_KEY = "bss-last-order";

  function ROOT() { return window.BSS_ROOT || ""; }
  function cedi(n) { return "GHS " + Number(n).toLocaleString("en-GH"); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function waUrl(text) { return "https://wa.me/" + WA_NUMBER + (text ? "?text=" + encodeURIComponent(text) : ""); }

  /* ---------- Bag storage ---------- */
  function readBag() {
    try {
      var val = storageGet(BAG_KEY, []);
      return Array.isArray(val) ? val : [];
    } catch (e) {
      return [];
    }
  }
  function writeBag(items) {
    storageSet(BAG_KEY, items);
    renderBag();
  }
  function addToBag(line) {
    var bag = readBag();
    var found = bag.find(function (i) { return i.id === line.id && i.size === line.size && i.color === line.color; });
    if (found) found.qty += line.qty; else bag.push(line);
    writeBag(bag);
    openBag();
    toast("Added to bag");
  }
  function changeQty(index, delta) {
    var bag = readBag();
    bag[index].qty += delta;
    if (bag[index].qty < 1) bag.splice(index, 1);
    writeBag(bag);
  }
  function removeLine(index) {
    var bag = readBag();
    bag.splice(index, 1);
    writeBag(bag);
  }
  function bagTotal(bag) {
    return bag.reduce(function (s, i) { return s + BY_ID[i.id].price * i.qty; }, 0);
  }
  function colourFor(p, name) {
    return p.colors.find(function (c) { return c.name === name; }) || p.colors[0];
  }

  /* ---------- Drawer and toast ---------- */
  function openBag() {
    var d = $("#bag"), s = $("#scrim");
    if (d) d.classList.add("open");
    if (s) s.classList.add("open");
    renderBag();
  }
  function closeBag() {
    var d = $("#bag"), s = $("#scrim");
    if (d) d.classList.remove("open");
    if (s) s.classList.remove("open");
  }
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------- Bag rendering (drawer + cart page) ---------- */
  function lineHTML(item, i, compact) {
    var p = BY_ID[item.id];
    var c = colourFor(p, item.color);
    return '<div class="line">' +
      '<div class="thumb">' + ART.shirtSVG(c.shirt, { hoodie: p.hoodie, mark: p.mark }) + '</div>' +
      '<div>' +
        '<h4><a href="' + ROOT() + 'product/' + p.slug + '.html">' + p.name + '</a></h4>' +
        '<small>' + item.color + ' · Size ' + item.size + ' · ' + cedi(p.price) + '</small>' +
        '<div class="qty">' +
          '<button aria-label="Less" data-qty="' + i + ':-1">−</button>' +
          '<span>' + item.qty + '</span>' +
          '<button aria-label="More" data-qty="' + i + ':1">+</button>' +
          '<button class="link-btn" data-remove="' + i + '">Remove</button>' +
        '</div>' +
      '</div>' +
      '<div class="line-total">' + cedi(p.price * item.qty) + '</div>' +
    '</div>';
  }

  function renderBag() {
    var bag = readBag();
    var count = bag.reduce(function (s, i) { return s + i.qty; }, 0);
    $$("[data-bag-count]").forEach(function (el) { el.textContent = count ? "Bag (" + count + ")" : "Bag"; });

    var list = $("#bag-items");
    if (list) {
      list.innerHTML = bag.length
        ? bag.map(function (item, i) { return lineHTML(item, i, true); }).join("")
        : '<p class="empty">Your bag is empty. <a href="' + ROOT() + 'shop.html">Browse the shop</a>.</p>';
      var total = $("#bag-total");
      if (total) total.textContent = cedi(bagTotal(bag));
      var cta = $("#bag-checkout");
      if (cta) cta.classList.toggle("disabled", !bag.length);
    }

    var cartLines = $("#cart-lines");
    if (cartLines) {
      cartLines.innerHTML = bag.length
        ? bag.map(function (item, i) { return lineHTML(item, i, false); }).join("")
        : '<div class="empty-state"><h2 class="h3">Your bag is empty</h2><p>Pick a piece from the shop and it will appear here.</p><a class="btn btn-primary" href="' + ROOT() + 'shop.html">Shop the drop</a></div>';
      var sub = $("#cart-subtotal");
      if (sub) sub.textContent = cedi(bagTotal(bag));
      var sub2 = $("#cart-subtotal2");
      if (sub2) sub2.textContent = cedi(bagTotal(bag));
      var cartCount = $("#cart-count");
      if (cartCount) cartCount.textContent = count + (count === 1 ? " item" : " items");
      var go = $("#cart-checkout");
      if (go) go.classList.toggle("disabled", !bag.length);
      var summary = $("#cart-summary");
      if (summary) summary.style.display = bag.length ? "" : "none";
    }

    renderCheckoutSummary();
  }

  /* ---------- WhatsApp order message ---------- */
  function orderLines(bag) {
    return bag.map(function (i) {
      var p = BY_ID[i.id];
      return "• " + p.name + " (" + i.color + ", Size " + i.size + ") x" + i.qty + " = " + cedi(p.price * i.qty);
    });
  }
  function orderMessage(bag, details) {
    var lines = ["Hello B.S.S, I'd like to place an order:", ""].concat(orderLines(bag));
    lines.push("", "Total: " + cedi(bagTotal(bag)));
    if (details) {
      lines.push("", "Name: " + details.name, "Phone: " + details.phone, "Area: " + details.area, "Delivery address / landmark: " + details.address);
      if (details.payment) lines.push("Preferred payment: " + details.payment);
      if (details.notes) lines.push("Notes: " + details.notes);
    } else {
      lines.push("", "Name:", "Delivery address (or landmark):", "Phone:", "Preferred payment (MoMo or bank):");
    }
    return lines.join("\n");
  }

  /* ---------- Checkout ---------- */
  function renderCheckoutSummary() {
    var box = $("#checkout-summary");
    if (!box) return;
    var bag = readBag();
    if (!bag.length) {
      box.innerHTML = '<p class="empty">Your bag is empty. <a href="' + ROOT() + 'shop.html">Browse the shop</a>.</p>';
      var f = $("#checkout-form");
      if (f) f.style.display = "none";
      return;
    }
    box.innerHTML = '<ul class="sum-list">' + bag.map(function (i) {
      var p = BY_ID[i.id];
      return '<li><span>' + p.name + ' · ' + i.color + ' · ' + i.size + ' × ' + i.qty + '</span><span>' + cedi(p.price * i.qty) + '</span></li>';
    }).join("") + '</ul><div class="sum-total"><span>Total</span><span>' + cedi(bagTotal(bag)) + '</span></div>' +
    '<p class="sum-note">Delivery fee is confirmed with you on WhatsApp before you pay.</p>';
  }

  function setupCheckout() {
    var form = $("#checkout-form");
    if (!form) return;
    renderCheckoutSummary();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bag = readBag();
      if (!bag.length) return;
      var data = {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        area: form.area.value,
        address: form.address.value.trim(),
        payment: (form.querySelector("input[name=payment]:checked") || {}).value || "",
        notes: form.notes.value.trim()
      };
      var errors = [];
      if (!data.name) errors.push("name");
      if (!/^[0-9+ ]{9,16}$/.test(data.phone)) errors.push("phone");
      if (!data.area) errors.push("area");
      if (!data.address) errors.push("address");
      $$(".field", form).forEach(function (f) { f.classList.remove("error"); });
      if (errors.length) {
        errors.forEach(function (k) { var el = form.querySelector("[name=" + k + "]"); if (el) el.closest(".field").classList.add("error"); });
        var first = form.querySelector(".field.error input, .field.error select, .field.error textarea");
        if (first) first.focus();
        return;
      }
      var message = orderMessage(bag, data);
      storageSet(LAST_ORDER_KEY, message);
      writeBag([]);
      window.open(waUrl(message), "_blank", "noopener");
      location.href = "order-sent.html";
    });
  }

  function setupOrderSent() {
    var btn = $("#reopen-wa");
    if (!btn) return;
    var msg = storageGet(LAST_ORDER_KEY, "");
    if (msg) {
      btn.href = waUrl(msg);
      var preview = $("#sent-preview");
      if (preview) preview.textContent = msg;
    } else {
      btn.href = waUrl();
    }
  }

  function setupTrack() {
    var form = $("#track-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var num = form.order.value.trim();
      if (!num) { form.order.closest(".field").classList.add("error"); return; }
      window.open(waUrl("Hello B.S.S, please give me an update on my order " + num + "."), "_blank", "noopener");
    });
  }

  /* ---------- Product page ---------- */
  function setupProduct() {
    var root = $("[data-product-page]");
    if (!root) return;
    var p = BY_ID[root.getAttribute("data-product-page")];
    if (!p) return;

    var color = p.colors[0].name;
    var size = null;
    var qty = 1;

    function draw() {
      var c = colourFor(p, color);
      var art = $("#pdp-art");
      if (art) art.innerHTML = ART.shirtSVG(c.shirt, { hoodie: p.hoodie, mark: p.mark, print: c.print });
      $("#pdp-color-name").textContent = c.name;
      $$(".color-btn").forEach(function (b) { b.classList.toggle("on", b.dataset.name === color); b.setAttribute("aria-pressed", b.dataset.name === color); });
      $$(".size").forEach(function (b) { b.classList.toggle("on", b.dataset.size === size); });
      $("#pdp-qty").textContent = qty;
      $("#pdp-add").disabled = !size;
      $("#pdp-add-label").textContent = size ? "Add to bag" : "Choose a size";
      $("#pdp-line-total").textContent = cedi(p.price * qty);
    }

    $$(".color-btn").forEach(function (b) { b.addEventListener("click", function () { color = b.dataset.name; draw(); }); });
    $$(".size").forEach(function (b) { b.addEventListener("click", function () { size = b.dataset.size; draw(); }); });
    $("#pdp-minus").addEventListener("click", function () { qty = Math.max(1, qty - 1); draw(); });
    $("#pdp-plus").addEventListener("click", function () { qty = Math.min(10, qty + 1); draw(); });
    $("#pdp-add").addEventListener("click", function () {
      if (!size) return;
      addToBag({ id: p.id, color: color, size: size, qty: qty });
    });
    $("#pdp-wa").addEventListener("click", function () {
      if (!size) { toast("Choose a size first"); return; }
      var msg = orderMessage([{ id: p.id, color: color, size: size, qty: qty }], null);
      window.open(waUrl(msg), "_blank", "noopener");
    });
    draw();
  }

  /* ---------- Shop filters and sort ---------- */
  function setupShop() {
    var grid = $("#shop-grid");
    if (!grid) return;
    var filter = new URLSearchParams(location.search).get("cat") || "all";
    var sort = "new";
    $$("[data-filter]").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-filter") === filter); });

    function apply() {
      var cards = $$("[data-product-card]", grid);
      cards.forEach(function (c) {
        var show = filter === "all" || c.getAttribute("data-category") === filter;
        c.style.display = show ? "" : "none";
      });
      var visible = cards.filter(function (c) { return c.style.display !== "none"; });
      var key = {
        new: function (a, b) { return a.dataset.order - b.dataset.order; },
        "price-asc": function (a, b) { return +a.dataset.price - +b.dataset.price; },
        "price-desc": function (a, b) { return +b.dataset.price - +a.dataset.price; }
      }[sort];
      visible.sort(key).forEach(function (c) { grid.appendChild(c); });
      $("#shop-count").textContent = visible.length + (visible.length === 1 ? " piece" : " pieces");
    }

    $$("[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () {
        filter = b.getAttribute("data-filter");
        $$("[data-filter]").forEach(function (x) { x.classList.toggle("on", x === b); });
        apply();
      });
    });
    var sel = $("#shop-sort");
    if (sel) sel.addEventListener("change", function () { sort = sel.value; apply(); });
    apply();
  }

  /* ---------- Reveal on scroll ---------- */
  function setupReveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
    // Fail-safe: never leave content invisible if the observer misfires.
    setTimeout(function () { els.forEach(function (e) { e.classList.add("in"); }); }, 1500);
  }

  /* ---------- Global wiring ---------- */
  if (typeof document !== "undefined") {
    document.addEventListener("click", function (e) {
      var q = e.target.closest("[data-qty]");
      if (q) {
        var parts = q.getAttribute("data-qty").split(":");
        changeQty(+parts[0], +parts[1]);
        return;
      }
      var rm = e.target.closest("[data-remove]");
      if (rm) { removeLine(+rm.getAttribute("data-remove")); return; }
      if (e.target.closest("[data-open-bag]")) { e.preventDefault(); openBag(); return; }
      if (e.target.closest("[data-close-bag]") || e.target.id === "scrim") { closeBag(); return; }
      if (e.target.closest("#bag-checkout")) {
        if (!readBag().length) return;
        location.href = ROOT() + "checkout.html";
      }
    });

    document.addEventListener("DOMContentLoaded", function () {
      $$("[data-wa-link]").forEach(function (a) { a.href = waUrl(); a.target = "_blank"; a.rel = "noopener"; });
      $$("[data-wa-display]").forEach(function (el) { el.textContent = WA_DISPLAY; });
      $$("[data-wa-text]").forEach(function (a) { a.href = waUrl(a.getAttribute("data-wa-text")); a.target = "_blank"; a.rel = "noopener"; });
      renderBag();
      setupProduct();
      setupShop();
      setupCheckout();
      setupOrderSent();
      setupTrack();
      setupReveal();
      setupTheme();
      var sb = $("#bag-clear");
      if (sb) sb.addEventListener("click", function () { writeBag([]); });
    });
  }

  /* ---------- OS Theme Detection & Dynamic Adaptation ---------- */
  function setupTheme() {
    if (typeof window === "undefined" || !window.matchMedia) return;
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    function handleThemeChange() {
      var bag = $("#bag");
      if (bag && bag.classList.contains("open")) {
        renderBag();
      }
    }
    if (media.addEventListener) {
      media.addEventListener("change", handleThemeChange);
    } else if (media.addListener) {
      media.addListener(handleThemeChange);
    }
  }

  if (typeof window !== "undefined") {
    window.BSS_STORAGE = {
      get: storageGet,
      set: storageSet
    };
    window.BSS = {
      addToBag: addToBag,
      readBag: readBag,
      toast: toast,
      cedi: cedi,
      storage: window.BSS_STORAGE
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      orderMessage: orderMessage
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
