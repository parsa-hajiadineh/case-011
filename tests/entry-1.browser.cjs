"use strict";

// Real Chromium checks through CDP. Launch an isolated local browser on port 9223.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.resolve(__dirname, "../.local-verification/entry-1");

async function main() {
  const tabs = await (await fetch("http://127.0.0.1:9223/json/list")).json();
  const tab = tabs.find((item) => item.type === "page" && /about:blank|localhost:8000\//.test(item.url));
  assert(tab, "An isolated test tab must be available");
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = ({ data }) => {
    const result = JSON.parse(data);
    if (result.method === "Runtime.exceptionThrown") errors.push(result.params.exceptionDetails);
    if (!result.id) return;
    const call = pending.get(result.id);
    pending.delete(result.id);
    if (result.error) call.reject(new Error(JSON.stringify(result.error)));
    else call.resolve(result.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (selector) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
  };
  const screenshot = async (name) => {
    fs.mkdirSync(output, { recursive: true });
    const result = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(result.data, "base64"));
  };
  const state = () => evaluate(`(()=>{const ids=['open-evidence','selected-documents','sound-toggle'];return{views:[...document.querySelectorAll('main > section')].map(e=>({id:e.id,hidden:e.hidden,inert:e.inert})),controls:ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{id,disabled:e.disabled,hidden:e.hidden,width:r.width,height:r.height,x:r.x,y:r.y,display:s.display,flex:s.flex,minHeight:s.minHeight,parent:e.parentElement.id||e.parentElement.className}}),unlocked:documentsUnlocked,soundCount:document.querySelectorAll('#sound-toggle').length}})()`);
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    if (process.argv.includes("--audio-failures")) {
      await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
      for (const [name, source] of [
        ["unsupported", "window.AudioContext=undefined;window.webkitAudioContext=undefined;"],
        ["rejected", "AudioContext.prototype.resume=()=>Promise.reject(new Error('Blocked activation test'));"],
      ]) {
        const injection = await send("Page.addScriptToEvaluateOnNewDocument", { source });
        const previousDocument = await evaluate("performance.timeOrigin");
        await send("Page.navigate", { url: "http://localhost:8000/entry-1/" });
        await waitFor(`performance.timeOrigin!==${previousDocument} && document.readyState==='complete'`);
        await delay(1100);
        const point = await evaluate("(()=>{const r=document.getElementById('sound-toggle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
        await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{...point,radiusX:5,radiusY:5,force:1}] });
        await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitFor("document.getElementById('sound-status').textContent.length>0");
        assert.equal(await evaluate("document.getElementById('sound-toggle').getAttribute('aria-pressed')"), "false");
        assert.equal(await evaluate("document.getElementById('sound-label').textContent"), "صدا خاموش");
        assert.equal(await evaluate("getComputedStyle(document.getElementById('sound-status')).display !== 'none'"), true);
        await screenshot(`touch-audio-${name}`);
        await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
        console.log(`PASS ${name}: touch activation retains muted UI and displays readable Persian error.`);
      }
      await send("Emulation.setTouchEmulationEnabled", { enabled: false });
      assert.equal(errors.length, 0);
      return;
    }
    if (process.argv.includes("--touch-flow")) {
      if (process.argv.includes("--fallback-dialog")) {
        await send("Page.addScriptToEvaluateOnNewDocument", { source: "HTMLDialogElement.prototype.showModal=undefined;" });
      }
      await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
      const tap = async (selector) => {
        await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
        const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,hit:e.contains(document.elementFromPoint(x,y)),pointer:getComputedStyle(e).pointerEvents}})()`);
        assert.equal(point.hit, true, `${selector}: no overlapping hit target`);
        assert.notEqual(point.pointer, "none");
        await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y, radiusX: 5, radiusY: 5, force: 1 }] });
        await delay(70);
        await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      };
      for (const width of [360,390]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: width === 360 ? 640 : 844, deviceScaleFactor: 1, mobile: true });
        const previousDocument = await evaluate("performance.timeOrigin");
        await send("Page.navigate", { url: "http://localhost:8000/entry-1/" });
        await waitFor(`performance.timeOrigin!==${previousDocument} && document.readyState==='complete' && !!document.getElementById('sound-toggle')`);
        await delay(1100);
        assert.equal(await evaluate("navigator.maxTouchPoints"), 1);
        assert.equal(await evaluate("matchMedia('(hover:hover)').matches"), false);
        await tap("#sound-toggle");
        await waitFor("document.getElementById('sound-toggle').getAttribute('aria-pressed')==='true' && audioContext.state==='running'");
        assert.equal(await evaluate("document.getElementById('sound-label').textContent"), "صدا روشن");
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.sound-enabled-icon')).display"), "block");
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.sound-muted-icon')).display"), "none");
        await tap("#sound-toggle");
        await waitFor("!soundEnabled && audioContext.state==='suspended'");
        assert.equal(await evaluate("document.getElementById('sound-label').textContent"), "صدا خاموش");
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.sound-enabled-icon')).display"), "none");
        await tap("#sound-toggle");
        await waitFor("soundEnabled && audioContext.state==='running'");
        await tap("#archive-number");
        await send("Input.insertText", { text: "0806" });
        await tap("#submit-button");
        await waitFor("!document.getElementById('destination-view').hidden");
        assert.equal(await evaluate("document.getElementById('selected-documents').hasAttribute('disabled')"), false);
        await tap("#selected-documents");
        await waitFor("document.getElementById('locked-documents-dialog').open");
        assert.equal(await evaluate("document.getElementById('locked-documents-message').textContent"), "این دکمه توسط کاراگاه در این مرحله قفل شده است.");
        assert.equal(await evaluate("document.getElementById('document-categories').hidden"), true);
        assert.equal(await evaluate("document.activeElement.id"), "confirm-locked-documents");
        const modalBounds = await evaluate("(()=>{const r=document.getElementById('locked-documents-dialog').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()");
        assert(modalBounds.left >= 0 && modalBounds.right <= modalBounds.width && modalBounds.top >= 0 && modalBounds.bottom <= modalBounds.height);
        if (process.argv.includes("--fallback-dialog")) {
          assert.equal(await evaluate("getComputedStyle(document.getElementById('locked-documents-dialog')).position"), "fixed");
          assert.equal(await evaluate("document.getElementById('locked-dialog-backdrop').hidden"), false);
          await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
          await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
          assert.equal(await evaluate("document.activeElement.id"), "confirm-locked-documents");
        }
        await screenshot(`touch-${width}-locked-dialog`);
        await tap("#confirm-locked-documents");
        await waitFor("!document.getElementById('locked-documents-dialog').open");
        assert.equal(await evaluate("document.activeElement.id"), "selected-documents");
        await tap("#selected-documents");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await waitFor("!document.getElementById('locked-documents-dialog').open");
        assert.equal(await evaluate("document.activeElement.id"), "selected-documents");
        await tap("#open-evidence");
        await waitFor("!document.getElementById('evidence-view').hidden");
        assert.equal(await evaluate("document.getElementById('selected-documents').getAttribute('aria-disabled')"), "true");
        await tap("#return-suspects");
        await waitFor("document.getElementById('selected-documents').getAttribute('aria-disabled')==='false'");
        await tap("#selected-documents");
        assert.equal(await evaluate("document.getElementById('document-categories').hidden"), false);
        await tap("#category-nora");
        assert.equal(await evaluate("soundEnabled && audioContext.state==='running'"), true);
        await tap("#sound-toggle");
        await waitFor("!soundEnabled && audioContext.state==='suspended'");
        assert.equal(errors.length, 0);
        console.log(`PASS touch ${width}: real touch events, hit targets, sound on/off, locked modal/focus, evidence unlock, categories and audio preference; no runtime errors.`);
      }
      await send("Emulation.setTouchEmulationEnabled", { enabled: false });
      return;
    }
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://localhost:8000/entry-1/" });
    await waitFor("!!document.getElementById('archive-number')");
    await delay(1100);
    await screenshot("desktop-archive");
    if (process.argv.includes("--archive-only")) {
      for (const [width, height] of [[360,640],[390,844],[390,500]]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
        const layout = await evaluate("(()=>{const a=document.querySelector('.archive-visual').getBoundingClientRect(),i=document.getElementById('archive-number').getBoundingClientRect();return{artwork:a.height,input:i.height,overflow:document.documentElement.scrollWidth>innerWidth}})()");
        assert(layout.artwork >= 90 && layout.artwork <= 120);
        assert.equal(layout.input, 64);
        assert.equal(layout.overflow, false);
        await screenshot(`archive-${width}x${height}`);
      }
      console.log("PASS: mobile archive artwork, full-size input, no horizontal overflow at 360x640, 390x844, and short 390x500.");
      return;
    }
    await click("#archive-number");
    await send("Input.insertText", { text: "0806" });
    await click("#submit-button");
    await waitFor("!document.getElementById('destination-view').hidden");
    const initialState = await state();
    console.log("INITIAL", JSON.stringify(initialState));
    for (const control of initialState.controls.slice(0, 2)) {
      assert.equal(control.height, 48);
      assert(control.width < 300);
    }
    assert(initialState.controls[0].x > initialState.controls[1].x);
    assert.equal(initialState.controls[0].y, initialState.controls[1].y);
    assert.equal(initialState.controls[2].height, 44);
    assert(initialState.controls[2].y > 0 && initialState.controls[2].y < 900);
    assert.equal(await evaluate("getComputedStyle(document.getElementById('selected-documents')).backgroundColor"), "rgb(53, 35, 44)");
    assert.equal(await evaluate("getComputedStyle(document.getElementById('documents-lock')).color"), "rgb(241, 160, 156)");
    assert.equal(await evaluate("document.getElementById('documents-lock-label')"), null);
    assert.equal(await evaluate("document.getElementById('return-categories')"), null);
    await click("#selected-documents");
    assert.equal(await evaluate("document.getElementById('document-categories').hidden"), true);
    assert.equal(await evaluate("document.getElementById('locked-documents-dialog').open"), true);
    assert.equal(await evaluate("document.getElementById('locked-documents-message').textContent"), "این دکمه توسط کاراگاه در این مرحله قفل شده است.");
    assert.equal(await evaluate("document.activeElement.id"), "confirm-locked-documents");
    await screenshot("desktop-locked-dialog");
    await click("#confirm-locked-documents");
    await waitFor("!document.getElementById('locked-documents-dialog').open");
    assert.equal(await evaluate("document.activeElement.id"), "selected-documents");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate("document.getElementById('locked-documents-dialog').open"), true);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor("!document.getElementById('locked-documents-dialog').open");
    assert.equal(await evaluate("document.activeElement.id"), "selected-documents");
    assert.equal(await evaluate("document.getElementById('document-categories').hidden"), true);
    await screenshot("desktop-actions-locked");
    await click("#open-evidence");
    await waitFor("!document.getElementById('evidence-view').hidden");
    console.log("EVIDENCE", JSON.stringify(await state()));
    await click("#return-suspects");
    await waitFor("!document.getElementById('destination-view').hidden");
    console.log("RETURN", JSON.stringify(await state()));
    console.log("ERRORS", JSON.stringify(errors));
    assert.equal(await evaluate("document.getElementById('selected-documents').disabled"), false);
    assert.equal(await evaluate("document.getElementById('selected-documents').getAttribute('aria-disabled')"), "false");
    assert.equal(await evaluate("getComputedStyle(document.getElementById('documents-lock')).display"), "none");
    assert.equal(await evaluate("getComputedStyle(document.getElementById('selected-documents')).backgroundColor"), "rgb(37, 67, 55)");
    await screenshot("desktop-actions-unlocked");
    await evaluate("window.scrollTo({top:0,behavior:'instant'})");
    await screenshot("desktop-heading");
    const key = async (value, code) => {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: value, code, windowsVirtualKeyCode: value === "Enter" ? 13 : 9, ...(value === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: value, code, windowsVirtualKeyCode: value === "Enter" ? 13 : 9 });
    };
    await click("#sound-toggle");
    await waitFor("soundEnabled && audioContext.state === 'running'");
    await evaluate("window.testAudioContext = audioContext");
    await click("#selected-documents");
    assert.equal(await evaluate("document.getElementById('document-categories').hidden"), false);
    assert.equal(await evaluate("document.activeElement.id"), "selected-documents");
    await key("Enter", "Enter");
    assert.equal(await evaluate("document.getElementById('document-categories').hidden"), true);
    await key("Enter", "Enter");
    assert.equal(await evaluate("document.getElementById('document-categories').hidden"), false);
    const mappings = [
      ["nora", ["nora-fingerprint-forensic-report.pdf", "nora-local-inquiry-report.pdf"]],
      ["arash", ["arash-telecom-record.pdf"]],
      ["kamran", ["kamran-telecom-record.pdf", "cctv-footage-review-report.pdf"]]
    ];
    for (const [category, files] of mappings) {
      await click(`#category-${category}`);
      await waitFor("!document.getElementById('category-view').hidden");
      assert.equal(await evaluate("document.querySelectorAll('#document-list > li').length"), files.length);
      assert.equal(await evaluate("document.querySelectorAll('#category-view .document-navigation button').length"), 1);
      assert.equal(await evaluate("document.querySelectorAll('#pdf-view .document-navigation button').length"), 2);
      await click("#return-category");
      assert.equal(await evaluate("document.getElementById('document-categories').hidden"), false);
      assert.equal(await evaluate("document.getElementById('selected-documents').disabled"), false);
      await click(`#category-${category}`);
      const order = category === "kamran" ? [1, 0] : files.map((_, index) => index);
      for (const i of order) {
        await waitFor("document.querySelectorAll('#document-list button:not(:disabled)').length === " + files.length);
        await click(`#document-list > li:nth-child(${i + 1}) button`);
        await waitFor("!document.getElementById('pdf-view').hidden");
        assert.equal(await evaluate("document.querySelector('#pdf-container iframe').getAttribute('src')"), "assets/evidence/" + files[i]);
        assert.equal(await evaluate("document.getElementById('pdf-link').getAttribute('href')"), "assets/evidence/" + files[i]);
        assert.equal(await evaluate("audioContext === window.testAudioContext && soundEnabled"), true);
        if (category === "nora" && i === 0) {
          await delay(1200);
          await screenshot("desktop-pdf");
        }
        for (const size of await evaluate("[...document.querySelectorAll('#pdf-view .document-navigation button')].map(e=>e.getBoundingClientRect().height)")) assert.equal(size, 48);
        await click("#return-document-list");
        assert.equal(await evaluate("document.getElementById('category-view').hidden"), false);
        assert.equal(await evaluate("document.activeElement.id"), `document-${category}-${i}`);
        assert.equal(await evaluate("document.querySelector('#pdf-container iframe') === null"), true);
        assert.equal(await evaluate("audioContext === window.testAudioContext && soundEnabled"), true);
        assert.equal(await evaluate("document.getElementById('selected-documents').disabled"), false);
      }
      await click("#document-list button");
      await click("#return-pdf");
      assert.equal(await evaluate("document.getElementById('destination-view').hidden"), false);
      await click(`#category-${category}`);
      await click("#return-category");
      assert.equal(await evaluate("document.getElementById('destination-view').hidden"), false);
    }
    await click("#sound-toggle");
    await waitFor("!soundEnabled && audioContext.state === 'suspended'");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await send("Page.reload");
    await waitFor("!!document.getElementById('archive-number') && !document.getElementById('access-view').hidden");
    await delay(1100);
    await screenshot("mobile-390-archive");
    await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 640, deviceScaleFactor: 1, mobile: false });
    await screenshot("mobile-360-archive");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    const artwork = await evaluate("document.querySelector('.archive-visual').getBoundingClientRect().height");
    assert(artwork >= 90 && artwork <= 120);
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await click("#archive-number");
    await send("Input.insertText", { text: "0806" });
    await click("#submit-button");
    await waitFor("!document.getElementById('destination-view').hidden");
    await screenshot("mobile-heading");
    assert.equal(await evaluate("document.getElementById('selected-documents').disabled"), false);
    assert.equal(await evaluate("document.getElementById('selected-documents').getAttribute('aria-disabled')"), "true");
    await click("#selected-documents");
    assert.equal(await evaluate("document.getElementById('document-categories').hidden"), true);
    await screenshot("mobile-actions-locked");
    await click("#confirm-locked-documents");
    await click("#open-evidence");
    await key("Tab", "Tab");
    // The visible sound button follows the title in the focus order.
    assert.equal(await evaluate("document.activeElement.id"), "sound-toggle");
    await click("#return-suspects");
    assert.equal(await evaluate("document.getElementById('selected-documents').disabled"), false);
    const mobileState = await state();
    for (const control of mobileState.controls.slice(0, 2)) {
      assert.equal(control.height, 48);
      assert(control.width <= 390);
    }
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await screenshot("mobile-actions-unlocked");
    await click("#selected-documents");
    await click("#category-kamran");
    await waitFor("document.querySelectorAll('#document-list button:not(:disabled)').length === 2");
    await screenshot("mobile-document-list");
    for (const i of [1, 0]) {
      await click(`#document-list > li:nth-child(${i + 1}) button`);
      await waitFor("!document.getElementById('pdf-view').hidden");
      assert.equal(await evaluate("document.querySelector('#pdf-container iframe').getAttribute('src')"), "assets/evidence/" + (i === 1 ? "cctv-footage-review-report.pdf" : "kamran-telecom-record.pdf"));
      for (const size of await evaluate("[...document.querySelectorAll('#pdf-view .document-navigation button')].map(e=>e.getBoundingClientRect().height)")) assert.equal(size, 48);
      await screenshot("mobile-pdf-navigation");
      await click("#return-document-list");
      assert.equal(await evaluate("document.getElementById('category-view').hidden"), false);
    }
    await click("#return-category");
    assert.equal(await evaluate("document.getElementById('document-categories').hidden"), false);
    await click("#category-arash");
    await click("#return-category");
    await click("#category-arash");
    await waitFor("!!document.querySelector('#document-list button:not(:disabled)')");
    await click("#document-list button");
    await waitFor("!document.getElementById('pdf-view').hidden");
    await click("#return-pdf");
    assert.equal(await evaluate("document.getElementById('selected-documents').disabled"), false);
    assert.equal(await evaluate("document.querySelectorAll('#sound-toggle').length"), 1);
    assert.equal(errors.length, 0);
    console.log("PASS: real Edge clicks, red lock without status label, evidence-return unlock, keyboard expansion, all five PDFs and originating-list returns, CCTV to Kamran telecom, category/PDF suspect shortcuts, single category return and both PDF returns, sound preference/context, reload reset, desktop/390px navigation.");
  } finally { socket.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
