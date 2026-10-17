# Entry 4 content and behavior

This is a static, personal detective workspace. Serve it over HTTP so its local
JavaScript modules load. No packages, backend, persistent storage, or cross-entry
navigation are used. Background music and interaction effects use the shared audio
utility. The sequential tests are a client-side game mechanic, not
authentication. Reloading resets access and all note progress.

## Visual system

`styles.css` owns the charcoal, graphite, pearl, silver, and restrained antique-gold
palette. The original vector emblem lives at `assets/detective-emblem.svg` in the
compact header. The separate `assets/investigation-still-life.svg` illustrates
abstract working materials in the introduction, with no readable case content.
The still life is decorative, noninteractive, and hidden from assistive technology.

Image choices keep their native radio inputs and existing DOM order. The radio
sits beside the caption below the image. Desktop uses equal image stages with
`object-fit: contain`; phones use full-width images at their natural aspect ratio.
No game images, configuration, copy, event handlers, or timing are altered by the
visual redesign. Hover styles require a fine pointer; reduced motion removes
entrance and selection transitions. All views retain normal document scrolling.

## Editable testing content

Edit `config.js` in this directory. `entry4Config.imageTests[0]` and `[1]` contain
each test's `question`, `options`, and `correctOption`. The supplied testing setup
uses option 1 for the first test and option 3 for the second test. `correctOption` is one-based
(1–3) and follows DOM order: right to left on desktop and top to bottom on mobile.
These are temporary answer mappings, not a bypass of the sequential tests.

All six installed images are usable game assets, including their current temporary
content. Replace their files later without changing these paths or the logic:

```text
assets/tests/test-1-option-1.png
assets/tests/test-1-option-2.png
assets/tests/test-1-option-3.png
assets/tests/test-2-option-1.png
assets/tests/test-2-option-2.png
assets/tests/test-2-option-3.png
```

Each loaded image is selectable by native radio input. Selection enables the
confirmation button; selecting alone never submits. A genuinely unavailable image
retains a restrained fallback and cannot be selected. No content classification or
final-content approval is required for the installed images to work.

`entry4Config.hintSections` holds the seven ordered sections, each with a stable
`id`, display `title`, and exactly three final `hints`. Chest Code follows Evidence
04 and belongs to its second lock; Evidence 05 covers Morse and Evidence 06 UV.
Reveal progress is keyed by section ID in memory for the current page session.
The authored copy intentionally retains supplied blank number slots; do not infer
missing subtraction operands or codes. Latin identifiers use LTR `bdi` elements
while preserving the exact paragraph text and whitespace.

## Local verification

Keep screenshots, result logs, and temporary browser scripts under the repository's
ignored `.local-verification/` directory. Verify the actual served configuration
and installed images with native mouse, keyboard, and touch input. Do not inject
state, call internal handlers, intercept configuration, or skip tests to claim
end-to-end success. The mathematical answer is intentionally part of the client
code, but it is never printed in the player interface.

Browser verification should cover native radio keyboard behavior and explicit
confirmation, disabled confirmation before selection, wrong answers, exact arithmetic
mapping, digit normalization including zero, all seven independent note counts,
return navigation, small screens, keyboard viewport resizing, and reduced motion.
The final copy is centralized in config.js.

Run `node tests/entry-4.browser.cjs` with the repository's `public/` directory
served on localhost:8000 and an isolated Chromium debugging session on port 9223.
It checks exact copy, access answers, navigation, interleaved independent reveal
progress, reload reset, RTL isolation, and overflow using mouse and touch input.
Screenshots and results go to `.local-verification/entry-4/final-hints/`.
