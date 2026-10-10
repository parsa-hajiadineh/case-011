# CASE 011

CASE 011 is a mystery investigation game website with four independent entry pages, each intended to be reached through its own URL and QR code.

## Current status

Entry 1 contains three internal views: archive access, four suspect dossiers, and physical-evidence requirements. The archive form accepts Latin, Persian, and Arabic-Indic digits, with inline validation and two timed access confirmations. The archive-number check is a client-side game mechanic, not authentication.

Dossiers retain the supplied Persian copy, use the four provided portraits, and offer independent native statement disclosures. Motives contain decorative shapes and a restricted-access label only. Returning from evidence requirements preserves open statements and the dossier scroll position. Optional Web Audio ambience remains available across all views, starts only when enabled, and pauses while the page is hidden.

Entries 2-4 remain empty scaffolds. QR codes and hosting are not implemented.

## Structure

```text
public/
  shared/foundation.css
  entry-1/
  entry-2/
  entry-3/
  entry-4/
```

Each entry directory contains its own `index.html`, `styles.css`, `script.js`, and `assets/` directory. Empty asset directories are retained with `.gitkeep` files. `shared/foundation.css` provides typography, color tokens, basic controls, focus styles, and reduced-motion rules; entry-specific layout and behavior stay in their entry directory. No external libraries or media services are required.

Entry 1 uses a dark archival composition, an original decorative SVG, a brief checking state, and reduced-motion-aware transitions. Its self-hosted variable Vazirmatn font comes from the [official v33.003 release](https://github.com/rastikerdar/vazirmatn/tree/v33.003). The unmodified font and its SIL Open Font License are retained in `public/entry-1/assets/fonts/`. Font loading falls back to Tahoma and system sans-serif fonts.

Portraits are stored in `public/entry-1/assets/suspects/`: `IMG_0703.png` (Kamran), `IMG_0705.png` (Nora), `IMG_0718.png` (Arash), and `IMG_0721.png` (Bamakh). Images use fixed 4:5 frames and show a neutral fallback if loading fails. Supplied age fields and Arash's departure time contain no numeric values; their text is retained without inferred values.

| Entry | Direct path |
| --- | --- |
| 1 | `/entry-1/` |
| 2 | `/entry-2/` |
| 3 | `/entry-3/` |
| 4 | `/entry-4/` |

Pages must remain independent, with no links or navigation between them and no requirement to visit another page first. Keep page-specific code and assets within the corresponding directory. Remaining pages are pending individual requirements.

## Local development

No dependencies or build step are required. Serve `public/` with a static HTTP server. If Python 3 is installed, run from the repository root:

```sh
python -m http.server 8000 --directory public
```

Open entry 1 at `http://localhost:8000/entry-1/`. Entries 2-4 currently display blank pages. Entry 1 requires JavaScript for the access check; unsupported audio does not prevent access.

## Deployment

The static document root is `public/`. Hosting must serve each directory's `index.html` at its corresponding path without routing all entries to a shared page. Each future QR code should point to its entry's full deployed URL. No hosting provider or deployment workflow has been selected.
