# Entry 4 content and behavior

This is a static, personal detective workspace. Serve it over HTTP so its local
JavaScript modules load. No packages, backend, audio, storage, or cross-entry
navigation are used. The sequential tests are a client-side game mechanic, not
authentication. Reloading resets access and all note progress.

## Required authored content

Edit `config.js` in this directory. Both `imageTests` need a question, accessible
labels for all three options, and `correctOption` set to the supplied one-based
option number (1–3). Null is intentionally unconfigured: no answer is assumed.
The three images must also finish loading successfully before a test accepts
submissions. A missing or unreadable image displays a neutral placeholder and
blocks that test. Labels should describe the image without revealing its answer.

Populate these actual game assets; do not replace them with unrelated images:

```text
assets/tests/test-1-option-1.png
assets/tests/test-1-option-2.png
assets/tests/test-1-option-3.png
assets/tests/test-2-option-1.png
assets/tests/test-2-option-2.png
assets/tests/test-2-option-3.png
```

`evidenceNotes` has exactly seven rows in Evidence 1–7 order, with exactly three
notes per row in reveal order. Replace the 21 null values with supplied Persian
strings. Paragraph breaks inside a note are preserved. An absent next note cannot
increment progress; later notes cannot be revealed out of order. Reopening a stage
preserves its own note count in memory for the current page session only.

## Local verification

Keep fixtures, screenshots, result logs, and temporary browser scripts under the
repository's ignored `.local-verification/` directory. Verify the unconfigured
production page first. Downstream tests may intercept `config.js` and image
requests in an isolated browser, supplying clearly synthetic fixture content.
Never change the production null values or add a player-facing bypass to test
downstream views. The mathematical answer is intentionally part of the client
code, but it is never printed in the player interface.

Browser verification should cover native radio keyboard behavior and explicit
confirmation, wrong and empty submissions, missing images, exact arithmetic
mapping, digit normalization including zero, all seven independent note counts,
return navigation, small screens, keyboard viewport resizing, and reduced motion.
Do not claim the authored image tests or notes are complete until supplied.
