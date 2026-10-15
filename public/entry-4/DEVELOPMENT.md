# Entry 4 content and behavior

This is a static, personal detective workspace. Serve it over HTTP so its local
JavaScript modules load. No packages, backend, audio, storage, or cross-entry
navigation are used. The sequential tests are a client-side game mechanic, not
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
explicitly makes option 1 correct in both tests. `correctOption` is one-based
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

`provisionalNotes` contains the three user-supplied neutral testing notes. Editing
it updates the starting copy for all seven stages. These are not final story clues.
`entry4Config.evidenceNotes` creates seven separate arrays in Evidence 1–7 order.
For future stage-specific copy, replace its initializer with seven arrays of three
strings; indexes `[stageIndex][noteIndex]` are zero-based. Paragraph breaks inside
a note are preserved. Reopening a stage preserves its own note count in memory
for the current page session only. No unfinished-content notices are shown.

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
Distinguish the authorized provisional copy from final story-specific content.
