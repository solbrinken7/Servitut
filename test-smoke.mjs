// Smoke-test der kører app.js's rene funktioner + simulerer hele flowet
// gennem et lille DOM-stub. Kan ikke ramme DAWA live, så fetch mockes med en
// realistisk response.
//
// Kør: node test-smoke.mjs

import { readFileSync } from "node:fs";

// ---------- Minimal DOM-stub ----------
class StubEl {
  constructor(id = "", tag = "div") {
    this.id = id;
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this._attrs = {};
    this.classList = {
      _set: new Set(),
      add: (c) => this.classList._set.add(c),
      remove: (c) => this.classList._set.delete(c),
      toggle: (c, on) => on ? this.classList._set.add(c) : this.classList._set.delete(c),
      contains: (c) => this.classList._set.has(c),
    };
    this.style = {};
    this._textContent = "";
    this._innerHTML = "";
    this._hidden = false;
    this._value = "";
    this._href = "";
  }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = v; this._innerHTML = ""; this.children = []; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = v; if (v === "") this.children = []; }
  get hidden() { return this._hidden; }
  set hidden(v) { this._hidden = !!v; }
  get value() { return this._value; }
  set value(v) { this._value = v; }
  get href() { return this._href; }
  set href(v) { this._href = v; this._attrs.href = v; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === "href") this._href = v; this[k] = v; }
  getAttribute(k) { return this._attrs[k] ?? null; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  querySelector(sel) {
    if (sel === "[data-url]") return this._urlEl || null;
    return null;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  dispatchEvent(type, evt = {}) {
    let prevented = false;
    const handlers = this.listeners[type] || [];
    const eventObj = {
      preventDefault: () => { prevented = true; },
      get defaultPrevented() { return prevented; },
      ...evt,
    };
    handlers.forEach(h => h(eventObj));
    return !prevented;
  }
  scrollIntoView() {}
  focus() {}
}

const createdEls = {};
function makeEl(id) {
  const e = new StubEl(id);
  createdEls[id] = e;
  return e;
}

["search-form", "address", "search-btn", "status", "suggestions", "results",
 "chosen-text", "link-dingeo", "link-tingbog", "link-boligejer", "meta"
].forEach(id => makeEl(id));

// Tilføj synlig card-url sub-element til hvert link-kort.
["link-dingeo", "link-tingbog", "link-boligejer"].forEach(id => {
  const urlEl = new StubEl("", "div");
  createdEls[id]._urlEl = urlEl;
  createdEls[id].children.push(urlEl);
});

globalThis.document = {
  getElementById: (id) => createdEls[id],
  createElement: (tag) => new StubEl("", tag),
};

let openCalls = [];
globalThis.window = {
  __TEST__: null,
  ontouchstart: undefined,
  open: (url, target, features) => {
    openCalls.push({ url, target, features });
    return {}; // pretend popup succeeded
  },
  location: { href: "" },
};
globalThis.console = console;

// Mock fetch med en realistisk DAWA-response for "Rådhuspladsen 1"
const DAWA_MOCK_RESPONSE = [
  {
    tekst: "Rådhuspladsen 1, 1550 København V",
    type: "adresse",
    adresse: {
      id: "0a3f50a1-8960-32b8-e044-0003ba298018",
      vejnavn: "Rådhuspladsen",
      husnr: "1",
      etage: null,
      dør: null,
      postnr: "1550",
      postnrnavn: "København V",
      kommunekode: "0101",
    },
  },
  {
    tekst: "Rådhuspladsen 2, 1550 København V",
    type: "adresse",
    adresse: {
      id: "0a3f50a1-8960-32b8-e044-0003ba298019",
      vejnavn: "Rådhuspladsen",
      husnr: "2",
      etage: null,
      dør: null,
      postnr: "1550",
      postnrnavn: "København V",
      kommunekode: "0101",
    },
  },
];

let fetchCalls = [];
globalThis.fetch = async (url) => {
  fetchCalls.push(url);
  return {
    ok: true,
    json: async () => DAWA_MOCK_RESPONSE,
  };
};

// ---------- Load app.js ----------
const src = readFileSync(new URL("./app.js", import.meta.url), "utf8");
// Strip the defer-only initial focus call since ontouchstart is undefined.
// Vi kører app.js i global scope via indirect eval.
(0, eval)(src);

// ---------- Assert-helpers ----------
let pass = 0, fail = 0;
function check(desc, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${desc}`); }
  else { fail++; console.log(`  ✗ ${desc} ${extra}`); }
}

// ---------- Pure-funktions-tests ----------
console.log("\n[1] slugify");
const { slugify, buildDingeoUrl, formatAddress, VERSION } = window.__TEST__;
check("VERSION er v4", VERSION === "v4");
check("Rådhuspladsen beholder å", slugify("Rådhuspladsen") === "rådhuspladsen");
check("Vejlands Allé beholder é", slugify("Vejlands Allé") === "vejlands-allé");
check("København V", slugify("København V") === "københavn-v");
check("H. C. Andersens Boulevard kollapser punktuation", slugify("H. C. Andersens Boulevard") === "h-c-andersens-boulevard");
check("Østerbrogade beholder Ø", slugify("Østerbrogade") === "østerbrogade");

console.log("\n[2] buildDingeoUrl");
const dingeoUrl = buildDingeoUrl(DAWA_MOCK_RESPONSE[0].adresse);
check(
  "bygger korrekt /adresse/{postnr}-{by}/{vej}-{hus}/",
  dingeoUrl === "https://www.dingeo.dk/adresse/1550-københavn-v/rådhuspladsen-1/",
  `got: ${dingeoUrl}`
);
check("returnerer null hvis felt mangler", buildDingeoUrl({ postnr: "1550" }) === null);

console.log("\n[3] formatAddress");
check(
  "formaterer adresse uden etage/dør",
  formatAddress(DAWA_MOCK_RESPONSE[0].adresse) === "Rådhuspladsen 1, 1550 København V"
);
check(
  "formaterer adresse med etage og dør",
  formatAddress({ vejnavn: "Nørrebrogade", husnr: "12", etage: "3", dør: "tv", postnr: "2200", postnrnavn: "København N" })
    === "Nørrebrogade 12, 3. tv, 2200 København N"
);

// ---------- End-to-end flow ----------
console.log("\n[4] End-to-end flow");

// 1) Brugeren skriver "Rådhus" og submitter formularen.
createdEls["address"]._value = "Rådhus";
createdEls["search-form"].dispatchEvent("submit");

// runSearch er async - vent én tick.
await new Promise(r => setTimeout(r, 0));
await new Promise(r => setTimeout(r, 0));

check("fetch blev kaldt én gang", fetchCalls.length === 1);
check(
  "URL indeholder encoded query og fuzzy",
  fetchCalls[0].includes("q=R%C3%A5dhus") && fetchCalls[0].includes("fuzzy"),
  `got: ${fetchCalls[0]}`
);

const suggestionsEl = createdEls["suggestions"];
check("to forslag er renderet", suggestionsEl.children.length === 2);
check("første forslag har korrekt tekst",
  suggestionsEl.children[0]._textContent === "Rådhuspladsen 1, 1550 København V");
check("forslag er en <button> (pålidelig click på iOS)",
  suggestionsEl.children[0].tag === "button");

// 2) Brugeren klikker på første forslag.
suggestionsEl.children[0].dispatchEvent("click");

check(
  "resultat-sektion er synlig efter valg",
  createdEls["results"]._hidden === false
);
check(
  "chosen-text indeholder den valgte adresse",
  createdEls["chosen-text"]._textContent === "Rådhuspladsen 1, 1550 København V"
);
check(
  "DinGeo-link peger på korrekt URL",
  createdEls["link-dingeo"]._href === "https://www.dingeo.dk/adresse/1550-københavn-v/rådhuspladsen-1/",
  `got: ${createdEls["link-dingeo"]._href}`
);
check(
  "Tingbog-link peger på tinglysning.dk",
  createdEls["link-tingbog"]._href.startsWith("https://www.tinglysning.dk/")
);
check(
  "Boligejer-link peger på boligejer.dk",
  createdEls["link-boligejer"]._href === "https://boligejer.dk/ejendomsdata"
);

check(
  "DinGeo-kort viser URL under beskrivelsen",
  createdEls["link-dingeo"]._urlEl._textContent === "https://www.dingeo.dk/adresse/1550-københavn-v/rådhuspladsen-1/"
);

// 3) Bruger tapper på DinGeo-kortet → window.open kaldes (bulletproof fallback)
console.log("\n[5] Link-kort click-fallback");
openCalls.length = 0;
createdEls["link-dingeo"].dispatchEvent("click", {
  ctrlKey: false, metaKey: false, shiftKey: false,
});
check("window.open blev kaldt", openCalls.length === 1);
check(
  "window.open fik DinGeo URL",
  openCalls[0]?.url === "https://www.dingeo.dk/adresse/1550-københavn-v/rådhuspladsen-1/"
);
check("window.open åbnede i _blank", openCalls[0]?.target === "_blank");
check("window.open bruger noopener,noreferrer",
  openCalls[0]?.features === "noopener,noreferrer");

// Click på Tingbog-kort åbner tinglysning.dk
openCalls.length = 0;
createdEls["link-tingbog"].dispatchEvent("click", {});
check("Tingbog-click åbner tinglysning.dk",
  openCalls[0]?.url?.startsWith("https://www.tinglysning.dk/"));

// ---------- Summary ----------
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
