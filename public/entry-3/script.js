"use strict";

const form = document.getElementById("evidence-form");
const letter = document.getElementById("evidence-letter");
const number = document.getElementById("evidence-number");
const identifierField = document.querySelector(".identifier-field");
const searchButton = document.getElementById("search-button");
const error = document.getElementById("search-error");
const status = document.getElementById("archive-status");
const record = document.getElementById("recovered-record");
const retrieval = document.getElementById("retrieval-state");
const warning = document.getElementById("archive-warning");
const detailsButton = document.getElementById("view-details");
const shell = document.querySelector(".archive-shell");
const backdrop = document.getElementById("warning-backdrop");
const nativeDialog = typeof warning.showModal === "function";
let retrieving = false;
let recovered = false;

function normalizeDigits(value) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}
function clearError() {
  error.textContent = "";
  identifierField.removeAttribute("aria-invalid");
  letter.removeAttribute("aria-invalid");
  number.removeAttribute("aria-invalid");
}
letter.addEventListener("input", () => { letter.value = letter.value.toUpperCase().slice(0, 1); clearError(); });
number.addEventListener("input", () => { number.value = normalizeDigits(number.value).slice(0, 2); clearError(); });

function openWarning() {
  if (warning.open || document.getElementById("search-view").hidden) return;
  if (nativeDialog) warning.showModal();
  else {
    warning.setAttribute("data-fallback", "true");
    warning.setAttribute("open", "");
    warning.open = true;
    backdrop.hidden = false;
    shell.inert = true;
  }
  detailsButton.focus({ preventScroll: true });
}
warning.addEventListener("cancel", (event) => event.preventDefault());
document.addEventListener("keydown", (event) => {
  if (!warning.open || nativeDialog) return;
  if (event.key === "Tab" || event.key === "Escape") {
    event.preventDefault();
    detailsButton.focus();
  }
});
document.addEventListener("focusin", () => {
  if (!nativeDialog && warning.open && document.activeElement !== detailsButton) detailsButton.focus();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (retrieving || recovered) return;
  letter.value = letter.value.toUpperCase();
  number.value = normalizeDigits(number.value);
  clearError();
  if (!/^[A-Z]$/.test(letter.value) || !/^\d{2}$/.test(number.value)) {
    error.textContent = "شناسه مدرک را بهصورت یک حرف انگلیسی و دو رقم وارد کنید.";
    identifierField.setAttribute("aria-invalid", "true");
    const invalidField = /^[A-Z]$/.test(letter.value) ? number : letter;
    invalidField.setAttribute("aria-invalid", "true");
    invalidField.focus();
    return;
  }
  if (`${letter.value}-${number.value}` !== "B-11") {
    error.textContent = "مدرکی با این شناسه در بایگانی یافت نشد.";
    return;
  }
  retrieving = true;
  for (const control of [letter, number, searchButton]) control.disabled = true;
  form.setAttribute("aria-busy", "true");
  document.getElementById("record-area").setAttribute("aria-busy", "true");
  document.getElementById("record-idle").hidden = true;
  retrieval.hidden = false;
  status.textContent = "در حال بازیابی مدرک";
  // Blur the field so the native keyboard can close before the recovered record.
  document.activeElement.blur();
  window.setTimeout(() => {
    retrieving = false;
    recovered = true;
    retrieval.hidden = true;
    record.hidden = false;
    form.removeAttribute("aria-busy");
    document.getElementById("record-area").setAttribute("aria-busy", "false");
    document.getElementById("record-title").focus({ preventScroll: true });
    record.scrollIntoView({ block: "nearest", behavior: "instant" });
    status.textContent = "Evidence B-11. Status: Recovered. Recovery Date: 2026. Case Reopened";
    status.setAttribute("lang", "en");
    window.setTimeout(openWarning, 1500);
  }, 800);
});

detailsButton.addEventListener("click", () => {
  if (!recovered || !warning.open) return;
  if (nativeDialog) warning.close();
  else {
    warning.removeAttribute("open");
    warning.open = false;
    backdrop.hidden = true;
    shell.inert = false;
  }
  const search = document.getElementById("search-view");
  search.hidden = true;
  search.inert = true;
  const details = document.getElementById("details-view");
  details.hidden = false;
  details.inert = false;
  document.getElementById("details-title").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
});

const soundToggle = document.getElementById("sound-toggle");
const soundError = document.getElementById("sound-error");
let audioContext;
let masterGain;
let soundRequested = false;
let soundRevision = 0;

function renderSound(enabled) {
  soundToggle.setAttribute("aria-pressed", String(enabled));
  soundToggle.setAttribute("aria-label", enabled ? "خاموش کردن صدا" : "روشن کردن صدا");
}
function createAmbience() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) throw new Error("Web Audio is unavailable");
  audioContext = new Context();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(audioContext.destination);
  // Soft filtered room texture and a slowly breathing low archival hum.
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 4, audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 180;
  const noiseGain = audioContext.createGain();
  noiseGain.gain.value = 0.04;
  noise.connect(filter).connect(noiseGain).connect(masterGain);
  noise.start();
  const hum = audioContext.createOscillator();
  hum.frequency.value = 72;
  const humGain = audioContext.createGain();
  humGain.gain.value = 0.009;
  hum.connect(humGain).connect(masterGain);
  hum.start();
  const breathing = audioContext.createOscillator();
  breathing.frequency.value = 0.08;
  const depth = audioContext.createGain();
  depth.gain.value = 0.003;
  breathing.connect(depth).connect(humGain.gain);
  breathing.start();
}
function silence() {
  if (!masterGain) return;
  masterGain.gain.cancelScheduledValues(audioContext.currentTime);
  masterGain.gain.setValueAtTime(0, audioContext.currentTime);
}
function audioUnavailable(revision) {
  if (revision !== soundRevision) return;
  soundRequested = false;
  silence();
  renderSound(false);
  soundError.textContent = "پخش صدا در این مرورگر در دسترس نیست.";
  if (audioContext) void audioContext.suspend().catch(() => {});
}
function resumeSound(revision) {
  try {
    if (!audioContext) createAmbience();
    // Called synchronously inside the activation handler, including on Safari.
    audioContext.resume().then(() => {
      if (revision !== soundRevision) return;
      if (!soundRequested || document.hidden) { silence(); return audioContext.suspend(); }
      if (audioContext.state !== "running") throw new Error("Audio activation was blocked");
      masterGain.gain.setTargetAtTime(0.3, audioContext.currentTime, 0.2);
      renderSound(true);
    }).catch(() => audioUnavailable(revision));
  } catch { audioUnavailable(revision); }
}
soundToggle.addEventListener("click", () => {
  soundRequested = !soundRequested;
  soundRevision++;
  soundError.textContent = "";
  if (soundRequested) resumeSound(soundRevision);
  else {
    silence();
    renderSound(false);
    if (audioContext) void audioContext.suspend().catch(() => audioUnavailable(soundRevision));
  }
});
function syncVisibility() {
  if (!audioContext) return;
  if (document.hidden) { silence(); void audioContext.suspend().catch(() => {}); }
  else if (soundRequested) resumeSound(soundRevision);
}
document.addEventListener("visibilitychange", syncVisibility);
window.addEventListener("pagehide", () => {
  if (audioContext) { silence(); void audioContext.suspend().catch(() => {}); }
});
window.addEventListener("pageshow", syncVisibility);
