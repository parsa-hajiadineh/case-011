"use strict";

// Exercises the served implementation with native browser input, not puzzle-state injection.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.resolve(__dirname, "../.local-verification/entry-3");
async function main() {
  const tabs = await (await fetch("http://127.0.0.1:9223/json/list")).json();
  const tab = tabs.find((t) => t.type === "page" && /localhost:8000|about:blank/.test(t.url));
  assert(tab, "An isolated Chromium browser on port 9223 is required");
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => { socket.onopen = resolve; });
  const pending = new Map(), errors = [];
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
    pending.set(++sequence, { resolve, reject });
    socket.send(JSON.stringify({ id: sequence, method, params }));
  });
  const read = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const wait = async (expression, timeout = 10000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await read(expression)) return Date.now(); await delay(20); }
    throw new Error(`Timed out: ${expression}`);
  };
  let touch = false;
  const click = async (selector) => {
    await read(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',behavior:'instant'})`);
    const p = await read(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,hit:e.contains(document.elementFromPoint(x,y))}})()`);
    assert(p.hit, `${selector}: unobstructed hit target`);
    if (touch) {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y, radiusX: 5, radiusY: 5, force: 1 }] });
      await delay(40);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, x: p.x, y: p.y });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, x: p.x, y: p.y });
    }
  };
  const key = async (key, code, virtualKey, text = "", modifiers = 0) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: virtualKey, text, unmodifiedText: text, modifiers });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKey, modifiers });
  };
  const fill = async (selector, text) => {
    await click(selector);
    await key("a", "KeyA", 65, "", 2);
    await key("Backspace", "Backspace", 8);
    if (text) await send("Input.insertText", { text });
  };
  const screenshot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(r.data, "base64"));
  };
  const load = async () => {
    const previous = await read("performance.timeOrigin");
    await send("Page.navigate", { url: "http://localhost:8000/entry-3/" });
    await wait(`performance.timeOrigin!==${previous} && document.readyState==='complete' && document.fonts.status==='loaded'`);
    await delay(850);
  };
  try {
    fs.mkdirSync(output, { recursive: true });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    const instrumentation = await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.observedContexts=[];const OriginalContext=window.AudioContext;window.AudioContext=class extends OriginalContext {constructor(...a){super(...a);observedContexts.push(this);}};` });
    for (const [name,width,height,reduced] of [["desktop",1280,900,false],["mobile-360",360,640,false],["mobile-390",390,844,false],["mobile-short",390,500,false],["mobile-reduced",390,844,true]]) {
      touch = width < 500;
      await send("Emulation.setDeviceMetricsOverride", { width,height,deviceScaleFactor:1,mobile:touch });
      await send("Emulation.setTouchEmulationEnabled", { enabled:touch,maxTouchPoints:1 });
      await send("Emulation.setEmulatedMedia", { features:[{name:"prefers-reduced-motion",value:reduced?"reduce":"no-preference"}] });
      await load();
      assert.equal(await read("document.querySelectorAll('a').length"),0);
      assert.deepEqual(await read("[document.getElementById('evidence-letter').value,document.getElementById('evidence-number').value]"),["",""]);
      assert.equal(await read("observedContexts.length"),0);
      assert.equal(await read("document.documentElement.scrollWidth>innerWidth"),false);
      await screenshot(name+"-initial");
      if (name === "desktop") {
        const invalid = "شناسه مدرک را بهصورت یک حرف انگلیسی و دو رقم وارد کنید.";
        await click("#search-button");
        assert.equal(await read("document.getElementById('search-error').textContent"),invalid);
        await fill("#evidence-letter","a");
        assert.equal(await read("document.getElementById('evidence-letter').value"),"A");
        await fill("#evidence-number","0");
        await click("#search-button");
        assert.equal(await read("document.getElementById('search-error').textContent"),invalid);
        await fill("#evidence-letter","7");
        await fill("#evidence-number","a1");
        await click("#search-button");
        assert.equal(await read("document.getElementById('search-error').textContent"),invalid);
        await fill("#evidence-letter","abc");
        assert.equal(await read("document.getElementById('evidence-letter').value"),"A");
        await send("Browser.grantPermissions",{origin:"http://localhost:8000",permissions:["clipboardReadWrite","clipboardSanitizedWrite"]});
        await fill("#evidence-letter","");
        await send("Runtime.evaluate",{expression:"navigator.clipboard.writeText('b')",awaitPromise:true});
        await key("v","KeyV",86,"",2);
        assert.equal(await read("document.getElementById('evidence-letter').value"),"B");
        await fill("#evidence-letter","a");
        for (const digits of ["01","۰۱","٠١","012"]) {
          await fill("#evidence-number",digits);
          assert.equal(await read("document.getElementById('evidence-number').value"),"01");
          await click("#search-button");
          assert.equal(await read("document.getElementById('search-error').textContent"),"مدرکی با این شناسه در بایگانی یافت نشد.");
          assert.deepEqual(await read("[document.getElementById('evidence-letter').value,document.getElementById('evidence-number').value]"),["A","01"]);
          assert.equal(await read("document.getElementById('recovered-record').hidden"),true);
        }
        for (const [l,n] of [["A","11"],["B","10"],["B","01"],["Z","99"]]) {
          await fill("#evidence-letter",l);
          await fill("#evidence-number",n);
          await click("#search-button");
          assert.equal(await read("document.getElementById('search-error').textContent"),"مدرکی با این شناسه در بایگانی یافت نشد.");
          assert.equal(await read("document.getElementById('recovered-record').hidden"),true);
        }
        console.log("PASS validation: empty, incomplete, invalid, incorrect, limits, uppercase insertion, Persian/Arabic digits, leading zeros, preserved errors.");
        if (process.argv.includes("--validation-only")) return;
      }
      await click("#sound-toggle");
      await wait("document.getElementById('sound-toggle').getAttribute('aria-pressed')==='true'");
      assert.equal(await read("observedContexts[0].state"),"running");
      await click("#sound-toggle");
      await wait("observedContexts[0].state==='suspended'");
      assert.equal(await read("document.getElementById('sound-toggle').getAttribute('aria-pressed')"),"false");
      await click("#sound-toggle");
      await wait("observedContexts[0].state==='running'");
      if (name==="desktop") {
        const background = await send("Target.createTarget",{url:"about:blank"});
        await send("Target.activateTarget",{targetId:background.targetId});
        await wait("document.hidden && observedContexts[0].state==='suspended'");
        await send("Target.activateTarget",{targetId:tab.id});
        await wait("!document.hidden && observedContexts[0].state==='running'");
        await send("Target.closeTarget",{targetId:background.targetId});
      }
      await fill("#evidence-letter",name==="desktop"?"B":"b");
      assert.equal(await read("document.getElementById('evidence-letter').value"),"B");
      await fill("#evidence-number",name==="mobile-360"?"۱۱":name==="mobile-390"?"١١":"11");
      const start = Date.now();
      if (name==="desktop") await key("Enter","Enter",13,"\r");
      else await click("#search-button");
      assert.equal(await read("document.getElementById('retrieval-state').hidden"),false);
      assert.equal(await read("document.getElementById('recovered-record').hidden"),true);
      assert.equal(await read("[...document.querySelectorAll('#evidence-form input,#evidence-form button')].every(e=>e.disabled)"),true);
      // A second keyboard submission must not start another retrieval sequence.
      await key("Enter","Enter",13,"\r");
      const resultTime = await wait("!document.getElementById('recovered-record').hidden");
      assert(resultTime-start>=5000&&resultTime-start<5500);
      assert.equal(await read("document.getElementById('archive-warning').open"),false);
      assert.deepEqual(await read("[...document.querySelectorAll('#recovered-record h2,#recovered-record > p')].map(e=>e.textContent)"),["Evidence B-11","Status: Recovered","Recovery Date: 2026","Case Reopened"]);
      await delay(650);
      await screenshot(name+"-recovered");
      const warningTime = await wait("document.getElementById('archive-warning').open");
      assert(warningTime-resultTime>=1400&&warningTime-resultTime<1850);
      assert.equal(await read("document.getElementById('warning-message').textContent"),"این مدرک در اسناد اولیه پرونده وجود نداشته است!");
      assert.equal(await read("document.getElementById('warning-source').textContent"),"منبع: باماخ");
      assert.equal(await read("document.activeElement.id"),"view-details");
      const bounds = await read("(()=>{const r=document.getElementById('archive-warning').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()");
      assert(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=height);
      if (reduced) assert.equal(await read("document.getAnimations().length"),0);
      await delay(350);
      await screenshot(name+"-warning");
      await click("#view-details");
      assert.equal(await read("document.getElementById('search-view').hidden && document.getElementById('search-view').inert"),true);
      assert.equal(await read("document.getElementById('details-title').textContent"),"گزارش دریافت مدرک");
      assert.equal(await read("document.activeElement.id"),"details-title");
      assert.equal(await read("document.getElementById('provider-title').textContent"),"توضیحات ارائهدهنده مدرک");
      assert.equal(await read("observedContexts.length"),1);
      assert.equal(await read("observedContexts[0].state"),"running");
      await delay(550);
      await screenshot(name+"-report");
      assert.equal(await read("getComputedStyle(document.getElementById('details-view')).overflowY"),"visible");
      assert.equal(await read("document.documentElement.scrollWidth>innerWidth"),false);
      await click("#open-audio");
      await wait("document.getElementById('media-dialog').open");
      assert.equal(await read("document.activeElement.id"),"close-media");
      await key("Tab","Tab",9,"",8);
      assert.equal(await read("document.activeElement.id"),"start-media");
      await key("Tab","Tab",9);
      assert.equal(await read("document.activeElement.id"),"close-media");
      await delay(350);
      await screenshot(name+"-audio-warning");
      await key("Escape","Escape",27);
      assert.equal(await read("document.getElementById('media-dialog').open"),false);
      assert.equal(await read("document.activeElement.id"),"open-audio");
      await screenshot(name+"-statement");
      await click("#open-audio");
      await click("#start-media");
      await wait("document.getElementById('media-status').textContent==='فایل صوتی در دسترس نیست.'");
      assert.equal(await read("document.getElementById('sound-toggle').getAttribute('aria-pressed')"),"false");
      await wait("observedContexts[0].state==='suspended'");
      assert.equal(await read("document.getElementById('play-recording').disabled && document.getElementById('audio-seek').disabled"),true);
      assert.equal(await read("document.getElementById('evidence-audio').currentTime"),0);
      assert.equal(await read("document.getElementById('playback-graphic').classList.contains('is-playing')"),false);
      await screenshot(name+"-unavailable-player");
      await click("#show-note");
      assert.equal(await read("document.getElementById('investigator-note').hidden"),false);
      await screenshot(name+"-note");
      await click("#close-media");
      assert.equal(await read("document.getElementById('sound-toggle').getAttribute('aria-pressed')"),"false");
      await click("#open-audio");
      assert.equal(await read("document.getElementById('audio-panel').hidden"),false);
      await click("#open-timeline");
      assert.equal(await read("document.getElementById('media-dialog').open"),false);
      assert.equal(await read("document.getElementById('evidence-audio').paused"),true);
      assert.equal(await read("document.getElementById('timeline-title').textContent"),"TIMELINE");
      assert.equal(await read("document.activeElement.id"),"timeline-title");
      await screenshot(name+"-timeline");
      console.log(`PASS ${name}: real ${touch?'touch':'mouse/keyboard'} input, exact result, retrieval ${resultTime-start}ms / warning ${warningTime-resultTime}ms, bounded modal, details/focus, one audio context.`);
    }
    assert.equal(errors.length,0);
    await send("Page.removeScriptToEvaluateOnNewDocument",{identifier:instrumentation.identifier});
    for (const [name,source] of [["unsupported","window.AudioContext=undefined;window.webkitAudioContext=undefined;"],["rejected","AudioContext.prototype.resume=()=>Promise.reject(new Error('Blocked test activation'));"],["fallback-dialog","HTMLDialogElement.prototype.showModal=undefined;"]]) {
      const injection=await send("Page.addScriptToEvaluateOnNewDocument",{source});
      await load();
      if (name==="fallback-dialog") {
        await fill("#evidence-letter","b");
        await fill("#evidence-number","11");
        await click("#search-button");
        await wait("document.getElementById('archive-warning').open");
        assert.equal(await read("document.getElementById('warning-backdrop').hidden"),false);
        await key("Tab","Tab",9);
        assert.equal(await read("document.activeElement.id"),"view-details");
        await click("#view-details");
        assert.equal(await read("document.getElementById('details-view').hidden"),false);
        await click("#open-audio");
        await key("Tab","Tab",9,"",8);
        assert.equal(await read("document.activeElement.id"),"start-media");
        await click("#start-media");
        await wait("document.getElementById('media-status').textContent==='فایل صوتی در دسترس نیست.'");
        await click("#show-note");
        await click("#open-timeline");
        assert.equal(await read("document.getElementById('timeline-view').hidden"),false);
      } else {
        await click("#sound-toggle");
        await wait("document.getElementById('sound-error').textContent.length>0");
        assert.equal(await read("document.getElementById('sound-toggle').getAttribute('aria-pressed')"),"false");
      }
      await send("Page.removeScriptToEvaluateOnNewDocument",{identifier:injection.identifier});
      console.log(`PASS ${name}: compatibility handling through actual touch input.`);
    }
    assert.equal(errors.length,0);
  } finally { await send("Emulation.setTouchEmulationEnabled",{enabled:false}); socket.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
