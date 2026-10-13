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
  const verifyCompactProcessing = async () => {
    const observations = [];
    const cases = [
      { width: 1280, height: 900, record: true, name: "desktop" },
      { width: 360, height: 640, name: "mobile-360x640" },
      { width: 390, height: 844, record: true, name: "mobile-390x844" },
      { width: 844, height: 390, name: "landscape-844x390" },
      { width: 390, height: 844, reduced: true, record: true, name: "mobile-reduced" },
      { width: 390, height: 844, reduced: true, largeText: true, name: "mobile-text-200" }
    ];
    const visibleOutput = () => read("(()=>{const r=document.querySelector('.output-panel').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()");
    const activeCases = process.argv.includes("--measure-current") ? cases.filter(scenario => ["mobile-360x640", "mobile-390x844", "mobile-reduced"].includes(scenario.name)) : cases;
    for (const scenario of activeCases) {
      await send("Emulation.setDeviceMetricsOverride", { width: scenario.width, height: scenario.height, screenWidth: scenario.width, screenHeight: scenario.height, deviceScaleFactor: 1, mobile: false });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: scenario.reduced ? "reduce" : "no-preference" }] });
      await load();
      if (scenario.largeText) {
        // Rendering stress only: no choices, result state, or timers are modified.
        await send("DOM.enable");
        await send("CSS.enable");
        const { root } = await send("DOM.getDocument");
        const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "html" });
        await send("CSS.setEffectivePropertyValueForNode", { nodeId, propertyName: "font-size", value: "200%" });
        assert.equal(await read("getComputedStyle(document.documentElement).fontSize"), "32px");
      }
      assert.equal(await read("document.documentElement.scrollWidth <= innerWidth"), true);
      if (scenario.width <= 900) {
        assert.equal(await read("document.querySelector('.output-panel').getBoundingClientRect().bottom < document.querySelector('.comparison-panel').getBoundingClientRect().top"), true);
      } else {
        assert.equal(await read("Math.abs(document.querySelector('.output-panel').getBoundingClientRect().top-document.querySelector('.comparison-panel').getBoundingClientRect().top)<2"), true);
      }
      await delay(650);
      if (scenario.width <= 900 && !scenario.largeText && scenario.height >= 640) {
        assert.equal(await read("document.querySelector('.comparison-panel').getBoundingClientRect().bottom <= innerHeight - parseFloat(getComputedStyle(document.querySelector('.laboratory')).paddingBottom) + 1"), true);
        assert(await read("document.querySelector('.comparison-panel').getBoundingClientRect().height") > (scenario.height === 640 ? 410 : 550));
      }
      if (process.argv.includes("--measure-current")) console.log("PANEL MEASUREMENT", scenario.name, await read("(()=>{const measure=selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return{height:r.height,top:r.top,bottom:r.bottom,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight}};return{viewport:innerHeight,header:measure('.lab-header'),input:measure('.comparison-panel'),output:measure('.output-panel'),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}})()"));
      await screenshot(`${scenario.name}-compact-initial`);
      for (let index = 0; index < 4; index++) {
        await click(`.operator-slot[data-sample='${"BCDE"[index]}']`);
        if (scenario.width <= 900) {
          assert.equal(await visibleOutput(), true);
          assert.equal(await read(`document.querySelector(".operator-slot[data-sample='${"BCDE"[index]}']").getBoundingClientRect().top >= document.querySelector('.output-panel').getBoundingClientRect().bottom`), true);
          assert.equal(await read(`(()=>{const r=document.querySelector(".operator-slot[data-sample='${"BCDE"[index]}']").getBoundingClientRect(),p=document.querySelector('.comparison-panel').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom})()`), true);
        }
        await click(`.operator-key[data-operator='${index === 1 ? "=" : "≠"}']`);
        if (scenario.width <= 900) assert.equal(await visibleOutput(), true);
      }
      assert.deepEqual(await hiddenResults(), [true, true, true]);
      await click("#submit-result");
      const pageScroll = await read("scrollY");
      for (const section of ["match-output", "reference-output", "warning-output", "open-original-record"]) {
        await waitFor(`!document.getElementById('${section}').hidden`);
        assert.equal(await read("scrollY"), pageScroll);
        if (scenario.width <= 900) {
          assert.equal(await visibleOutput(), true);
          assert.equal(await read(`(()=>{const r=document.getElementById('${section}').getBoundingClientRect(),p=document.getElementById('output-scroll').getBoundingClientRect();return r.top<p.bottom&&r.bottom>p.top})()`), true);
        }
      }
      assert.deepEqual(await hiddenResults(), [false, false, false]);
      assert.equal(await read("document.querySelector('#warning-output p').textContent"), warning);
      assert.equal(await read("document.getElementById('reference-output').textContent"), "Reference C: NORA AZARGOSHASB");
      if (scenario.width <= 900) {
        // Real wheel input can revisit earlier output without scrolling the page.
        const point = await read("(()=>{const r=document.querySelector('#output-scroll').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
        await send("Input.dispatchMouseEvent", { type: "mouseWheel", deltaY: -1500, deltaX: 0, ...point });
        await delay(200);
        assert.equal(await read("document.getElementById('output-scroll').scrollTop"), 0);
        assert.equal(await read("scrollY"), pageScroll);
        await send("Input.dispatchMouseEvent", { type: "mouseWheel", deltaY: 1500, deltaX: 0, ...point });
        await delay(200);
        assert.equal(await read("scrollY"), pageScroll);
      }
      assert.equal(await read("document.documentElement.scrollWidth <= innerWidth"), true);
      await screenshot(`${scenario.name}-compact-result`);
      console.log(`PASS ${scenario.name}: output stays visible during input, internal staged scrolling leaves page at ${pageScroll}px, earlier result sections reachable, no horizontal overflow.`);
      if (scenario.width <= 900) assert.equal(await read("(()=>{const p=document.querySelector('#output-scroll').getBoundingClientRect(),b=document.querySelector('#open-original-record').getBoundingClientRect();return b.top>=p.top&&b.bottom<=p.bottom})()"), true);
      if (!scenario.record || process.argv.includes("--layout-only")) continue;
      assert.equal(await read("document.querySelector('.decoding-emblem').getAnimations({subtree:true}).length"), 0);
      const started = Date.now();
      await click("#open-original-record", 2);
      await click("#corruption-notice");
      assert.equal(await read("decodingGeneration"), 1);
      assert.equal(await read("document.querySelectorAll('#corruption-notice').length"), 1);
      const status = await read("document.getElementById('record-status').textContent");
      const recordFrames = async () => {
        const directory = path.join(output, `motion-${scenario.name}-${process.argv.includes("--measure-current") ? "before" : "after"}`);
        fs.mkdirSync(directory, { recursive: true });
        const recordingStart = Date.now();
        for (let index = 0; index < 40; index++) {
          await delay(Math.max(0, index * 200 - (Date.now() - recordingStart)));
          const crop = await read("(()=>{const r=document.querySelector('.corruption-notice').getBoundingClientRect();return{x:r.x,y:r.y,width:Math.ceil(r.width),height:Math.ceil(r.height),scale:1}})()");
          const frame = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, clip: crop });
          fs.writeFileSync(path.join(directory, `frame-${String(index).padStart(3, "0")}.png`), Buffer.from(frame.data, "base64"));
        }
      };
      const recording = process.argv.includes("--record-motion") ? recordFrames() : Promise.resolve();
      for (const at of [700, 4100, 8300, 12400]) {
        await delay(Math.max(0, at - (Date.now() - started)));
        const state = await read("(()=>{const styles=selector=>{const s=getComputedStyle(document.querySelector(selector));return{name:s.animationName,duration:s.animationDuration,iterations:s.animationIterationCount,state:s.animationPlayState,origin:s.transformOrigin,box:s.transformBox,transform:s.transform,opacity:s.opacity}};return{emblem:styles('.decoding-emblem'),outer:styles('.emblem-ring-outer'),middle:styles('.emblem-ring-middle'),inner:styles('.emblem-ring-inner'),sweep:styles('.core-sweep'),light:styles('.core-light'),nodes:[...document.querySelectorAll('.processing-node')].map(e=>getComputedStyle(e).opacity),animations:document.querySelector('.decoding-emblem').getAnimations({subtree:true}).map(e=>({state:e.playState,time:e.currentTime,duration:e.effect.getTiming().duration,keyframes:e.effect.getKeyframes()})),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}})()");
        observations.push({ scenario: scenario.name, elapsed: Date.now() - started, ...state });
        assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
        assert.equal(await read("document.getElementById('record-status').textContent"), status);
        if (scenario.reduced) {
          assert.equal(state.outer.name, "none");
          assert.equal(state.middle.name, "none");
          assert.equal(state.sweep.name, "none");
          assert.equal(state.light.name, "emblem-light");
          assert.equal(state.emblem.name, "emblem-reduced-light");
        } else {
          assert.equal(state.outer.name, "emblem-rotate");
          assert.equal(state.middle.name, "emblem-rotate");
          assert.equal(state.outer.state, "running");
          assert.equal(state.outer.duration, "6s");
          assert.equal(state.middle.duration, "4.3s");
          assert.equal(state.inner.duration, "3.1s");
          assert.equal(state.outer.box, "view-box");
          assert.equal(state.outer.origin, "60px 60px");
          assert.equal(state.sweep.name, "emblem-scan");
          assert(state.animations.length >= 8);
          assert(state.animations.every(animation => animation.state === "running"));
        }
        await screenshot(`${scenario.name}-emblem-${at}`);
      }
      const frames = observations.filter(frame => frame.scenario === scenario.name);
      await recording;
      assert(new Set(frames.map(frame => frame.light.opacity)).size > 2);
      if (scenario.reduced) assert(new Set(frames.map(frame => frame.emblem.opacity)).size > 2);
      if (!scenario.reduced) {
        for (const element of ["outer", "middle", "inner", "sweep"]) assert(new Set(frames.map(frame => frame[element].transform)).size === 4);
        assert(new Set(frames.map(frame => JSON.stringify(frame.nodes))).size > 2);
      }
      const completed = await waitFor("!document.getElementById('open-decoded-record').hidden", 40, 4000);
      assert(completed - started >= 14900 && completed - started < 16000);
      assert.equal(await read("document.querySelector('.decoding-emblem').getAnimations({subtree:true}).length"), 0);
      await screenshot(`${scenario.name}-emblem-complete`);
      await click("#open-decoded-record");
      assert.equal(await read("document.getElementById('decoded-record-view').hidden"), false);
      assert.equal(await read("document.querySelectorAll('#decoded-record-view button').length"), 0);
      assert.equal(await read("document.querySelector('#decoded-record-view .record-toolbar').textContent.trim()"), "DECODED RECORD");
      assert.equal(await read("document.querySelectorAll('#decoded-record-view .record-identifier').length"), 0);
      assert.equal(await read("document.querySelector('.lab-header .case-identifier').textContent"), "CASE 011");
      const morse = await read("document.getElementById('morse-message').textContent");
      const reverse = { "-": "T", ".-": "A", "-.-": "K", ".": "E", "....": "H", "-.--": "Y", "-.": "N", "-..": "D", "..-.": "F", "..": "I", "-.-.": "C" };
      assert.equal(morse.split(" / ").map(word => word.split(" ").map(letter => reverse[letter]).join("")).join(" "), "TAKE THE KEY AND FIND THE CHAIN IN THE KITCHEN");
      console.log(`PASS ${scenario.name}: continuous observed motion at 0.7/4.1/8.3/12.4s, completion ${completed-started}ms, no duplicate timers, all motion stops at completion.`);
    }
    fs.writeFileSync(path.join(output, process.argv.includes("--measure-current") ? "emblem-before-observations.json" : "emblem-observations.json"), JSON.stringify(observations, null, 2));
    assert.equal(errors.length, 0);
  };
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    if (process.argv.includes("--compact-processing")) {
      await verifyCompactProcessing();
      return;
    }
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
    if (process.argv.includes("--diagnose-motion")) {
      const observations = [];
      for (const motion of ["no-preference", "reduce"]) {
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: motion }] });
        await load();
        await fill(["≠", "=", "≠", "≠"]);
        await success();
        await waitFor("!document.getElementById('open-original-record').hidden");
        await click("#open-original-record");
        const started = Date.now();
        for (const at of [0, 700, 3500, 8000, 12500]) {
          await delay(Math.max(0, at - (Date.now() - started)));
          const observation = await read("(()=>{const r=document.querySelector('.emblem-ring-outer'),s=getComputedStyle(r),a=getComputedStyle(document.querySelector('.core-light'));return{reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,state:document.querySelector('.corruption-notice').dataset.state,animation:s.animationName,playState:s.animationPlayState,transform:s.transform,scanAnimation:a.animationName,scanOpacity:a.opacity,animations:r.getAnimations().map(e=>({state:e.playState,time:e.currentTime,keyframes:e.effect.getKeyframes()}))}})()");
          observations.push({ motion, at: Date.now() - started, ...observation });
        }
        console.log("DIAGNOSIS", motion, JSON.stringify(observations.filter(e => e.motion === motion)));
      }
      fs.mkdirSync(output, { recursive: true });
      fs.writeFileSync(path.join(output, "motion-diagnosis.json"), JSON.stringify(observations, null, 2));
      return;
    }
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
    if (process.argv.includes("--capture-desktop")) {
      console.log("Desktop bounds:", await read("document.querySelector('.laboratory').getBoundingClientRect().toJSON()"));
      await fill(["≠", "=", "≠", "≠"]);
      await success(true);
      return;
    }
    if (!process.argv.includes("--forward-records")) {
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
    }
    const verifyRecordFlow = async (mobile = false, reduced = false) => {
      const prefix = (mobile ? "mobile-390" : "desktop") + (reduced ? "-reduced" : "");
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

      const decodingStart = Date.now();
      await click("#open-original-record");
      await click("#corruption-notice");
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
      assert.equal(await read("document.querySelectorAll('#corruption-notice').length"), 1);
      assert.equal(await read("document.getElementById('database-view').inert"), true);
      assert.equal(await read("document.activeElement.id"), "corruption-notice");
      const centered = await read("(()=>{const a=document.querySelector('.record-shell').getBoundingClientRect(),b=document.querySelector('.corruption-notice').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<2&&Math.abs(a.y+a.height/2-b.y-b.height/2)<2})()");
      assert.equal(centered, true);
      assert.equal(await read("document.querySelectorAll('.record-back,#back-to-result,#back-to-original').length"), 0);
      assert.equal(await read("document.querySelectorAll('#original-record-view button').length"), 1);
      const statusWhileLoading = await read("document.getElementById('record-status').textContent");
      const firstTransform = await read("getComputedStyle(document.querySelector('.emblem-ring-outer')).transform");
      if (reduced) {
        assert.equal(await read("getComputedStyle(document.querySelector('.emblem-ring-outer')).animationName"), "none");
        assert.equal(await read("getComputedStyle(document.querySelector('.core-light')).animationName"), "emblem-light");
        assert.equal(await read("getComputedStyle(document.querySelector('.core-light')).animationIterationCount"), "infinite");
        const initialOpacity = await read("Number(getComputedStyle(document.querySelector('.core-light')).opacity)");
        await delay(450);
        assert.equal(await read("getComputedStyle(document.querySelector('.emblem-ring-outer')).transform"), firstTransform);
        assert(await read("Number(getComputedStyle(document.querySelector('.core-light')).opacity)") > initialOpacity);
      } else {
        assert.equal(await read("getComputedStyle(document.querySelector('.emblem-ring-outer')).animationName"), "emblem-rotate");
        assert.equal(await read("getComputedStyle(document.querySelector('.emblem-ring-outer')).animationPlayState"), "running");
        const firstTime = await read("document.querySelector('.emblem-ring-outer').getAnimations()[0].currentTime");
        await delay(450);
        assert.notEqual(await read("getComputedStyle(document.querySelector('.emblem-ring-outer')).transform"), firstTransform);
        assert(await read("document.querySelector('.emblem-ring-outer').getAnimations()[0].currentTime") > firstTime + 300);
      }
      assert.equal(await read("document.getElementById('record-status').textContent"), statusWhileLoading);
      await screenshot(`${prefix}-decoding`);
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
      assert.equal(await read("document.getElementById('corruption-title').textContent"), "File corrupted");
      assert.equal(await read("document.getElementById('corruption-description').textContent"), "Decoding required");
      await delay(13500);
      assert.equal(await read("document.getElementById('open-decoded-record').hidden"), true);
      const readyTime = await waitFor("!document.getElementById('open-decoded-record').hidden", 40, 4000);
      assert(readyTime - decodingStart >= 14900 && readyTime - decodingStart <= 16000);
      assert.equal(await read("getComputedStyle(document.querySelector('.emblem-ring-outer')).animationName"), "none");
      assert.equal(await read("getComputedStyle(document.querySelector('.core-light')).animationName"), "none");
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
      assert.equal(await read("document.querySelectorAll('#decoded-record-view button').length"), 0);
      assert.equal(await read("decodingTimer === null"), true);
      console.log(`PASS ${prefix}: warning delay ${actionTime - warningShown}ms; decoding ${readyTime - decodingStart}ms; ${reduced ? "gentle reduced-motion intensity without rotation" : "verified changing transform and advancing rotation time"}; motion stops on completion; exact independently decoded Morse; forward only, focus and inert views.`);
    };
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, screenWidth: 1280, screenHeight: 900, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await load();
    await verifyRecordFlow();
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await load();
    await verifyRecordFlow(true);
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await load();
    await verifyRecordFlow(true, true);
    assert.equal(errors.length, 0);
    console.log("PASS: desktop/390px complete forward record flow, confirmed live rotation and finite reduced-motion alternative, timed results, exact copy, independent Morse decoding, no return controls, no horizontal overflow or runtime exceptions. Screenshots saved under .local-verification/entry-2/.");
  } finally { socket.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
