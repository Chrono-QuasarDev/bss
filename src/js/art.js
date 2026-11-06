// Shirt artwork drawn as SVG in the brand palette. Shared by the build and the browser.
(function (root) {
  function shirtSVG(color, opts) {
    opts = opts || {};
    const hoodie = !!opts.hoodie;
    const printColor = opts.print || "#f3efe6";
    const body = hoodie
      ? "M160 150 L120 170 L70 220 L110 300 L150 280 L150 560 L450 560 L450 280 L490 300 L530 220 L480 170 L440 150 Q400 200 360 170 Q320 190 300 210 Q280 190 240 170 Q200 200 160 150 Z"
      : "M250 120 L190 150 L80 200 L130 320 L180 296 L180 560 L420 560 L420 296 L470 320 L520 200 L410 150 Q350 190 250 120 Z";
    const collar = hoodie
      ? '<path d="M240 170 Q300 230 360 170" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="6"/>'
      : '<path d="M250 120 Q300 200 350 120" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="6"/>';
    const chest = opts.mark
      ? '<g stroke="' + printColor + '" fill="none" stroke-width="2" opacity=".9"><circle cx="300" cy="260" r="26"/><line x1="300" y1="222" x2="300" y2="298"/><line x1="262" y1="260" x2="338" y2="260"/></g>'
      : '<text x="300" y="268" text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif" font-size="46" fill="' + printColor + '" letter-spacing="2">B.S.S</text>';
    return '<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<defs><radialGradient id="bssTileBg" cx="50%" cy="38%" r="78%"><stop offset="0%" stop-color="#27231c"/><stop offset="100%" stop-color="#171512"/></radialGradient></defs>' +
      '<rect width="600" height="600" fill="url(#bssTileBg)"/>' +
      '<path d="' + body + '" fill="' + color + '"/>' + collar + chest + '</svg>';
  }
  const API = { shirtSVG: shirtSVG };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.BSS_ART = API;
})(typeof window !== "undefined" ? window : globalThis);
