// Servitut-launcher - bulletproof mobile version.
// Strategi: ingen autocomplete-dropdown. Brugeren skriver adressen, trykker
// Søg (eller Enter), og vi viser resultater som store <button>-kort under
// søgefeltet. Click på en button er det mest pålidelige event på iOS Safari.

const DAWA_URL = "https://api.dataforsyningen.dk/adresser/autocomplete";
const VERSION = "v3";

const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("address"),
  searchBtn: document.getElementById("search-btn"),
  status: document.getElementById("status"),
  suggestions: document.getElementById("suggestions"),
  results: document.getElementById("results"),
  chosenText: document.getElementById("chosen-text"),
  linkDingeo: document.getElementById("link-dingeo"),
  linkTingbog: document.getElementById("link-tingbog"),
  linkBoligejer: document.getElementById("link-boligejer"),
  meta: document.getElementById("meta"),
};

console.log(`[servitut] boot ${VERSION}`);

// ---- Pure helpers (eksporteret til window.__TEST__ for smoke-test) ----

// Lowercase, fjern punktuation, behold unicode-bogstaver (æ/ø/å/é m.fl.).
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Byg DinGeo-URL fra en DAWA adresse-record.
function buildDingeoUrl(addr) {
  const postnr = addr.postnr;
  const by = slugify(addr.postnrnavn || "");
  const vej = slugify(addr.vejnavn || "");
  const husnr = (addr.husnr || "").toLowerCase();
  if (!postnr || !by || !vej || !husnr) return null;
  return `https://www.dingeo.dk/adresse/${postnr}-${by}/${vej}-${husnr}/`;
}

function buildTingbogUrl() {
  return "https://www.tinglysning.dk/tinglysning/landingpage/landingpage.xhtml";
}

function buildBoligejerUrl() {
  return "https://boligejer.dk/ejendomsdata";
}

function formatAddress(addr) {
  let line = `${addr.vejnavn || ""} ${addr.husnr || ""}`.trim();
  if (addr.etage) line += `, ${addr.etage}.`;
  if (addr.dør) line += ` ${addr.dør}`;
  line += `, ${addr.postnr || ""} ${addr.postnrnavn || ""}`;
  return line.replace(/\s+/g, " ").trim();
}

// ---- UI ----

function setStatus(msg, kind = "info") {
  els.status.textContent = msg;
  els.status.dataset.kind = kind;
}

function clearSuggestions() {
  els.suggestions.innerHTML = "";
}

function renderSuggestions(items) {
  clearSuggestions();
  items.forEach((item, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion";
    btn.dataset.index = String(i);
    btn.textContent = item.tekst;
    btn.addEventListener("click", () => pickSuggestion(item));
    els.suggestions.appendChild(btn);
  });
}

async function pickSuggestion(item) {
  console.log("[servitut] pick", item);
  if (item.type === "adresse" && item.adresse) {
    showResult(item.adresse);
    return;
  }
  // Ikke en færdig adresse - brug forslaget som nyt søgeord.
  els.input.value = item.tekst;
  runSearch();
}

function showResult(addr) {
  console.log("[servitut] showResult", addr);
  els.chosenText.textContent = formatAddress(addr);

  const dingeo = buildDingeoUrl(addr);
  els.linkDingeo.href = dingeo || "https://www.dingeo.dk/";
  els.linkTingbog.href = buildTingbogUrl();
  els.linkBoligejer.href = buildBoligejerUrl();

  const parts = [];
  if (addr.kommunekode) parts.push(`Kommunekode ${addr.kommunekode}`);
  if (addr.id) parts.push(`DAWA ${addr.id.slice(0, 8)}…`);
  els.meta.textContent = parts.join(" · ");

  els.results.hidden = false;
  clearSuggestions();
  setStatus("");

  // Scroll resultat-sektionen ind i view på mobil.
  els.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- DAWA call ----

async function fetchDawa(q) {
  const url = `${DAWA_URL}?q=${encodeURIComponent(q)}&per_side=10&fuzzy`;
  console.log("[servitut] fetch", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DAWA svarede ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Uventet svar fra DAWA");
  return data;
}

let searchSeq = 0;
async function runSearch() {
  const q = els.input.value.trim();
  clearSuggestions();
  els.results.hidden = true;
  if (q.length < 2) {
    setStatus("Skriv mindst 2 tegn.");
    return;
  }
  setStatus("Søger…");
  const mySeq = ++searchSeq;
  try {
    const items = await fetchDawa(q);
    if (mySeq !== searchSeq) return; // en nyere søgning er startet
    if (items.length === 0) {
      setStatus(`Ingen resultater for "${q}".`);
      return;
    }
    setStatus(`${items.length} forslag - tryk for at vælge:`);
    renderSuggestions(items);
  } catch (err) {
    console.error("[servitut]", err);
    setStatus(`Fejl: ${err.message}. Tjek internetforbindelsen.`, "error");
  }
}

// Submit via Enter eller Søg-knap.
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch();
});

// Diskret live-forslag mens man taster (debounced, valgfri UX).
let debounceT;
els.input.addEventListener("input", () => {
  clearTimeout(debounceT);
  const q = els.input.value.trim();
  if (q.length < 3) return;
  debounceT = setTimeout(runSearch, 300);
});

// Initial fokus for hurtig start.
if (!("ontouchstart" in window)) {
  els.input.focus();
}

// Test-hook til smoke-test.
if (typeof window !== "undefined") {
  window.__TEST__ = { slugify, buildDingeoUrl, formatAddress, VERSION };
}
