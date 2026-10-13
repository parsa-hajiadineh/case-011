"use strict";

const comparisonForm = document.getElementById("comparison-form");
const slots = [...document.querySelectorAll(".operator-slot")];
const operatorKeys = [...document.querySelectorAll(".operator-key")];
const submitResult = document.getElementById("submit-result");
const comparisonError = document.getElementById("comparison-error");
const databaseStatus = document.getElementById("database-status");
const checkingState = document.getElementById("checking-state");
const outputScroll = document.getElementById("output-scroll");
const labHeader = document.querySelector(".lab-header");
const laboratory = document.querySelector(".laboratory");

function measureHeader() {
  // Use the actual wrapped header size in the dynamic mobile viewport budget.
  laboratory.style.setProperty("--header-height", `${labHeader.getBoundingClientRect().height}px`);
}
measureHeader();
const headerObserver = new ResizeObserver(measureHeader);
headerObserver.observe(labHeader);
const choices = Array(slots.length).fill(null);
let selectedSlot = 0;
let resultPending = false;

function revealOutput(section) {
  section.hidden = false;
  // Scroll only the bounded mobile output region, never the document viewport.
  if (window.matchMedia("(max-width: 900px)").matches) {
    const viewport = outputScroll.getBoundingClientRect();
    const target = section.getBoundingClientRect();
    const destination = target.height <= outputScroll.clientHeight
      ? target.bottom - viewport.bottom + outputScroll.scrollTop + 8
      : target.top - viewport.top + outputScroll.scrollTop - 8;
    outputScroll.scrollTo({ top: Math.max(0, destination), behavior: "instant" });
  }
}

function renderSlots() {
  slots.forEach((slot, index) => {
    const selected = index === selectedSlot;
    slot.setAttribute("aria-pressed", String(selected));
    slot.closest("tr").setAttribute("data-active", String(selected));
    slot.querySelector("span").textContent = choices[index] || "";
    const description = choices[index] === "=" ? "برابر" : choices[index] === "≠" ? "نابرابر" : "انتخاب مشخص نشده";
    slot.setAttribute("aria-label", `مقایسه A با ${slot.dataset.sample}؛ ${description}`);
  });
}

slots.forEach((slot, index) => {
  slot.addEventListener("click", () => {
    if (resultPending) return;
    selectedSlot = index;
    renderSlots();
  });
});

operatorKeys.forEach((key) => {
  key.addEventListener("click", () => {
    if (resultPending) return;
    const operator = key.dataset.operator;
    if (operator !== "=" && operator !== "≠") return;
    choices[selectedSlot] = operator;
    comparisonError.textContent = "";
    // Cycle from the current row so replacement also advances to an empty row.
    for (let offset = 1; offset <= choices.length; offset++) {
      const next = (selectedSlot + offset) % choices.length;
      if (choices[next] === null) {
        selectedSlot = next;
        break;
      }
    }
    renderSlots();
  });
});

comparisonForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (resultPending) return;
  comparisonError.textContent = "";
  if (choices.some((choice) => choice === null)) {
    comparisonError.textContent = "لطفا نتیجه هر چهار مقایسه را مشخص کنید.";
    return;
  }
  if (!choices.every((choice, index) => choice === (index === 1 ? "=" : "≠"))) {
    comparisonError.textContent = "تطبیقی با الگوی مرجع یافت نشد. نتیجه آزمایش را بررسی کنید.";
    return;
  }

  resultPending = true;
  [...slots, ...operatorKeys, submitResult].forEach((control) => { control.disabled = true; });
  comparisonForm.setAttribute("aria-busy", "true");
  document.getElementById("output-idle").setAttribute("hidden", "");
  revealOutput(checkingState);
  databaseStatus.textContent = checkingState.textContent;

  // Timers control the narrative sequence independently of CSS animation support.
  window.setTimeout(() => {
    checkingState.hidden = true;
    const match = document.getElementById("match-output");
    revealOutput(match);
    databaseStatus.textContent = match.textContent.trim();
    window.setTimeout(() => {
      const reference = document.getElementById("reference-output");
      revealOutput(reference);
      databaseStatus.textContent = reference.textContent;
      window.setTimeout(() => {
        const warning = document.getElementById("warning-output");
        revealOutput(warning);
        databaseStatus.textContent = warning.textContent.trim();
        comparisonForm.removeAttribute("aria-busy");
        const fadeDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
        window.setTimeout(() => {
          revealOutput(document.getElementById("open-original-record"));
          databaseStatus.textContent = "VIEW ORIGINAL RECORD";
        }, 2000 + fadeDuration);
      }, 1200);
    }, 1200);
  }, 700);
});

renderSlots();

const entryViews = ["database-view", "original-record-view", "decoded-record-view"];
const originalRecordButton = document.getElementById("open-original-record");
const decodedRecordButton = document.getElementById("open-decoded-record");
const corruptionNotice = document.getElementById("corruption-notice");
const recordStatus = document.getElementById("record-status");
let activeView = "database-view";
let decodingComplete = false;
let decodingTimer = null;
let decodingGeneration = 0;

function cancelDecoding() {
  window.clearTimeout(decodingTimer);
  decodingTimer = null;
  decodingGeneration++;
}

function showRecordView(viewId, focusId) {
  if (activeView === "original-record-view" && viewId !== activeView) cancelDecoding();
  activeView = viewId;
  for (const id of entryViews) {
    const view = document.getElementById(id);
    view.hidden = id !== viewId;
    view.inert = id !== viewId;
  }
  document.title = viewId === "database-view" ? "PATTERN DATABASE · CASE 011"
    : viewId === "original-record-view" ? "ORIGINAL RECORD · CASE 011" : "DECODED RECORD · CASE 011";
  document.getElementById(focusId).focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderDecodingState() {
  corruptionNotice.setAttribute("data-state", decodingComplete ? "ready" : "decoding");
  decodedRecordButton.hidden = !decodingComplete;
}

function startDecoding() {
  cancelDecoding();
  renderDecodingState();
  if (decodingComplete) return;
  const generation = decodingGeneration;
  const deadline = performance.now() + 15000;
  recordStatus.textContent = "در حال رمزگشایی پرونده.";
  const update = () => {
    if (generation !== decodingGeneration || activeView !== "original-record-view") return;
    const remaining = deadline - performance.now();
    if (remaining <= 0) {
      decodingTimer = null;
      decodingComplete = true;
      renderDecodingState();
      recordStatus.textContent = "رمزگشایی پرونده کامل شد.";
      return;
    }
    decodingTimer = window.setTimeout(update, Math.min(remaining, 250));
  };
  update();
}

originalRecordButton.addEventListener("click", () => {
  if (activeView !== "database-view" || originalRecordButton.hidden) return;
  showRecordView("original-record-view", "corruption-notice");
  startDecoding();
});

decodedRecordButton.addEventListener("click", () => {
  if (activeView !== "original-record-view" || !decodingComplete) return;
  showRecordView("decoded-record-view", "decoded-record-title");
});

window.addEventListener("pagehide", cancelDecoding);
window.addEventListener("pageshow", () => {
  if (activeView === "original-record-view" && !decodingComplete) startDecoding();
});

// International Morse letters, verified against ITU-R M.1677-1, Annex 1.
const morseAlphabet = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.",
  H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.",
  O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-",
  V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--.."
};
const recordMessage = "TAKE THE KEY AND FIND THE CHAIN IN THE KITCHEN";
const messageArea = document.getElementById("morse-message");
recordMessage.split(" ").forEach((word, index) => {
  if (index > 0) {
    const separator = document.createElement("span");
    separator.className = "morse-separator";
    separator.textContent = " / ";
    messageArea.append(separator);
  }
  const encodedWord = document.createElement("span");
  encodedWord.className = "morse-word";
  encodedWord.textContent = [...word].map((letter) => morseAlphabet[letter]).join(" ");
  messageArea.append(encodedWord);
});
