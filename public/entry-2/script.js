"use strict";

const comparisonForm = document.getElementById("comparison-form");
const slots = [...document.querySelectorAll(".operator-slot")];
const operatorKeys = [...document.querySelectorAll(".operator-key")];
const submitResult = document.getElementById("submit-result");
const comparisonError = document.getElementById("comparison-error");
const databaseStatus = document.getElementById("database-status");
const checkingState = document.getElementById("checking-state");
const choices = Array(slots.length).fill(null);
let selectedSlot = 0;
let resultPending = false;

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
  checkingState.hidden = false;
  databaseStatus.textContent = checkingState.textContent;

  // Timers control the narrative sequence independently of CSS animation support.
  window.setTimeout(() => {
    checkingState.hidden = true;
    const match = document.getElementById("match-output");
    match.hidden = false;
    databaseStatus.textContent = match.textContent.trim();
    window.setTimeout(() => {
      const reference = document.getElementById("reference-output");
      reference.hidden = false;
      databaseStatus.textContent = reference.textContent;
      window.setTimeout(() => {
        const warning = document.getElementById("warning-output");
        warning.hidden = false;
        databaseStatus.textContent = warning.textContent.trim();
        comparisonForm.removeAttribute("aria-busy");
      }, 1200);
    }, 1200);
  }, 700);
});

renderSlots();
