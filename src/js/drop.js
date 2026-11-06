// Early access page. Holds no secrets. It asks the server for the catalog,
// and the server decides what to return based on the access cookie.
(function () {
  var WA_NUMBER = "233206764888";
  var API = "/api/drop";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function cedi(n) { return "GHS " + Number(n).toLocaleString("en-GH"); }
  function waUrl(text) { return "https://wa.me/" + WA_NUMBER + (text ? "?text=" + encodeURIComponent(text) : ""); }

  function show(id, on) { var el = $(id); if (el) el.hidden = !on; }

  function render(catalog) {
    $("drop-title").textContent = catalog.name;
    $("drop-sub").textContent = "Early access for paid buyers. Open until " + catalog.date + ".";
    $("drop-ref").textContent = catalog.ref;
    $("drop-date-note").textContent = "Goes public on " + catalog.date + ".";

    $("drop-grid").innerHTML = catalog.products.map(function (p, i) {
      var colourOpts = p.colors.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>'; }).join("");
      var sizeOpts = p.sizes.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join("");
      return '<article class="card" style="display:flex;flex-direction:column;gap:14px">' +
        '<div class="card-media" style="aspect-ratio:4/5;border:1px solid var(--line);background:var(--ink-2)">' +
          '<img src="' + API + '/image/' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">' +
        '</div>' +
        '<div class="card-meta"><span class="card-name">' + esc(p.name) + '</span><span class="card-price">' + cedi(p.price) + '</span></div>' +
        '<p class="muted" style="font-size:15px">' + esc(p.desc) + '</p>' +
        '<ul class="muted" style="font-size:14px;padding-left:18px">' + p.details.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join("") + '</ul>' +
        '<div class="field"><label for="dc-' + i + '">Colour</label><select id="dc-' + i + '">' + colourOpts + '</select></div>' +
        '<div class="field"><label for="ds-' + i + '">Size</label><select id="ds-' + i + '">' + sizeOpts + '</select></div>' +
        '<button class="btn btn-primary" type="button" data-reserve="' + i + '" style="justify-content:center">Reserve on WhatsApp</button>' +
      '</article>';
    }).join("");

    $("drop-grid").querySelectorAll("[data-reserve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = +btn.getAttribute("data-reserve");
        var p = catalog.products[i];
        var colour = $("dc-" + i).value;
        var size = $("ds-" + i).value;
        var msg = [
          "EARLY ACCESS: " + catalog.name,
          "Ref: " + catalog.ref,
          "",
          "• " + p.name + " (" + colour + ", Size " + size + ") x1 = " + cedi(p.price),
          "",
          "Early access fee of " + cedi(catalog.price) + " is paid and credited to this order.",
          "",
          "Name:",
          "Delivery address (or landmark):",
          "Phone:"
        ].join("\n");
        window.open(waUrl(msg), "_blank", "noopener");
      });
    });

    show("drop-gate", false);
    show("drop-content", true);
  }

  function showClosed(catalog) {
    show("drop-gate", false);
    show("drop-content", false);
    show("drop-closed", true);
    if ($("drop-closed-link")) $("drop-closed-link").setAttribute("href", "shop.html");
  }

  function showUnavailable() {
    show("drop-gate", false);
    show("drop-unavailable", true);
  }

  // Shows a message under the code field. An empty message clears it.
  function setError(msg) {
    var field = $("drop-code").closest(".field");
    field.classList.toggle("error", !!msg);
    if ($("drop-error")) $("drop-error").textContent = msg || "";
  }

  function load() {
    fetch(API + "/catalog", { credentials: "same-origin", cache: "no-store" })
      .then(function (res) {
        if (res.status === 404) { show("drop-gate", false); show("drop-unavailable", true); return null; }
        if (res.status === 401) return null;
        return res.json();
      })
      .then(function (catalog) {
        if (!catalog) return;
        if (new Date(catalog.date + "T00:00:00Z") <= new Date()) return showClosed(catalog);
        render(catalog);
      })
      .catch(function () { /* stay on the gate */ });
  }

  function setupForm() {
    var form = $("drop-form");
    if (!form) return;
    var btn = $("drop-submit");
    var label = btn.textContent;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = $("drop-code").value.trim();
      setError("");
      if (!code) { setError("Enter your access code first."); return; }
      btn.disabled = true;
      btn.textContent = "Checking…";
      fetch(API + "/unlock", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code })
      })
        .then(function (res) {
          if (res.status === 410) { showClosed({}); return null; }
          if (res.status === 401) {
            setError("That code isn't recognised. Check every character, including the dashes. If you've just paid, message us on WhatsApp.");
            return null;
          }
          if (res.status === 429) {
            setError("Too many attempts. Wait a few minutes and try again.");
            return null;
          }
          if (!res.ok) {
            showUnavailable();
            return null;
          }
          return load();
        })
        .catch(function () {
          setError("We couldn't reach the server. Check your connection and try again.");
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupForm();
    load();
  });
})();
