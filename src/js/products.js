// B.S.S catalog. Placeholder products, prices and specs until the owner confirms the real range.
// Prices are in Ghana cedis (GHS).
(function (root) {
  const PRODUCTS = [
    {
      id: "signal-tee",
      slug: "signal-tee",
      name: "Signal Tee",
      category: "tees",
      price: 200,
      tag: "New",
      tagStyle: "signal",
      mark: false,
      hoodie: false,
      colors: [
        {
          name: "Ink Black",
          hex: "#0d0d0b",
          shirt: "#0d0d0b",
          print: "#ff3b1f",
        },
        { name: "Bone", hex: "#e9e4d8", shirt: "#e9e4d8", print: "#0d0d0b" },
        {
          name: "Plate Blue",
          hex: "#2439ff",
          shirt: "#2439ff",
          print: "#f3efe6",
        },
      ],
      sizes: ["S", "M", "L", "XL", "XXL"],
      soldOut: [],
      desc: "Heavyweight cotton with a dropped shoulder and a chest print pulled from a single screen. Built to be worn hard.",
      details: [
        "240 GSM heavyweight cotton jersey",
        "Dropped shoulder, boxy body",
        "Screen-printed, not transferred. The print is part of the shirt",
        "Pre-shrunk",
      ],
    },
    {
      id: "registration-tee",
      slug: "registration-tee",
      name: "Registration Tee",
      category: "tees",
      price: 220,
      tag: "Limited",
      tagStyle: "",
      mark: true,
      hoodie: false,
      colors: [
        {
          name: "Ink Black",
          hex: "#0d0d0b",
          shirt: "#0d0d0b",
          print: "#f3efe6",
        },
        {
          name: "Concrete",
          hex: "#8a867b",
          shirt: "#8a867b",
          print: "#0d0d0b",
        },
      ],
      sizes: ["S", "M", "L", "XL", "XXL"],
      soldOut: ["XXL"],
      desc: "Crosshair marks on the chest, the same ones printers use to line up colour. A reminder that everything here is made by hand.",
      details: [
        "260 GSM heavyweight cotton",
        "Oversized fit, drop shoulder",
        "Limited run. Once the screen is retired, the print is gone",
        "Pre-shrunk",
      ],
    },
    {
      id: "tro-tro-tee",
      slug: "tro-tro-tee",
      name: "Tro-Tro Tee",
      category: "tees",
      price: 180,
      tag: "Bestseller",
      tagStyle: "",
      mark: false,
      hoodie: false,
      colors: [
        { name: "Bone", hex: "#e9e4d8", shirt: "#e9e4d8", print: "#2439ff" },
        { name: "Signal", hex: "#ff3b1f", shirt: "#ff3b1f", print: "#0d0d0b" },
      ],
      sizes: ["S", "M", "L", "XL", "XXL"],
      soldOut: [],
      desc: "A lighter, everyday cut for the city. Bold lettering inspired by hand-painted signage on the road.",
      details: [
        "180 GSM cotton jersey",
        "Regular fit",
        "Screen-printed chest and back",
        "Pre-shrunk",
      ],
    },
    {
      id: "ink-hoodie",
      slug: "ink-hoodie",
      name: "Ink Hoodie",
      category: "hoodies",
      price: 420,
      tag: "New",
      tagStyle: "signal",
      mark: false,
      hoodie: true,
      colors: [
        {
          name: "Ink Black",
          hex: "#0d0d0b",
          shirt: "#0d0d0b",
          print: "#e9e4d8",
        },
        {
          name: "Concrete",
          hex: "#8a867b",
          shirt: "#8a867b",
          print: "#0d0d0b",
        },
      ],
      sizes: ["S", "M", "L", "XL", "XXL"],
      soldOut: [],
      desc: "Fleece-lined heavyweight hoodie with a kangaroo pocket and a large back print.",
      details: [
        "400 GSM fleece-back cotton",
        "Relaxed fit, kangaroo pocket",
        "Large back print",
        "Pre-shrunk",
      ],
    },
  ];

  const API = {
    PRODUCTS: PRODUCTS,
    BY_ID: Object.fromEntries(
      PRODUCTS.map(function (p) {
        return [p.id, p];
      }),
    ),
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.BSS_PRODUCTS = API;
})(typeof window !== "undefined" ? window : globalThis);
