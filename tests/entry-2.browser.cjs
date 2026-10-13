"use strict";

// Tests the served application through real Chromium input, with read-only DOM checks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.resolve(__dirname, "../.local-verification/entry-2");
const incomplete = "لطفا نتیجه هر چهار مقایسه را مشخص کنید.";
const mismatch = "تطبیقی با الگوی مرجع یافت نشد. نتیجه آزمایش را بررسی کنید.";
const warning = "این تطبیق حضور نمونه زیستی در اتاق را تایید میکند نه ارتکاب قتل را";

async function main() {
  const tabs = await (await fetch("http://127.0.0.1:9223/json/list")).json();
  const tab = tabs.find((item) => item.type === "page" && /about:blank|localhost:8000\//.test(item.url));
  assert(tab, "Launch an isolated Chromium session on port 9223");
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map();
  const errors = [];
  let sequence = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const read = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const waitFor = async (expression, interval = 30, timeout = 8000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await read(expression)) return Date.now();
      await delay(interval);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (selector, clicks = 1) => {
    // Scrolling affects only the viewport, never the application's state.
    await send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})` });
    const point = await read(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for (let index = 0; index < clicks; index++) {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: index + 1, ...point });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: index + 1, ...point });
    }
  };
  const press = async (key, code, virtualKey, text = "") => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: virtualKey, text, unmodifiedText: text });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKey });
  };
  const screenshot = async (name) => {
    fs.mkdirSync(output, { recursive: true });
    const dimensions = await read("({width:innerWidth,height:document.documentElement.scrollHeight,viewportHeight:innerHeight})");
    const result = await send("Page.captureScreenshot", dimensions.width > 720 || dimensions.height <= dimensions.viewportHeight
      ? { format: "png", captureBeyondViewport: false }
      : { format: "png", captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 } });
    fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(result.data, "base64"));
  };
  const selected = () => read("[...document.querySelectorAll('.operator-slot span')].map(e=>e.textContent)");
  const hiddenResults = () => read("['match-output','reference-output','warning-output'].map(id=>document.getElementById(id).hidden)");
  const load = async () => {
    await send("Page.navigate", { url: "http://localhost:8000/entry-2/" });
    await waitFor("document.readyState === 'complete' && !!document.getElementById('comparison-form')");
  };
  const fill = async (choices) => {
    for (let index = 0; index < choices.length; index++) {
      await click(`.operator-slot[data-sample='${"BCDE"[index]}']`);
      await click(`.operator-key[data-operator='${choices[index]}']`);
    }
  };
  const success = async (takeScreenshots = false) => {
    const start = Date.now();
    await click("#submit-result");
    assert.equal(await read("document.getElementById('checking-state').hidden"), false);
    assert.equal(await read("[...document.querySelectorAll('#comparison-form button')].every(e=>e.disabled)"), true);
    await click("#submit-result");
    await press("Enter", "Enter", 13, "\r");
    const matchTime = await waitFor("!document.getElementById('match-output').hidden");
    assert.deepEqual(await hiddenResults(), [false, true, true]);
    assert.equal(await read("document.getElementById('match-output').textContent.trim().replace(/\\s+/g,' ')"), "MATCH CONFIRMED Crime Scene Sample A Pattern Correspondence: C");
    const referenceTime = await waitFor("!document.getElementById('reference-output').hidden");
    assert.deepEqual(await hiddenResults(), [false, false, true]);
    assert.equal(await read("document.getElementById('reference-output').textContent"), "Reference C: NORA AZARGOSHASB");
    assert.equal(await read("document.getElementById('database-status').textContent"), "Reference C: NORA AZARGOSHASB");
    const warningTime = await waitFor("!document.getElementById('warning-output').hidden");
    assert.deepEqual(await hiddenResults(), [false, false, false]);
    assert.equal(await read("document.querySelector('#warning-output h3').textContent"), "WARNING");
    assert.equal(await read("document.querySelector('#warning-output p').textContent"), warning);
    assert.equal(await read("document.getElementById('database-status').textContent.includes('MATCH CONFIRMED')"), false);
    assert.equal(await read("document.getElementById('comparison-form').hasAttribute('aria-busy')"), false);
    assert(matchTime - start >= 550 && matchTime - start <= 1100);
    assert(referenceTime - matchTime >= 1000 && referenceTime - matchTime <= 1500);
    assert(warningTime - referenceTime >= 1000 && warningTime - referenceTime <= 1500);
    const before = await selected();
    await click(".operator-key[data-operator='=']");
    await click("#submit-result");
    assert.deepEqual(await selected(), before);
    assert.deepEqual(await hiddenResults(), [false, false, false]);
    if (takeScreenshots) await screenshot("desktop-result");
    console.log("Sequence timings (ms):", matchTime - start, referenceTime - matchTime, warningTime - referenceTime);
  };
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    const { windowId } = await send("Browser.getWindowForTarget", { targetId: tab.id });
    await send("Browser.setWindowBounds", { windowId, bounds: { width: 1280, height: 900 } });
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, screenWidth: 1280, screenHeight: 900, positionX: 0, positionY: 0, deviceScaleFactor: 1, mobile: false });
    await load();
    assert.equal(await read("innerWidth"), 1280);
    assert.equal(await read("document.documentElement.scrollWidth <= innerWidth"), true);
    assert.deepEqual(await selected(), ["", "", "", ""]);
    assert.equal(await read("document.querySelector('.operator-slot[aria-pressed=true]').dataset.sample"), "B");
    assert.equal(await read("document.querySelectorAll('.operator-key').length"), 2);
    assert.equal(await read("document.querySelectorAll('input,textarea,[contenteditable=true],a').length"), 0);
    await screenshot("desktop-initial");
    if (process.argv.includes("--capture-record-mobile")) {
      await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      await load();
      await fill(["≠", "=", "≠", "≠"]);
      await success();
      await waitFor("!document.getElementById('open-original-record').hidden");
      await click("#open-original-record");
      await waitFor("!document.getElementById('open-decoded-record').hidden", 100, 16000);
      await screenshot("mobile-390-decoding-ready");
      await click("#open-decoded-record");
      await screenshot("mobile-390-decoded-record");
      assert.equal(await read("document.documentElement.scrollWidth <= innerWidth"), true);
      console.log("PASS: 390px ready notification and Morse screenshots captured without full-page RTL cropping.");
      return;
    }
    if (process.argv.includes("--duplicate-record")) {
      await fill(["≠", "=", "≠", "≠"]);
      await success();
      await waitFor("!document.getElementById('open-original-record').hidden");
      await click("#open-original-record", 2);
      assert.equal(await read("activeView"), "original-record-view");
      assert.equal(await read("decodingGeneration"), 1);
      assert.equal(await read("document.querySelectorAll('#corruption-notice').length"), 1);
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
      await delay(700);
      assert.equal(await read("decodingGeneration"), 1);
      await click("#back-to-result");
      assert.equal(await read("decodingTimer === null"), true);
      console.log("PASS: normal record-button double click creates one decoding generation and one dialog; leaving cancels its timer.");
      return;
    }
    if (process.argv.includes("--capture-desktop")) {
      console.log("Desktop bounds:", await read("document.querySelector('.laboratory').getBoundingClientRect().toJSON()"));
      await fill(["≠", "=", "≠", "≠"]);
      await success(true);
      return;
    }
    await click(".operator-slot[data-sample='B']");
    await send("Input.insertText", { text: "= arbitrary" });
    await press("=", "Equal", 187, "=");
    assert.deepEqual(await selected(), ["", "", "", ""]);
    await press("Tab", "Tab", 9);
    await press(" ", "Space", 32, " ");
    assert.equal(await read("document.querySelector('.operator-slot[aria-pressed=true]').dataset.sample"), "C");
    await press("Enter", "Enter", 13, "\r");
    await click("#submit-result");
    assert.equal(await read("document.getElementById('comparison-error').textContent"), incomplete);
    await click(".operator-key[data-operator='=']");
    assert.equal(await read("document.querySelector('.operator-slot[aria-pressed=true]').dataset.sample"), "D");
    await click("#submit-result");
    assert.equal(await read("document.getElementById('comparison-error').textContent"), incomplete);
    assert.deepEqual(await selected(), ["", "=", "", ""]);

    let matches = 0;
    for (let combination = 0; combination < 16; combination++) {
      await load();
      const choices = Array.from({ length: 4 }, (_, index) => combination & (1 << index) ? "=" : "≠");
      await fill(choices);
      assert.deepEqual(await selected(), choices);
      assert.deepEqual(await hiddenResults(), [true, true, true]);
      // Replacement uses the same real slot and keypad controls.
      await click(".operator-slot[data-sample='B']");
      await click(`.operator-key[data-operator='${choices[0] === "=" ? "≠" : "="}']`);
      assert.notDeepEqual(await selected(), choices);
      await click(`.operator-key[data-operator='${choices[0]}']`);
      assert.deepEqual(await selected(), choices);
      if (combination === 2) {
        await success(true);
        matches++;
      } else {
        await click("#submit-result");
        assert.equal(await read("document.getElementById('comparison-error').textContent"), mismatch);
        assert.deepEqual(await selected(), choices);
        assert.deepEqual(await hiddenResults(), [true, true, true]);
        assert.equal(await read("document.querySelectorAll('button:disabled').length"), 0);
      }
    }
    assert.equal(matches, 1);
    console.log("PASS: all 16 complete combinations; exactly one match. Initial state, incomplete errors, corrections, retained selections, typed-text rejection and keyboard activation passed.");

    for (const width of [360, 390]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: false });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      await load();
      assert.equal(await read("innerWidth"), width);
      assert.equal(await read("document.documentElement.scrollWidth <= innerWidth"), true);
      const sizes = await read("[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height}})");
      assert(sizes.every((size) => size.width >= 44 && size.height >= 44 && size.width <= width));
      await screenshot(`mobile-${width}-initial`);
      const submitPosition = await read("document.getElementById('submit-result').getBoundingClientRect().top + scrollY");
      await fill(["≠", "≠", "≠", "≠"]);
      await click("#submit-result");
      assert.equal(await read("document.getElementById('comparison-error').textContent"), mismatch);
      assert.equal(await read("document.getElementById('submit-result').getBoundingClientRect().top + scrollY"), submitPosition);
      await fill(["≠", "=", "≠", "≠"]);
      await success();
      assert.equal(await read("document.documentElement.scrollWidth <= innerWidth"), true);
      await click("#warning-output");
      await screenshot(`mobile-${width}-result`);
    }
    const verifyRecordFlow = async (mobile = false) => {
      const prefix = mobile ? "mobile-390" : "desktop";
      const title = "سامانه بایگانی و ثبت الگوهای ژنتیکی نمونههای زیستی";
      assert.equal(await read("document.querySelector('.institution-title').textContent"), title);
      assert.equal(await read("document.querySelector('.lab-mark').getBoundingClientRect().left >= document.querySelector('.lab-title-block').getBoundingClientRect().right"), true);
      await screenshot(`${prefix}-header`);
      await fill(["≠", "=", "≠", "≠"]);
      await success();
      const warningShown = Date.now();
      assert.equal(await read("document.getElementById('open-original-record').hidden"), true);
      await delay(1500);
      assert.equal(await read("document.getElementById('open-original-record').hidden"), true);
      const actionTime = await waitFor("!document.getElementById('open-original-record').hidden");
      assert(actionTime - warningShown >= 1800 && actionTime - warningShown <= 2700);
      assert.equal(await read("document.getElementById('warning-output').hidden"), false);
      await screenshot(`${prefix}-record-action`);

      // Leave an unfinished attempt and verify that it cannot update the result view.
      await click("#open-original-record");
      await click("#corruption-notice");
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
      assert.equal(await read("document.querySelectorAll('#corruption-notice').length"), 1);
      assert.equal(await read("document.getElementById('database-view').inert"), true);
      assert.equal(await read("document.activeElement.id"), "corruption-notice");
      const centered = await read("(()=>{const a=document.querySelector('.record-shell').getBoundingClientRect(),b=document.querySelector('.corruption-notice').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<2&&Math.abs(a.y+a.height/2-b.y-b.height/2)<2})()");
      assert.equal(centered, true);
      await screenshot(`${prefix}-decoding`);
      await delay(1000);
      await click("#back-to-result");
      const statusAfterExit = await read("document.getElementById('record-status').textContent");
      assert.equal(await read("decodingTimer === null"), true);
      // Wait past the abandoned deadline while the player stays in results.
      await delay(14500);
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
      assert.equal(await read("document.getElementById('record-status').textContent"), statusAfterExit);
      assert.deepEqual(await hiddenResults(), [false, false, false]);

      const decodingStart = Date.now();
      await click("#open-original-record", 2);
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
      assert.equal(await read("document.getElementById('corruption-title').textContent"), "File corrupted");
      assert.equal(await read("document.getElementById('corruption-description').textContent"), "Decoding required");
      await delay(13500);
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
      const readyTime = await waitFor("!document.getElementById('open-decoded-record').hidden", 40, 4000);
      assert(readyTime - decodingStart >= 14900 && readyTime - decodingStart <= 16000);
      assert.equal(await read("getComputedStyle(document.querySelector('.ring-segments')).animationName"), "none");
      assert.equal(await read("document.getElementById('corruption-title').textContent"), "File corrupted");
      await screenshot(`${prefix}-decoding-ready`);
      await click("#open-decoded-record");
      assert.equal(await read("document.getElementById('decoded-record-view').hidden"), false);
      assert.equal(await read("document.activeElement.id"), "decoded-record-title");
      const morse = await read("document.getElementById('morse-message').textContent");
      assert.match(morse, /^[.\-/ ]+$/);
      // Independent reverse mapping from ITU-R M.1677-1, not application code.
      const reverse = { "-": "T", ".-": "A", "-.-": "K", ".": "E", "....": "H", "-.--": "Y", "-.": "N", "-..": "D", "..-.": "F", "..": "I", "-.-.": "C" };
      const decoded = morse.split(" / ").map(word => word.split(" ").map(letter => {
        assert(reverse[letter], `Unknown Morse letter ${letter}`);
        return reverse[letter];
      }).join("")).join(" ");
      assert.equal(decoded, "TAKE THE KEY AND FIND THE CHAIN IN THE KITCHEN");
      assert.equal(await read("document.documentElement.scrollWidth <= innerWidth"), true);
      await screenshot(`${prefix}-decoded-record`);
      await click("#back-to-original");
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), false);
      assert.equal(await read("decodingTimer === null"), true);
      assert.equal(await read("document.activeElement.id"), "open-decoded-record");
      await click("#back-to-result");
      assert.deepEqual(await hiddenResults(), [false, false, false]);
      await click("#open-original-record");
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), false);
      assert.equal(await read("decodingTimer === null"), true);
      await click("#back-to-result");
      console.log(`PASS ${prefix}: warning reading delay ${actionTime - warningShown}ms; decoding ${readyTime - decodingStart}ms; cancellation beyond old deadline; exact independently decoded Morse; preserved completion, focus, result and explicit navigation.`);
    };
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, screenWidth: 1280, screenHeight: 900, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await load();
    await verifyRecordFlow();
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await load();
    await verifyRecordFlow(true);
    assert.equal(errors.length, 0);
    console.log("PASS: desktop and 360px/390px layouts, timed staged results, exact copy, duplicate-submit protection, disabled controls, reduced-motion sequence, no horizontal overflow or runtime exceptions. Screenshots saved under .local-verification/entry-2/.");
  } finally { socket.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
