# CASE 011

CASE 011 is a mystery investigation game website with four independent entry pages, each intended to be reached through its own URL and QR code.

## Current status

Entry 1 contains archive access, four suspect dossiers, physical-evidence requirements, document categories, and a PDF viewer. The archive form accepts Latin, Persian, and Arabic-Indic digits, with inline validation and two timed access confirmations. The archive-number check is a client-side game mechanic, not authentication.

Entry 1 also includes investigator-selected document categories and an internal native PDF viewer. The documents control sits beside the evidence button, starts visible but disabled, and unlocks only by returning from evidence requirements. A full reload resets it to locked. Category and viewer return actions preserve dossier disclosures, scroll position, and the optional sound setting. A single compact sound control moves beside each active view's main title without restarting audio. These are internal views, with no additional entry points.

Original PDFs are retained in `public/entry-1/assets/evidence/`. Category lists check availability with HTTP HEAD requests; unavailable files retain their titles with a disabled control and an unavailable message. PDFs load only after selection. The viewer includes a separate-tab fallback link for devices without embedded PDF support. Serve this flow over HTTP with a static server that supports HEAD requests.

Dossiers retain the supplied Persian copy, use the four provided portraits, and offer independent native statement disclosures. Motives contain decorative shapes and a restricted-access label only. Returning from evidence requirements preserves open statements and the dossier scroll position. Optional Web Audio ambience remains available across all views, starts only when enabled, and pauses while the page is hidden.

Entry 2 is an independent PATTERN DATABASE portal at `/entry-2/`. Four button-based comparison slots accept only `=` or `≠` from its keypad. Validation retains choices after errors; a successful submission locks controls and reveals the match, reference, and warning at 700 ms, 1900 ms, and 3100 ms. Status announcements contain only the newly revealed section. Entry 2 reuses the existing self-hosted Persian font without requiring archive access or adding navigation between entries.

On mobile, entry 2 places a bounded output panel above the comparison controls. A dynamic viewport budget uses the measured, wrapped header height and safe areas to give the input panel the remaining space. Both panels support internal scrolling; staged reveals scroll only inside the output region. Its scoped sticky position keeps feedback available during page scrolling. Larger text and short landscape viewports can use normal page scrolling.

After the warning transition and a two-second reading interval, entry 2 offers an internal original-record view. Its corrupted-file notification uses a 15-second elapsed-time game sequence with counter-rotating segmented rings, a core scan, phased nodes, and cyan intensity changes. Processing animations run only while the decoding view is visible and stop at completion. Reduced motion keeps geometry still and gently changes the whole emblem's intensity throughout the wait. Record navigation is forward only; pending callbacks are cancelled on page exit, and hidden views are inert. The decoded record contains only International Morse symbols generated from the ITU-R M.1677-1 alphabet. No media playback or actual file decoding is involved.

Entries 3-4 remain empty scaffolds. QR codes and hosting are not implemented.

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

Open entry 1 at `http://localhost:8000/entry-1/` or entry 2 at `http://localhost:8000/entry-2/`. Entries 3-4 currently display blank pages. Entries 1 and 2 require JavaScript for their interactions; unsupported audio does not prevent archive access.

## Deployment

The static document root is `public/`. Hosting must serve each directory's `index.html` at its corresponding path without routing all entries to a shared page. Each future QR code should point to its entry's full deployed URL. No hosting provider or deployment workflow has been selected.
