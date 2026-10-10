# CASE 011

CASE 011 is a mystery investigation game website with four independent entry pages, each intended to be reached through its own URL and QR code.

## Current status

Only the directory scaffold exists. HTML, CSS, and JavaScript files are empty; no page designs, story content, puzzles, or gameplay features are implemented. QR codes and hosting are not configured.

## Structure

```text
public/
  entry-1/
  entry-2/
  entry-3/
  entry-4/
```

Each entry directory contains its own `index.html`, `styles.css`, `script.js`, and `assets/` directory. Empty asset directories are retained with `.gitkeep` files.

| Entry | Direct path |
| --- | --- |
| 1 | `/entry-1/` |
| 2 | `/entry-2/` |
| 3 | `/entry-3/` |
| 4 | `/entry-4/` |

Pages must remain independent, with no links or navigation between them and no requirement to visit another page first. Keep page-specific code and assets within the corresponding directory. Page implementation is pending individual requirements.

## Local development

No dependencies or build step are required. Serve `public/` with a static HTTP server. If Python 3 is installed, run from the repository root:

```sh
python -m http.server 8000 --directory public
```

Open an entry directly, such as `http://localhost:8000/entry-1/`. All four entries currently display blank pages.

## Deployment

The static document root is `public/`. Hosting must serve each directory's `index.html` at its corresponding path without routing all entries to a shared page. Each future QR code should point to its entry's full deployed URL. No hosting provider or deployment workflow has been selected.
