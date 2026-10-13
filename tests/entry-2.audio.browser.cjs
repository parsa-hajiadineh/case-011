"use strict";

// Real browser input with geometry snapshots and Web Audio lifecycle observations.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.resolve(__dirname, "../.local-verification/entry-2");
const baseline = process.argv.includes("--baseline");

async function main() {
  const tabs = await (await fetch("http://127.0.0.1:9223/json/list")).json();
  const tab = tabs.find((item) => item.type === "page" && /localhost:8000|about:blank/.test(item.url));
  assert(tab, "An isolated browser on port 9223 is required");
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => { socket.onopen = resolve; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const read = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const wait = async (expression, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await read(expression)) return;
      await delay(50);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (selector) => {
    await send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',behavior:'instant'})` });
    const point = await read(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  if (!baseline) await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.observedAudioContexts=[];
    const OriginalAudioContext=window.AudioContext;
    window.AudioContext=class extends OriginalAudioContext {
      constructor(...args){super(...args);window.observedAudioContexts.push(this);}
    };
  ` });
  fs.mkdirSync(output, { recursive: true });
  for (const [name, width, height] of [["desktop",1280,900],["mobile-390",390,844],["mobile-360",360,640]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    const previousDocument = await read("performance.timeOrigin");
    await send("Page.navigate", { url: "http://localhost:8000/entry-2/" });
    await wait(`performance.timeOrigin!==${previousDocument} && document.readyState==='complete' && document.fonts.status==='loaded'`);
    await delay(650);
    const geometry = await read(`Object.fromEntries(['.lab-header','.lab-mark','.institution-title','.database-identifier','.case-identifier','.comparison-panel','.output-panel'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x,y:r.y,width:r.width,height:r.height}]}))`);
    const file = path.join(output, `sound-layout-${name}.json`);
    if (baseline) fs.writeFileSync(file, JSON.stringify(geometry, null, 2));
    else {
      assert.deepEqual(geometry, JSON.parse(fs.readFileSync(file)), `${name}: existing layout must remain identical`);
      assert.equal(await read("observedAudioContexts.length"), 0);
      assert.equal(await read("document.getElementById('sound-toggle').getAttribute('aria-label')"), "روشن کردن صدا");
      const overlap = await read(`(()=>{const b=document.getElementById('sound-toggle').getBoundingClientRect();return [...document.querySelectorAll('.institution-title,.database-identifier,.case-identifier,.lab-mark')].some(e=>{const r=e.getBoundingClientRect();return b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top})})()`);
      assert.equal(overlap, false, `${name}: sound target must not overlap text or logo`);
      await click("#sound-toggle");
      await wait("document.getElementById('sound-toggle').getAttribute('aria-pressed')==='true'");
      assert.equal(await read("observedAudioContexts.length"), 1);
      assert.equal(await read("observedAudioContexts[0].state"), "running");
      assert.equal(await read("document.getElementById('sound-toggle').getAttribute('aria-label')"), "خاموش کردن صدا");
      await click("#sound-toggle");
      await wait("observedAudioContexts[0].state==='suspended'");
      assert.equal(await read("document.getElementById('sound-toggle').getAttribute('aria-pressed')"), "false");
      await click("#sound-toggle");
      await wait("observedAudioContexts[0].state==='running'");
      assert.equal(await read("observedAudioContexts.length"), 1);
      if (name === "desktop") {
        const background = await send("Target.createTarget", { url: "about:blank" });
        await send("Target.activateTarget", { targetId: background.targetId });
        await wait("document.hidden && observedAudioContexts[0].state==='suspended'");
        await send("Target.activateTarget", { targetId: tab.id });
        await wait("!document.hidden && observedAudioContexts[0].state==='running'");
        await send("Target.closeTarget", { targetId: background.targetId });
        console.log("PASS visibility: switching tabs suspends and restores enabled audio");
        if (!process.argv.includes("--sound-only")) {
        for (const [index, operator] of ["≠","=","≠","≠"].entries()) {
          await click(`.operator-slot[data-sample='${"BCDE"[index]}']`);
          await click(`.operator-key[data-operator='${operator}']`);
        }
        await click("#submit-result");
        await wait("!document.getElementById('open-original-record').hidden");
        await click("#open-original-record");
        assert.equal(await read("observedAudioContexts[0].state"), "running");
        await wait("!document.getElementById('open-decoded-record').hidden");
        await click("#open-decoded-record");
        assert.equal(await read("observedAudioContexts.length"), 1);
        assert.equal(await read("observedAudioContexts[0].state"), "running");
        await click("#sound-toggle");
        await wait("observedAudioContexts[0].state==='suspended'");
        }
      }
      const beforeKeyboard = await read("document.getElementById('sound-toggle').getAttribute('aria-pressed')");
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
      await delay(100);
      assert.equal(await read("document.activeElement.id"), "sound-toggle");
      assert.equal(await read("document.getElementById('sound-toggle').matches(':focus-visible')"), true);
      const preference = await read("document.getElementById('sound-toggle').getAttribute('aria-pressed')");
      assert.notEqual(preference, beforeKeyboard, "Space must activate the focused sound button");
      if (preference === "true") await click("#sound-toggle");
      await wait("observedAudioContexts[0].state==='suspended'");
      const background = await send("Target.createTarget", { url: "about:blank" });
      await send("Target.activateTarget", { targetId: background.targetId });
      await wait("document.hidden");
      await send("Target.activateTarget", { targetId: tab.id });
      await wait("!document.hidden");
      assert.equal(await read("observedAudioContexts[0].state"), "suspended");
      await send("Target.closeTarget", { targetId: background.targetId });
    }
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, `sound-${name}-${baseline ? "before" : "after"}.png`), Buffer.from(screenshot.data, "base64"));
    console.log(`PASS ${name}: ${baseline ? "baseline captured" : "identical layout, non-overlapping target, audio opt-in/mute/reuse"}`);
  }
  if (!baseline) {
    for (const [name, source] of [
      ["unavailable", "window.AudioContext=undefined;window.webkitAudioContext=undefined;"],
      ["blocked", "window.AudioContext.prototype.resume=()=>Promise.reject(new Error('Blocked test activation'));"],
    ]) {
      const injection = await send("Page.addScriptToEvaluateOnNewDocument", { source });
      const previousDocument = await read("performance.timeOrigin");
      await send("Page.navigate", { url: "http://localhost:8000/entry-2/" });
      await wait(`performance.timeOrigin!==${previousDocument} && document.readyState==='complete'`);
      await click("#sound-toggle");
      await wait("document.getElementById('sound-status').textContent.length>0");
      assert.equal(await read("document.getElementById('sound-toggle').getAttribute('aria-pressed')"), "false");
      await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
      console.log(`PASS ${name}: activation failure leaves sound off with accessible status`);
    }
  }
  socket.close();
}
main().catch((error) => { console.error(error); process.exit(1); });

