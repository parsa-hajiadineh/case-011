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
let retrievalTimer;
let warningTimer;

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
  backgroundMusic.playCue("notice");
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
    backgroundMusic.playCue("reject");
    error.textContent = "شناسه مدرک را به‌صورت یک حرف انگلیسی و دو رقم وارد کنید.";
    identifierField.setAttribute("aria-invalid", "true");
    const invalidField = /^[A-Z]$/.test(letter.value) ? number : letter;
    invalidField.setAttribute("aria-invalid", "true");
    invalidField.focus();
    return;
  }
  if (`${letter.value}-${number.value}` !== "B-11") {
    backgroundMusic.playCue("reject");
    error.textContent = "مدرکی با این شناسه در بایگانی یافت نشد.";
    return;
  }
  backgroundMusic.playCue("process");
  retrieving = true;
  for (const control of [letter, number, searchButton]) control.disabled = true;
  form.setAttribute("aria-busy", "true");
  document.getElementById("record-area").setAttribute("aria-busy", "true");
  document.getElementById("record-idle").hidden = true;
  retrieval.hidden = false;
  status.textContent = "بازیابی مدارک";
  // Blur the field so the native keyboard can close before the recovered record.
  document.activeElement.blur();
  retrievalTimer = window.setTimeout(() => {
    retrieving = false;
    recovered = true;
    backgroundMusic.playCue("confirm");
    retrieval.hidden = true;
    record.hidden = false;
    form.removeAttribute("aria-busy");
    document.getElementById("record-area").setAttribute("aria-busy", "false");
    document.getElementById("record-title").focus({ preventScroll: true });
    record.scrollIntoView({ block: "nearest", behavior: "instant" });
    status.textContent = "Evidence B-11. Status: Recovered. Recovery Date: 2026. Case Reopened";
    status.setAttribute("lang", "en");
    warningTimer = window.setTimeout(openWarning, 1500);
  }, 5000);
});

detailsButton.addEventListener("click", () => {
  if (!recovered || !warning.open) return;
  backgroundMusic.playCue("navigate");
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
const backgroundMusic = window.createBackgroundMusic({
  button: soundToggle,
  status: document.getElementById("sound-error"),
  effects: { frequency: 155, cutoff: 850, waveform: "triangle", texture: 0.75 }
});
backgroundMusic.watchInput(letter);
backgroundMusic.watchInput(number);
soundToggle.addEventListener("click", () => {
  if (ambienceBlocked && backgroundMusic.enabled) resumeAmbience = false;
  backgroundMusic.toggle();
});

const mediaDialog = document.getElementById("media-dialog");
const evidenceAudio = document.getElementById("evidence-audio");
const playRecording = document.getElementById("play-recording");
const seek = document.getElementById("audio-seek");
const mediaStatus = document.getElementById("media-status");
const graphic = document.getElementById("playback-graphic");
const audioPanel = document.getElementById("audio-panel");
let mediaStarted = false;
let mediaFailed = false;
let mediaRevision = 0;
let progressFrame;
let lastProgress = 0;
let lastMovement = 0;
let ambienceBlocked = false;
let resumeAmbience = false;

function stopAmbience() {
  if (ambienceBlocked) return;
  // Preserve the sound preference and music position while the recording owns audio.
  resumeAmbience = backgroundMusic.enabled;
  ambienceBlocked = true;
  backgroundMusic.setBlocked(true);
}
function restoreAmbience() {
  // Ignore queued pause/end events from an earlier playback attempt.
  if (!ambienceBlocked || !evidenceAudio.paused && !evidenceAudio.ended) return;
  ambienceBlocked = false;
  if (!resumeAmbience && backgroundMusic.enabled) backgroundMusic.toggle();
  resumeAmbience = false;
  backgroundMusic.setBlocked(false);
}
evidenceAudio.addEventListener("pause", restoreAmbience);
evidenceAudio.addEventListener("ended", restoreAmbience);
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}
function renderMedia() {
  const duration = evidenceAudio.duration;
  const usable = !mediaFailed && evidenceAudio.readyState >= 2;
  playRecording.disabled = !usable;
  seek.disabled = !usable || !Number.isFinite(duration) || duration <= 0;
  seek.max = Number.isFinite(duration) ? duration : 0;
  seek.value = evidenceAudio.currentTime;
  seek.setAttribute("aria-valuetext", formatTime(evidenceAudio.currentTime) + " / " + formatTime(duration));
  document.getElementById("elapsed").textContent = formatTime(evidenceAudio.currentTime);
  document.getElementById("duration").textContent = formatTime(duration);
  playRecording.textContent = evidenceAudio.paused ? "▶" : "Ⅱ";
  playRecording.setAttribute("aria-label", evidenceAudio.paused ? "پخش" : "توقف پخش");
}
function stopGraphic() {
  cancelAnimationFrame(progressFrame);
  graphic.classList.remove("is-playing");
}
function trackProgress(now) {
  if (evidenceAudio.paused || evidenceAudio.ended || mediaFailed || !mediaDialog.open || document.hidden) { stopGraphic(); return; }
  if (evidenceAudio.currentTime !== lastProgress) {
    lastMovement = now;
    lastProgress = evidenceAudio.currentTime;
  }
  graphic.classList.toggle("is-playing", evidenceAudio.readyState >= 3 && lastMovement > 0 && now - lastMovement < 350);
  renderMedia();
  progressFrame = requestAnimationFrame(trackProgress);
}
function attemptPlayback() {
  stopAmbience();
  const revision = ++mediaRevision;
  // Invoke play directly from the user gesture, before awaiting any media event.
  const attempt = evidenceAudio.play();
  if (attempt) attempt.catch(() => {
    if (revision !== mediaRevision || !mediaDialog.open || mediaFailed) return;
    restoreAmbience();
    mediaStatus.textContent = "برای پخش فایل صوتی، دکمه پخش را فشار دهید.";
    renderMedia();
  });
}
function closeMedia() {
  mediaRevision++;
  evidenceAudio.pause();
  restoreAmbience();
  stopGraphic();
  if (nativeDialog) mediaDialog.close();
  else { mediaDialog.removeAttribute("open"); backdrop.hidden = true; shell.inert = false; }
  document.body.classList.remove("dialog-open");
  document.getElementById("open-audio").focus({ preventScroll: true });
}
document.getElementById("open-audio").addEventListener("click", () => {
  if (mediaDialog.open) return;
  backgroundMusic.playCue("navigate");
  if (nativeDialog) mediaDialog.showModal();
  else { mediaDialog.setAttribute("open", ""); mediaDialog.dataset.fallback = "true"; backdrop.hidden = false; shell.inert = true; }
  document.body.classList.add("dialog-open");
  document.getElementById("close-media").focus({ preventScroll: true });
});
document.getElementById("close-media").addEventListener("click", closeMedia);
mediaDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeMedia(); });
mediaDialog.addEventListener("close", () => {
  if (mediaDialog.open) return;
  mediaRevision++;
  evidenceAudio.pause();
  restoreAmbience();
  stopGraphic();
  document.body.classList.remove("dialog-open");
});
document.getElementById("start-media").addEventListener("click", () => {
  if (mediaStarted) return;
  mediaStarted = true;
  document.getElementById("audio-warning").hidden = true;
  audioPanel.hidden = false;
  mediaDialog.removeAttribute("aria-describedby");
  document.getElementById("show-note").focus({ preventScroll: true });
  attemptPlayback();
});
playRecording.addEventListener("click", () => {
  if (evidenceAudio.paused) attemptPlayback();
  else { mediaRevision++; evidenceAudio.pause(); }
});
seek.addEventListener("input", () => {
  if (!seek.disabled) { evidenceAudio.currentTime = Number(seek.value); renderMedia(); }
});
for (const name of ["loadedmetadata", "durationchange", "timeupdate", "pause", "ended", "canplay", "seeked"]) {
  evidenceAudio.addEventListener(name, () => {
    if (name === "canplay") { mediaFailed = false; mediaStatus.textContent = ""; }
    if (name === "pause" || name === "ended") stopGraphic();
    renderMedia();
  });
}
evidenceAudio.addEventListener("play", stopAmbience);
evidenceAudio.addEventListener("playing", () => {
  mediaStatus.textContent = "";
  stopGraphic();
  lastProgress = evidenceAudio.currentTime;
  lastMovement = 0;
  progressFrame = requestAnimationFrame(trackProgress);
});
for (const name of ["waiting", "stalled", "seeking"]) evidenceAudio.addEventListener(name, () => {
  stopGraphic();
  if (!evidenceAudio.paused) mediaStatus.textContent = "در حال بارگذاری فایل صوتی…";
});
evidenceAudio.addEventListener("error", () => {
  mediaFailed = true;
  mediaRevision++;
  evidenceAudio.pause();
  restoreAmbience();
  stopGraphic();
  mediaStatus.textContent = "فایل صوتی در دسترس نیست.";
  renderMedia();
});
document.getElementById("show-note").addEventListener("click", () => {
  if (document.getElementById("investigator-note").hidden) backgroundMusic.playCue("reveal");
  document.getElementById("investigator-note").hidden = false;
  document.getElementById("show-note").setAttribute("aria-expanded", "true");
  document.getElementById("note-title").focus({ preventScroll: true });
  document.getElementById("investigator-note").scrollIntoView({ block: "nearest" });
});
document.getElementById("open-timeline").addEventListener("click", () => {
  closeMedia();
  const details = document.getElementById("details-view");
  details.hidden = true;
  details.inert = true;
  const timeline = document.getElementById("timeline-view");
  timeline.hidden = false;
  timeline.inert = false;
  window.scrollTo({ top: 0, behavior: "instant" });
  document.getElementById("timeline-title").focus({ preventScroll: true });
});
// Keep keyboard focus within the dialog, including compatibility fallback browsers.
document.addEventListener("keydown", (event) => {
  if (!mediaDialog.open) return;
  if (event.key === "Escape") { event.preventDefault(); closeMedia(); }
  if (event.key !== "Tab") return;
  const controls = [...mediaDialog.querySelectorAll("button, input")].filter((element) => !element.disabled && element.getClientRects().length);
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
document.addEventListener("focusin", () => {
  if (!nativeDialog && mediaDialog.open && !mediaDialog.contains(document.activeElement)) document.getElementById("close-media").focus();
});
document.addEventListener("visibilitychange", () => { if (document.hidden) { evidenceAudio.pause(); stopGraphic(); } });
window.addEventListener("pagehide", () => {
  clearTimeout(retrievalTimer);
  clearTimeout(warningTimer);
  evidenceAudio.pause();
  stopGraphic();
});
