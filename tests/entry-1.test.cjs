"use strict";

// Script-level regression checks; this fixture does not verify browser rendering.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/entry-1/index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "public/entry-1/script.js"), "utf8");
const expected = [
  { key: "nora", title: "مدارک مرتبط با نورا آذرگشسب", documents: [
    ["نامه انگشت‌نگاری و پزشکی قانونی", "nora-fingerprint-forensic-report.pdf"],
    ["گزارش تحقیقات محلی", "nora-local-inquiry-report.pdf"]
  ] },
  { key: "arash", title: "مدارک مرتبط با آرش نادری", documents: [
    ["استعلام مخابرات", "arash-telecom-record.pdf"]
  ] },
  { key: "kamran", title: "مدارک مرتبط با کامران فرهمند و باماخ", documents: [
    ["استعلام مخابرات خط تلفن کامران فرهمند", "kamran-telecom-record.pdf"],
    ["گزارش بررسی تصویر دوربین مدار بسته", "cctv-footage-review-report.pdf"]
  ] }
];

function fixture({ unavailable = [], supportedAudio = true } = {}) {
  const nodes = [];
  const timers = [];
  const requests = [];
  const warnings = [];
  const audio = { contexts: 0, oscillators: 0, resumes: 0, suspends: 0 };
  let focused;
  let scrolledTo;
  class Element {
    constructor(id = "") {
      Object.assign(this, { id, hidden: false, inert: false, disabled: false,
        textContent: "", children: [], attributes: {}, handlers: {}, dataset: {} });
      nodes.push(this);
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(key, handler) { this.handlers[key] = handler; }
    focus() { focused = this.id; }
    showModal() { this.open = true; }
    close() { this.open = false; this.handlers.close?.(); }
    blur() { focused = undefined; }
    scrollIntoView() { scrolledTo = this.id; }
    append(...items) {
      for (const item of items) {
        if (item.parentElement) item.parentElement.children = item.parentElement.children.filter((child) => child !== item);
        item.parentElement = this;
        this.children.push(item);
      }
    }
    replaceChildren(...items) { this.children = items; }
    querySelectorAll() { return this.children; }
    click() { if (!this.disabled) this.handlers.click?.({ preventDefault() {} }); }
  }
  for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = new Element(match[1]);
    node.hidden = /\bhidden\b/.test(match[0]);
    node.inert = /\binert\b/.test(match[0]);
    node.disabled = /\sdisabled(?:\s|>)/.test(match[0]);
    for (const attribute of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) {
      node.attributes[attribute[1]] = attribute[2];
    }
  }
  const get = (id) => nodes.find((node) => node.id === id);
  get("sound-slot-access-view").append(get("sound-control"));
  const categories = [...html.matchAll(/data-category="([^"]+)"[^>]*>([^<]+)</g)].map((match) => {
    const node = new Element();
    node.dataset.category = match[1];
    node.textContent = match[2];
    return node;
  });
  get("document-categories").children = categories;
  const document = {
    hidden: false, handlers: {}, getElementById: get,
    querySelectorAll: () => [], createElement: () => new Element(),
    addEventListener(key, handler) { this.handlers[key] = handler; }
  };
  const window = {
    scrollY: 0, handlers: {}, setTimeout: (callback) => timers.push(callback),
    scrollTo: ({ top }) => { window.scrollY = top; },
    addEventListener(key, handler) { this.handlers[key] = handler; }
  };
  if (supportedAudio) window.AudioContext = function () {
    audio.contexts++;
    return {
      currentTime: 0, state: "running", destination: {},
      createGain: () => ({ connect() {}, gain: { value: 0,
        cancelScheduledValues() {}, setValueAtTime() {}, setTargetAtTime() {} } }),
      createOscillator: () => {
        audio.oscillators++;
        return { frequency: {}, connect() {}, start() {} };
      },
      resume: async () => { audio.resumes++; },
      suspend: async () => { audio.suspends++; }
    };
  };
  vm.runInContext(source, vm.createContext({ window, document,
    console: { warn: (message) => warnings.push(message) },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: !unavailable.includes(url) };
    }
  }));
  return { get, categories, window, document, audio, requests, warnings,
    focused: () => focused, scrolledTo: () => scrolledTo,
    unlock() {
      get("archive-number").value = "۰۸۰۶";
      get("archive-form").handlers.submit({ preventDefault() {} });
      while (timers.length) timers.shift()();
    }
  };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("documents are visible but locked until evidence return, remain unlocked, and reset on reload", () => {
  const f = fixture();
  f.unlock();
  assert.equal(f.get("destination-view").hidden, false);
  assert.equal(f.get("selected-documents").hidden, false);
  assert.equal(f.get("selected-documents").disabled, false);
  assert.equal(f.get("selected-documents").attributes["data-state"], "locked");
  assert.equal(f.get("documents-lock").attributes.hidden, undefined);
  assert.equal(f.get("selected-documents").attributes["aria-disabled"], "true");
  f.get("selected-documents").click();
  assert.equal(f.get("document-categories").hidden, true);
  assert.equal(f.get("locked-documents-dialog").open, true);
  assert.equal(f.focused(), "confirm-locked-documents");
  // Repeated locked activation cannot open document categories.
  f.get("selected-documents").handlers.click();
  f.categories[0].handlers.click();
  assert.equal(f.get("document-categories").hidden, true);
  assert.equal(f.get("category-view").hidden, true);
  f.get("confirm-locked-documents").click();
  assert.equal(f.get("locked-documents-dialog").open, false);
  assert.equal(f.focused(), "selected-documents");
  f.window.scrollY = 1400;
  f.get("open-evidence").click();
  assert.equal(f.get("evidence-view").hidden, false);
  assert.equal(f.get("selected-documents").disabled, false);
  f.get("return-suspects").click();
  assert.equal(f.get("selected-documents").hidden, false);
  assert.equal(f.get("selected-documents").disabled, false);
  assert.equal(f.get("selected-documents").attributes["data-state"], "unlocked");
  assert.equal(f.get("documents-lock").attributes.hidden, "");
  assert.equal(f.get("selected-documents").attributes["aria-disabled"], "false");
  assert.equal(f.window.scrollY, 1400);
  assert.equal(f.focused(), "open-evidence");
  for (const expanded of [true, false, true]) {
    f.get("selected-documents").click();
    assert.equal(f.get("document-categories").hidden, !expanded);
    assert.equal(f.get("selected-documents").attributes["aria-expanded"], String(expanded));
  }
  f.get("open-evidence").click();
  f.get("return-suspects").click();
  assert.equal(f.get("selected-documents").disabled, false);
  const reloaded = fixture();
  reloaded.unlock();
  assert.equal(reloaded.get("selected-documents").hidden, false);
  assert.equal(reloaded.get("selected-documents").disabled, false);
  assert.equal(reloaded.get("selected-documents").attributes["data-state"], "locked");
});

test("the actual evidence-return handler enables documents before suspect view focus", () => {
  const f = fixture();
  f.unlock();
  f.get("open-evidence").click();
  let observed;
  f.get("open-evidence").focus = () => {
    observed = {
      disabled: f.get("selected-documents").disabled,
      accessible: f.get("selected-documents").attributes["aria-disabled"],
      visual: f.get("selected-documents").attributes["data-state"],
      hidden: f.get("destination-view").hidden
    };
  };
  f.get("return-suspects").click();
  assert.deepEqual(observed, { disabled: false, accessible: "false", visual: "unlocked", hidden: false });
});

test("all category controls and five document viewers return with scroll and focus intact", async () => {
  const f = fixture();
  f.unlock();
  f.get("open-evidence").click();
  f.get("return-suspects").click();
  f.get("selected-documents").click();
  assert.equal(f.categories.length, 3);
  f.get("sound-toggle").click();
  await settle();
  const initialResumes = f.audio.resumes;
  for (let i = 0; i < expected.length; i++) {
    const category = expected[i];
    const control = f.categories[i];
    assert.equal(control.dataset.category, category.key);
    assert.equal(control.textContent, category.title);
    f.window.scrollY = 240 + i;
    control.click();
    await settle();
    assert.equal(f.get("category-title").textContent, category.title);
    assert.equal(f.get("category-view").hidden, false);
    assert.equal(f.get("destination-view").inert, true);
    assert.equal(f.get("pdf-container").children.length, 0);
    assert.equal(f.get("document-list").children.length, category.documents.length);
    if (i === 0) assert.equal(f.get("document-list").children[1].children[1].textContent,
      "استعلام بانکی و مصاحبه حضوری با فروشنده سوپرمارکت");
    f.get("return-category").click();
    assert.equal(f.window.scrollY, 240 + i);
    assert.equal(f.focused(), control.id);
    for (let j = 0; j < category.documents.length; j++) {
      control.click();
      await settle();
      const button = f.get("document-list").children[j].children[0];
      const [title, filename] = category.documents[j];
      assert.equal(button.textContent, title);
      assert.equal(button.disabled, false);
      button.click();
      assert.equal(f.get("pdf-view").hidden, false);
      assert.equal(f.get("category-view").inert, true);
      assert.equal(f.get("pdf-title").textContent, title);
      assert.equal(f.get("pdf-container").children[0].src, `assets/evidence/${filename}`);
      assert.equal(f.get("pdf-link").href, `assets/evidence/${filename}`);
      assert.equal(f.get("pdf-link").attributes.target, "_blank");
      f.get("return-pdf").click();
      assert.equal(f.get("destination-view").hidden, false);
      assert.equal(f.get("destination-view").inert, false);
      assert.equal(f.window.scrollY, 240 + i);
      assert.equal(f.focused(), control.id);
      assert.equal(f.get("pdf-container").children.length, 0);
      assert.equal(f.get("selected-documents").hidden, false);
      assert.equal(f.get("selected-documents").disabled, false);
    }
  }
  assert(f.requests.every((request) => request.options.method === "HEAD"));
  assert.equal(f.audio.contexts, 1);
  assert.equal(f.audio.oscillators, 3);
  assert.equal(f.audio.resumes, initialResumes);
  assert.equal(f.get("sound-label").textContent, "صدا روشن");
  assert.equal(f.get("sound-toggle").attributes["aria-pressed"], "true");
});

test("PDF return preserves its originating list, scroll, focus, and direct suspect shortcut", async () => {
  const f = fixture();
  f.unlock();
  f.get("open-evidence").click();
  f.get("return-suspects").click();
  assert.equal(f.get("documents-lock-label"), undefined);
  f.get("selected-documents").click();
  f.window.scrollY = 400;
  f.categories[2].click();
  await settle();
  const originalItems = f.get("document-list").children;
  f.window.scrollY = 80;
  originalItems[1].children[0].click();
  assert.equal(f.get("pdf-container").children[0].src, "assets/evidence/cctv-footage-review-report.pdf");
  f.get("return-document-list").click();
  assert.equal(f.get("category-view").hidden, false);
  assert.equal(f.get("document-list").children, originalItems);
  assert.equal(f.window.scrollY, 80);
  assert.equal(f.focused(), "document-kamran-1");
  assert.equal(f.get("pdf-container").children.length, 0);
  originalItems[0].children[0].click();
  assert.equal(f.get("pdf-container").children[0].src, "assets/evidence/kamran-telecom-record.pdf");
  f.get("return-document-list").click();
  f.get("return-category").click();
  assert.equal(f.get("destination-view").hidden, false);
  assert.equal(f.get("document-categories").hidden, false);
  assert.equal(f.get("selected-documents").attributes["aria-expanded"], "true");
  assert.equal(f.get("selected-documents").disabled, false);
  assert.equal(f.window.scrollY, 400);
  assert.equal(f.focused(), "category-kamran");
  assert(!/history\.back\(/.test(source));
});

test("missing PDFs retain every item with an unavailable state and exact expected path", async () => {
  const unavailable = expected.flatMap((category) => category.documents.map(([, filename]) => `assets/evidence/${filename}`));
  const f = fixture({ unavailable });
  f.unlock();
  f.get("open-evidence").click();
  f.get("return-suspects").click();
  f.get("selected-documents").click();
  for (let i = 0; i < expected.length; i++) {
    f.categories[i].click();
    await settle();
    const items = f.get("document-list").children;
    assert.equal(items.length, expected[i].documents.length);
    for (const item of items) {
      assert.equal(item.children[0].disabled, true);
      assert.equal(item.children.at(-1).textContent, "فایل در دسترس نیست.");
      item.children[0].click();
      assert.equal(f.get("pdf-container").children.length, 0);
    }
    f.get("return-category").click();
  }
  assert.deepEqual(f.warnings, unavailable.map((url) => `Expected PDF: public/entry-1/${url}`));
});

test("sound starts only on activation, mutes, pauses when hidden, and handles unsupported audio", async () => {
  const f = fixture();
  assert.equal(f.audio.contexts, 0);
  assert.equal(f.get("sound-toggle").attributes["aria-pressed"], "false");
  f.get("sound-toggle").click();
  await settle();
  assert.equal(f.audio.contexts, 1);
  assert.equal(f.get("sound-label").textContent, "صدا روشن");
  f.document.hidden = true;
  f.document.handlers.visibilitychange();
  await settle();
  assert.equal(f.audio.suspends, 1);
  assert.equal(f.get("sound-toggle").attributes["aria-pressed"], "true");
  f.document.hidden = false;
  f.document.handlers.visibilitychange();
  await settle();
  f.get("sound-toggle").click();
  await settle();
  assert.equal(f.get("sound-label").textContent, "صدا خاموش");
  assert.equal(f.get("sound-toggle").attributes["aria-pressed"], "false");
  f.get("sound-toggle").click();
  await settle();
  assert.equal(f.audio.contexts, 1);
  const unsupported = fixture({ supportedAudio: false });
  unsupported.get("sound-toggle").click();
  assert.equal(unsupported.get("sound-label").textContent, "صدا خاموش");
  assert.equal(unsupported.get("sound-toggle").attributes["aria-pressed"], "false");
  assert.equal(unsupported.get("sound-status").textContent, "پخش صدا در این مرورگر در دسترس نیست.");
});

test("the same sound control moves beside each active view title without restarting audio", async () => {
  const f = fixture();
  const control = f.get("sound-control");
  assert.equal(control.parentElement.id, "sound-slot-access-view");
  f.get("sound-toggle").click();
  await settle();
  const resumes = f.audio.resumes;
  f.unlock();
  assert.equal(control.parentElement.id, "sound-slot-destination-view");
  f.get("open-evidence").click();
  assert.equal(control.parentElement.id, "sound-slot-evidence-view");
  f.get("return-suspects").click();
  assert.equal(control.parentElement.id, "sound-slot-destination-view");
  f.get("selected-documents").click();
  f.categories[0].click();
  await settle();
  assert.equal(control.parentElement.id, "sound-slot-category-view");
  f.get("document-list").children[0].children[0].click();
  assert.equal(control.parentElement.id, "sound-slot-pdf-view");
  f.get("return-pdf").click();
  assert.equal(control.parentElement.id, "sound-slot-destination-view");
  assert.equal(f.audio.resumes, resumes);
  assert.equal(f.audio.contexts, 1);
  assert.equal(f.get("sound-toggle").attributes["aria-pressed"], "true");
});

test("dossiers and PDF bytes are preserved; controls have no obsolete placement or spacing", () => {
  const previous = execFileSync("git", ["show", "HEAD:public/entry-1/index.html"], { cwd: root, encoding: "utf8" });
  // Git normalizes line endings; compare content after equivalent normalization.
  const dossiers = (text) => text.slice(text.indexOf('<div class="dossier-grid">'), text.lastIndexOf("</article>") + 10).replace(/\r\n/g, "\n");
  assert.equal(dossiers(html), dossiers(previous));
  for (const category of expected) for (const [, filename] of category.documents) {
    const relative = `public/entry-1/assets/evidence/${filename}`;
    const original = execFileSync("git", ["show", `HEAD:${relative}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
    const current = fs.readFileSync(path.join(root, relative));
    assert.equal(current.subarray(0, 5).toString(), "%PDF-");
    assert.deepEqual(current, original);
  }
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  assert(!header.includes('id="sound-toggle"'));
  assert.equal([...html.matchAll(/id="sound-toggle"/g)].length, 1);
  assert.equal([...html.matchAll(/id="selected-documents"/g)].length, 1);
  const suspectHeading = html.slice(html.indexOf('id="destination-view"'), html.indexOf('<div class="dossier-grid">'));
  assert(!suspectHeading.includes('id="selected-documents"'));
  assert(suspectHeading.includes('id="sound-slot-destination-view"'));
  const actions = html.slice(html.indexOf('class="suspect-actions"'), html.indexOf('id="evidence-view"'));
  assert(actions.includes('id="selected-documents"'));
  assert(actions.indexOf('id="open-evidence"') < actions.indexOf('id="selected-documents"'));
  assert(actions.includes('id="document-categories"'));
  const documentsTag = html.match(/<button[^>]*id="selected-documents"[^>]*>/)[0];
  assert(!/\sdisabled(?:\s|>)/.test(documentsTag));
  assert(!/\bhidden\b/.test(documentsTag));
  assert(!/documents-notice|jump-to-documents/.test(html + source));
  assert(!/documents-state|برای دسترسی به مدارک/.test(html + source));
  assert(!/documents-lock-label|return-categories/.test(html + source));
  assert(!html.includes("portal-footer"));
  const styles = fs.readFileSync(path.join(root, "public/entry-1/styles.css"), "utf8");
  assert(!/portal-footer|position:\s*fixed|padding-bottom:\s*120px/.test(styles));
  assert(!/localStorage|sessionStorage/.test(source));
});
