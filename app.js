// Servitut-launcher: DAWA autocomplete + deep-links til servitut-kilder.
// Vanilla JS, ingen dependencies.

const DAWA_AUTOCOMPLETE = "https://api.dataforsyningen.dk/adresser/autocomplete";

const els = {
  input: document.getElementById("address"),
  clear: document.getElementById("clear"),
  suggestions: document.getElementById("suggestions"),
  results: document.getElementById("results"),
  chosenText: document.getElementById("chosen-text"),
  linkDingeo: document.getElementById("link-dingeo"),
  linkTingbog: document.getElementById("link-tingbog"),
  linkBoligejer: document.getElementById("link-boligejer"),
  meta: document.getElementById("meta"),
};

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Lowercase, fjern punktuation, behold unicode-bogstaver (æ/ø/å/é m.fl.) og
// cifre. DinGeo's URL-konvention bevarer danske tegn, fx
// /adresse/2300-københavn-s/vejlands-allé-99/.
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Byg DinGeo-URL fra en DAWA adresse-record.
// Format: https://www.dingeo.dk/adresse/{postnr}-{by-slug}/{vej-slug}-{husnr}{bogstav}/
function buildDingeoUrl(addr) {
  const postnr = addr.postnr;
  const by = slugify(addr.postnrnavn || "");
  const vej = slugify(addr.vejnavn || "");
  const husnr = (addr.husnr || "").toLowerCase();
  if (!postnr || !by || !vej || !husnr) return null;
  return `https://www.dingeo.dk/adresse/${postnr}-${by}/${vej}-${husnr}/`;
}

// Tingbogen understøtter ikke adresse-deep-link uden login; vi sender brugeren
// til forsiden hvor de kan logge ind og søge.
function buildTingbogUrl() {
  return "https://www.tinglysning.dk/tinglysning/landingpage/landingpage.xhtml";
}

// Boligejer's Min Ejendom kræver MitID; vi sender til ejendomsdata-forsiden.
function buildBoligejerUrl() {
  return "https://boligejer.dk/ejendomsdata";
}

// Formater adressen som "Vejnavn Husnr[, etage. dør], Postnr Postnrnavn".
function formatAddress(addr) {
  let line = `${addr.vejnavn || ""} ${addr.husnr || ""}`.trim();
  if (addr.etage) line += `, ${addr.etage}.`;
  if (addr.dør) line += ` ${addr.dør}`;
  line += `, ${addr.postnr || ""} ${addr.postnrnavn || ""}`;
  return line.replace(/\s+/g, " ").trim();
}

let activeSuggestions = [];
let activeIndex = -1;

function renderSuggestions(list) {
  activeSuggestions = list;
  activeIndex = -1;
  els.suggestions.innerHTML = "";
  if (!list.length) {
    els.suggestions.hidden = true;
    els.input.setAttribute("aria-expanded", "false");
    return;
  }
  list.forEach((item, i) => {
    const li = document.createElement("li");
    li.textContent = item.tekst;
    li.setAttribute("role", "option");
    li.dataset.index = String(i);
    li.addEventListener("mousedown", (e) => {
      // mousedown i stedet for click - undgå at blur lukker listen før selection.
      e.preventDefault();
      selectSuggestion(i);
    });
    els.suggestions.appendChild(li);
  });
  els.suggestions.hidden = false;
  els.input.setAttribute("aria-expanded", "true");
}

function highlightSuggestion(i) {
  [...els.suggestions.children].forEach((li, idx) => {
    li.classList.toggle("active", idx === i);
  });
  activeIndex = i;
}

async function selectSuggestion(i) {
  const item = activeSuggestions[i];
  if (!item) return;
  // DAWA returnerer enten en færdig adresse (type: "adresse") eller en
  // præsentation der skal udvides. Hvis "caretpos" er mindre end tekstens
  // længde betyder det at der kan udvides - vi indsætter i stedet i inputtet.
  if (item.type !== "adresse" || !item.adresse) {
    els.input.value = item.tekst;
    triggerAutocomplete();
    return;
  }
  const addr = item.adresse;
  els.input.value = item.tekst;
  renderSuggestions([]);
  showResult(addr);
}

function showResult(addr) {
  els.chosenText.textContent = formatAddress(addr);

  const dingeo = buildDingeoUrl(addr);
  if (dingeo) {
    els.linkDingeo.href = dingeo;
    els.linkDingeo.style.display = "";
  } else {
    // Fallback: DinGeo-forsiden så man selv kan søge.
    els.linkDingeo.href = "https://www.dingeo.dk/";
  }

  els.linkTingbog.href = buildTingbogUrl();
  els.linkBoligejer.href = buildBoligejerUrl();

  // Vis matrikel-info hvis tilgængelig (DAWA autocomplete leverer ikke
  // matrikelnr direkte, men vi viser det hvis det er der).
  const parts = [];
  if (addr.kommunekode) parts.push(`Kommunekode ${addr.kommunekode}`);
  if (addr.id) parts.push(`DAWA-ID ${addr.id.slice(0, 8)}…`);
  els.meta.textContent = parts.join(" · ");

  els.results.hidden = false;
}

const triggerAutocomplete = debounce(async () => {
  const q = els.input.value.trim();
  els.clear.hidden = q.length === 0;
  if (q.length < 2) {
    renderSuggestions([]);
    return;
  }
  try {
    const url = `${DAWA_AUTOCOMPLETE}?q=${encodeURIComponent(q)}&per_side=8&fuzzy=`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DAWA ${res.status}`);
    const data = await res.json();
    renderSuggestions(data);
  } catch (err) {
    console.error("Autocomplete-fejl:", err);
    renderSuggestions([]);
  }
}, 180);

els.input.addEventListener("input", triggerAutocomplete);

els.input.addEventListener("keydown", (e) => {
  if (els.suggestions.hidden) return;
  const max = activeSuggestions.length - 1;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    highlightSuggestion(activeIndex < max ? activeIndex + 1 : 0);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    highlightSuggestion(activeIndex > 0 ? activeIndex - 1 : max);
  } else if (e.key === "Enter") {
    if (activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(activeIndex);
    }
  } else if (e.key === "Escape") {
    renderSuggestions([]);
  }
});

els.input.addEventListener("blur", () => {
  // Lille delay så mousedown på suggestion kan nå at fire.
  setTimeout(() => renderSuggestions([]), 120);
});

els.clear.addEventListener("click", () => {
  els.input.value = "";
  els.clear.hidden = true;
  renderSuggestions([]);
  els.results.hidden = true;
  els.input.focus();
});
