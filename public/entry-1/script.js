"use strict";

const form = document.getElementById("archive-form");
const archiveInput = document.getElementById("archive-number");
const submitButton = document.getElementById("submit-button");
const error = document.getElementById("archive-error");
const evidenceStatus = document.getElementById("evidence-status");
const fileStatus = document.getElementById("file-status");
const checkingStatus = document.getElementById("checking-status");
let accessPending = false;

function normalizeArchiveNumber(value) {
  return value.trim().replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (accessPending) return;

  const code = normalizeArchiveNumber(archiveInput.value);
  accessPending = true;
  error.textContent = "";
  archiveInput.removeAttribute("aria-invalid");
  archiveInput.disabled = true;
  submitButton.disabled = true;
  form.setAttribute("aria-busy", "true");
  checkingStatus.textContent = "در حال بررسی…";

  // A short checking state also guards rapid button and keyboard submissions.
  window.setTimeout(() => {
    form.removeAttribute("aria-busy");
    checkingStatus.textContent = "";
    if (code !== "0806") {
      accessPending = false;
      archiveInput.disabled = false;
      submitButton.disabled = false;
      error.textContent = code === ""
        ? "لطفا شماره بایگانی را وارد کنید."
        : "شماره بایگانی در سامانه یافت نشد. اطلاعات واردشده را بررسی کنید.";
      archiveInput.setAttribute("aria-invalid", "true");
      archiveInput.focus();
      return;
    }

    archiveInput.blur();
    evidenceStatus.innerHTML = 'مدرک <bdi dir="ltr">E-02</bdi> تایید شد';

    // Keep both confirmations readable without depending on animation events.
    window.setTimeout(() => {
      fileStatus.textContent = "دسترسی به پرونده فعال شد.";
      window.setTimeout(() => {
        showInternalView("destination-view", "destination-title", "پرونده CASE 011");
      }, 2200);
    }, 2000);
  }, 520);
});

archiveInput.addEventListener("input", () => {
  if (accessPending) return;
  error.textContent = "";
  archiveInput.removeAttribute("aria-invalid");
});

const internalViews = ["access-view", "destination-view", "evidence-view"];
const evidenceButton = document.getElementById("open-evidence");
let suspectScrollPosition = 0;

function showInternalView(viewId, focusId, title, scrollPosition = 0) {
  for (const id of internalViews) {
    const view = document.getElementById(id);
    view.hidden = id !== viewId;
    view.inert = id !== viewId;
  }
  document.title = title;
  document.getElementById(focusId).focus({ preventScroll: true });
  window.scrollTo({ top: scrollPosition, left: 0, behavior: "instant" });
}

evidenceButton.addEventListener("click", () => {
  if (document.getElementById("destination-view").hidden) return;
  suspectScrollPosition = window.scrollY;
  showInternalView("evidence-view", "requirements-title", "EVIDENCE 03");
});

document.getElementById("return-suspects").addEventListener("click", () => {
  if (document.getElementById("evidence-view").hidden) return;
  // Retain the existing nodes so native details elements keep their open state.
  document.getElementById("destination-view").setAttribute("data-restored", "true");
  showInternalView("destination-view", "open-evidence", "پرونده CASE 011", suspectScrollPosition);
});

for (const image of document.querySelectorAll(".suspect-portrait img")) {
  const showFallback = () => {
    image.hidden = true;
    image.nextElementSibling.hidden = false;
  };
  image.addEventListener("error", showFallback, { once: true });
  if (image.complete && image.naturalWidth === 0) showFallback();
}

const soundToggle = document.getElementById("sound-toggle");
const soundLabel = document.getElementById("sound-label");
const soundStatus = document.getElementById("sound-status");
let audioContext;
let ambientGain;
let soundEnabled = false;

function updateSoundLabel() {
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundLabel.textContent = soundEnabled
    ? "صدا روشن است · خاموش کردن"
    : "صدا خاموش است · روشن کردن";
}

function createAmbientSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error("Web Audio is unavailable");
  audioContext = new AudioContext();
  ambientGain = audioContext.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(audioContext.destination);

  // Quiet sine tones create an original ambience without downloaded assets.
  for (const frequency of [58, 87.1, 116.2]) {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(ambientGain);
    oscillator.start();
  }
}

function silenceAudio() {
  if (!ambientGain) return;
  ambientGain.gain.cancelScheduledValues(audioContext.currentTime);
  ambientGain.gain.setValueAtTime(0, audioContext.currentTime);
}

function audioUnavailable() {
  soundEnabled = false;
  silenceAudio();
  if (audioContext) audioContext.suspend().catch(() => {});
  updateSoundLabel();
  soundStatus.textContent = "پخش صدا در این مرورگر در دسترس نیست.";
}

function syncAudio() {
  if (!audioContext) return;
  if (!soundEnabled || document.hidden) {
    silenceAudio();
    audioContext.suspend().catch(() => {});
    return;
  }
  audioContext.resume().then(() => {
    // A mute or visibility change can occur while resume is pending.
    if (!soundEnabled || document.hidden) {
      silenceAudio();
      return audioContext.suspend().catch(() => {});
    }
    if (audioContext.state !== "running") {
      audioUnavailable();
      return;
    }
    ambientGain.gain.setTargetAtTime(0.008, audioContext.currentTime, 0.4);
  }).catch(() => {
    if (soundEnabled) audioUnavailable();
  });
}

soundToggle.addEventListener("click", () => {
  soundStatus.textContent = "";
  soundEnabled = !soundEnabled;
  updateSoundLabel();
  try {
    if (soundEnabled && !audioContext) createAmbientSound();
    syncAudio();
  } catch {
    audioUnavailable();
  }
});

document.addEventListener("visibilitychange", syncAudio);
window.addEventListener("pagehide", () => {
  if (!audioContext) return;
  silenceAudio();
  audioContext.suspend().catch(() => {});
});
window.addEventListener("pageshow", syncAudio);
