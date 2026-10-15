"use strict";

// Exercises the served implementation with native browser input, not puzzle-state injection.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const output = path.resolve(__dirname, "../.local-verification/entry-4/final-hints");
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
    await send("Page.navigate", { url: "http://localhost:8000/entry-4/" });
    await wait(`performance.timeOrigin!==${previous} && document.readyState==='complete' && document.fonts.status==='loaded'`);
    await delay(850);
  };
  const expected = [
  [
    "evidence-01",
    "Evidence 01",
    [
      "میانیها آشناترند را جدی بگیر شاید لازم نباشد هر ساعت را کامل بخوانی.",
      "در هر ساعت رقم دهگان دقیقه را جدا کن و به ترتیب درج ساعتها کنار هم بگذار. عدد حاصل کجا برایت آشناست",
      "شماره پرونده را پیدا کردهای اما نوشته وارونه میگوید عدد آشنا لزوما پاسخ نیست. ترتیب رقمهایش را برعکس کن."
    ]
  ],
  [
    "evidence-02",
    "Evidence 02",
    [
      "کد بایگانی در عکسها پنهان شده است به عددها و شناسههای کنار تصاویر دقت کن.",
      "شاید  به سومین وسیله در گزارش وضعیت اولیه صحنه اشاره دارد وسیلهای که زمان را نشان میدهد.",
      "زیر عکس قربانی عدد  و زیر عکس ساعت شناسه E-06 قرار دارد.  را کنار  بگذار کد بایگانی  است."
    ]
  ],
  [
    "evidence-03",
    "Evidence 03",
    [
      "ترتیب کارتها را زمان اتفاقات مشخص میکند اظهارات را از زودترین تا دیرترین رویداد مرتب کن.",
      "کارتها را به ترتیب زمانی از بالا به پایین بچین و کد کنار هر کارت را بخوان لازم نیست تمام رقمهای هر کد را استفاده کنی.",
      "از کد هر کارت فقط رقم یکان را بردار و به ترتیب از بالا به پایین کنار هم بگذار رمز  است."
    ]
  ],
  [
    "evidence-04",
    "Evidence 04",
    [
      "دو برگه کاهی فقط یک نقشه نمیسازند به چهار دایرهای که با رویهمگذاشتنشان شکل میگیرد هم دقت کن.",
      "دو برگه رویهمگذاشتهشده را روی گزارش مالی محرمانه قرار بده. عددهای داخل چهار دایره را به ترتیب یادداشت کن جمله پایین گزارش عمل لازم را مشخص میکند.",
      "از عددهای رسید بهترتیب عددهای مشخصشده در گزارش را کم کن:    و . جوابها را کنار هم بگذار رمز  است."
    ]
  ],
  [
    "chest-code",
    "Chest Code",
    [
      "برای پیدا کردن دو رقم صندوقچه واژههای هر سطر روی کاغذ کاهی را بشمار هر سطر یک رقم میدهد.",
      "تعداد واژههای دو سطر  و  است اما یادداشت چسبیده به صندوقچه نشان میدهد هنوز یک تغییر لازم است. متن پنهان آن را آشکار کن.",
      "پیام رابرت ـ نیم ـ بالا به قفل سمت راست اشاره دارد: عدد  را ثابت نگه دار و سمت راست را نیمواحد بالاتر از  یعنی بین  و  قرار بده."
    ]
  ],
  [
    "evidence-05",
    "Evidence 05",
    [
      "نقطهها و خطها تزئینی نیستند هر گروه میتواند یک حرف باشد.",
      "پیام با کد مورس نوشته شده است. گروهها را با جدول مورس به حروف انگلیسی تبدیل کن و فاصله میان کلمهها را حفظ کن.",
      "پیام میگوید: کلید را بردار و زنجیر را در آشپزخانه پیدا کن. کلید فیزیکی را همراهت ببر و قفل آنجا را باز کن."
    ]
  ],
  [
    "evidence-06",
    "Evidence 06",
    [
      "گزارش مالی را برگردان شاید همه اطلاعاتش در روی برگه نباشد.",
      "پشت برگه را با چراغقوه UV بررسی کن بعضی نوشتهها زیر نور معمولی دیده نمیشوند.",
      "کد پنهان پشت گزارش مالی B-11 است. آن را در بخش Evidence ID سامانه بایگانی پروندهها وارد کن."
    ]
  ]
];
  const configSource = fs.readFileSync(path.resolve(__dirname, '../public/entry-4/config.js'), 'utf8');
  const { entry4Config: config } = await import('data:text/javascript;base64,' + Buffer.from(configSource).toString('base64'));
  assert.deepEqual(config.hintSections, expected.map(([id,title,hints]) => ({id,title,hints})));
  assert.equal(new Set(config.hintSections.map(s => s.id)).size, 7);
  const text = async (selector) => read(`document.querySelector(${JSON.stringify(selector)}).textContent`);
  const notes = async () => read("[...document.querySelectorAll('.note p')].map(e=>e.textContent)");
  const overflow = async () => assert.equal(await read('document.documentElement.scrollWidth > innerWidth'), false);
  try {
    fs.mkdirSync(output, { recursive: true });
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
    socket.addEventListener('message', ({data}) => {
      const m = JSON.parse(data);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params);
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry);
    });
    for (const [name,width,height] of [['desktop',1365,1000],['mobile',360,740]]) {
      touch = width < 600;
      await send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:touch});
      await send('Emulation.setTouchEmulationEnabled', {enabled:touch,maxTouchPoints:1});
      await load(); await click('#begin');
      for (const test of config.imageTests) {
        await wait("document.querySelectorAll('.choice-image img').length===3 && [...document.querySelectorAll('.choice-image img')].every(i=>i.complete&&i.naturalWidth>0)");
        assert.equal(await text('h1'), test.question);
        assert.equal(await read("document.querySelector('button[type=submit]').disabled"), true);
        await click(`.image-choice:nth-child(${test.correctOption === 1 ? 2 : 1})`);
        await click('button[type=submit]');
        assert.equal(await text('.form-message'), 'پاسخ درست نیست. دوباره بررسی کنید.');
        await click(`.image-choice:nth-child(${test.correctOption})`);
        assert.equal(await text('h1'), test.question);
        await click('button[type=submit]');
      }
      assert.equal(await text('h1'), 'مقدار هر نماد را وارد کنید.');
      await click('button[type=submit]');
      assert.equal(await text('.form-message'), 'مقدار هر سه نماد را وارد کنید.');
      for (const [shape,digit] of [['circle','۳'],['triangle','۷'],['square','۱']]) await fill('#symbol-'+shape,digit);
      await click('button[type=submit]');
      assert.equal(await text('.form-message'), 'پاسخ درست نیست. محاسبه را دوباره بررسی کنید.');
      await fill('#symbol-square','۰');
      assert.equal(await read("document.querySelector('#symbol-square').value"), '0');
      await click('button[type=submit]');
      assert.equal(await text('.welcome p'), 'خوش آمدید.');
      await wait("document.querySelectorAll('.evidence-open').length===7");
      assert.deepEqual(await read("[...document.querySelectorAll('.evidence-open')].map(e=>[e.dataset.sectionId,e.querySelector('.evidence-name').textContent])"), expected.map(([id,title]) => [id,title]));
      await overflow(); await screenshot(name+'-index');
      // Interleave all sections at each reveal depth to catch shared or positional progress.
      for (let count=0;count<3;count++) {
        for (const [id,title,hints] of expected) {
          await click(`[data-section-id="${id}"]`);
          assert.equal(await text('h1'), title);
          assert.equal(await text('.return-button'), 'بازگشت به فهرست مراحل');
          assert.deepEqual(await notes(), hints.slice(0,count));
          assert.equal(await text('.note-actions button'), count === 0 ? 'نمایش یادداشت اول' : 'نمایش یادداشت بعدی');
          await click('.note-actions button');
          assert.deepEqual(await notes(), hints.slice(0,count+1));
          await delay(350);
          assert.deepEqual(await notes(), hints.slice(0,count+1));
          assert.equal(await read("document.querySelectorAll('.note-actions button').length"), count === 2 ? 0 : 1);
          assert.equal(await read("document.querySelectorAll('input,form,a').length"), 0);
          await overflow();
          if (count===2) {
            assert.equal(await read("getComputedStyle(document.querySelector('.note p')).direction"), 'rtl');
            assert.equal(await read("[...document.querySelectorAll('.note bdi')].every(e=>e.dir==='ltr' && getComputedStyle(e).unicodeBidi==='isolate')"), true);
            await screenshot(name+'-'+id);
          }
          await click('.return-button');
        }
      }
      for (const [id,,hints] of expected) {
        await click(`[data-section-id="${id}"]`);
        assert.deepEqual(await notes(),hints);
        assert.equal(await read("document.querySelectorAll('.note-actions button').length"),0);
        await click('.return-button');
      }
      await load();
      assert.equal(await read("document.querySelectorAll('.evidence-open,.note').length"),0);
      assert.equal(await read("document.querySelector('#begin')!==null"),true);
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,viewports:['1365x1000','360x740'],sections:7,hints:21,errors},null,2));
    console.log('Entry 4: exact copy, access flow, navigation, independent progressive reveal, reload, RTL and overflow checks passed on desktop and mobile.');
  } finally { socket.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
