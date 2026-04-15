# Servitut

Lille mobilvenlig launcher til at slå **servitutter** op på danske ejendomme ud fra en adresse. Ingen login, ingen backend - bare indtast adressen og tryk videre til kilden.

## Kilder

- **DinGeo** (anbefalet) - gratis, ingen login, viser servitutter direkte pr. adresse.
- **Tingbogen** - officiel tinglysningsdatabase. Kræver MitID og understøtter ikke adresse-deep-link.
- **Boligejer (Min Ejendom)** - myndighedernes ejendomsdata-portal. Kræver MitID.

Adresse-autocomplete drives af [DAWA](https://dawadocs.dataforsyningen.dk).

## Kør lokalt

```
python3 -m http.server 8000
```

Åbn derefter <http://localhost:8000>.

## Deploy

Push til `main`-branchen → GitHub Actions workflow'en i `.github/workflows/pages.yml` deployer automatisk til GitHub Pages. Aktivér Pages i repo-indstillingerne med source "GitHub Actions" første gang.

## Filer

- `index.html` - UI (søgefelt + resultat-cards + "om"-sektion)
- `app.js` - DAWA-autocomplete + deep-link-generering
- `style.css` - mobile-first styling (inkl. dark mode)

## Kendte begrænsninger

- DinGeo deep-links bygger på en slug-konvention (`/adresse/{postnr}-{by}/{vej}-{husnr}/`). Hvis DinGeo ændrer URL-format, skal `slugify`/`buildDingeoUrl` i `app.js` opdateres.
- Tingbogen tilbyder ikke adresse-deep-link uden login - man lander på forsiden.
- DAWA lukker 1. juli 2026. Datafordeleren overtager - migrering er lille (udskift endpoint).
