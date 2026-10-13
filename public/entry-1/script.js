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

const internalViews = ["access-view", "destination-view", "evidence-view", "category-view", "pdf-view"];
const evidenceButton = document.getElementById("open-evidence");
const documentsButton = document.getElementById("selected-documents");
const lockedDocumentsDialog = document.getElementById("locked-documents-dialog");
const confirmLockedDocuments = document.getElementById("confirm-locked-documents");
const lockedDialogBackdrop = document.getElementById("locked-dialog-backdrop");
const nativeLockedDialog = typeof lockedDocumentsDialog.showModal === "function";
const categoryPanel = document.getElementById("document-categories");
const pdfContainer = document.getElementById("pdf-container");
const soundControl = document.getElementById("sound-control");
let documentsUnlocked = false;
let suspectScrollPosition = 0;
let suspectReturnFocus = "open-evidence";
let activeCategoryKey = null;
let categoryScrollPosition = 0;
let categoryReturnFocus = "category-title";

function renderDocumentsControl() {
  documentsButton.setAttribute("aria-disabled", String(!documentsUnlocked));
  documentsButton.setAttribute("data-state", documentsUnlocked ? "unlocked" : "locked");
  const lockIcon = document.getElementById("documents-lock");
  // SVG elements require the attribute; HTMLElement.hidden is not reflected here.
  if (documentsUnlocked) lockIcon.setAttribute("hidden", "");
  else lockIcon.removeAttribute("hidden");
  if (!documentsUnlocked) categoryPanel.hidden = true;
  documentsButton.setAttribute("aria-expanded", String(!categoryPanel.hidden));
}

renderDocumentsControl();

const documentCategories = {
  nora: [
    { title: "نامه انگشت‌نگاری و پزشکی قانونی", url: "assets/evidence/nora-fingerprint-forensic-report.pdf" },
    { title: "گزارش تحقیقات محلی", subtitle: "استعلام بانکی و مصاحبه حضوری با فروشنده سوپرمارکت", url: "assets/evidence/nora-local-inquiry-report.pdf" }
  ],
  arash: [{ title: "استعلام مخابرات", url: "assets/evidence/arash-telecom-record.pdf" }],
  kamran: [
    { title: "استعلام مخابرات خط تلفن کامران فرهمند", url: "assets/evidence/kamran-telecom-record.pdf" },
    { title: "گزارش بررسی تصویر دوربین مدار بسته", url: "assets/evidence/cctv-footage-review-report.pdf" }
  ]
};

function showInternalView(viewId, focusId, title, scrollPosition = 0) {
  // Move the same control and handlers; audio preference and context stay intact.
  document.getElementById(`sound-slot-${viewId}`).append(soundControl);
  if (viewId !== "pdf-view") pdfContainer.replaceChildren();
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
  suspectReturnFocus = "open-evidence";
  showInternalView("evidence-view", "requirements-title", "EVIDENCE 03");
});

document.getElementById("return-suspects").addEventListener("click", () => {
  if (document.getElementById("evidence-view").hidden) return;
  documentsUnlocked = true;
  renderDocumentsControl();
  returnToSuspects();
});

function returnToSuspects() {
  // Retain the existing nodes so native details elements keep their open state.
  document.getElementById("destination-view").setAttribute("data-restored", "true");
  showInternalView("destination-view", suspectReturnFocus, "پرونده CASE 011", suspectScrollPosition);
}

documentsButton.addEventListener("click", () => {
  if (document.getElementById("destination-view").hidden) return;
  if (!documentsUnlocked) {
    if (!lockedDocumentsDialog.open) {
      if (nativeLockedDialog) lockedDocumentsDialog.showModal();
      else {
        // Older mobile browsers still need a visible, keyboard-contained modal.
        lockedDialogBackdrop.hidden = false;
        lockedDocumentsDialog.setAttribute("data-fallback", "true");
        lockedDocumentsDialog.setAttribute("open", "");
        lockedDocumentsDialog.open = true;
        document.querySelector(".portal").inert = true;
      }
      confirmLockedDocuments.focus();
    }
    return;
  }
  categoryPanel.hidden = !categoryPanel.hidden;
  renderDocumentsControl();
});

function closeLockedDocuments() {
  if (nativeLockedDialog) lockedDocumentsDialog.close();
  else {
    lockedDocumentsDialog.removeAttribute("open");
    lockedDocumentsDialog.open = false;
    lockedDialogBackdrop.hidden = true;
    document.querySelector(".portal").inert = false;
    documentsButton.focus({ preventScroll: true });
  }
}
confirmLockedDocuments.addEventListener("click", closeLockedDocuments);
lockedDocumentsDialog.addEventListener("close", () => documentsButton.focus({ preventScroll: true }));
document.addEventListener("keydown", (event) => {
  if (nativeLockedDialog || !lockedDocumentsDialog.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeLockedDocuments();
  } else if (event.key === "Tab") {
    event.preventDefault();
    confirmLockedDocuments.focus();
  }
});
document.addEventListener("focusin", () => {
  if (!nativeLockedDialog && lockedDocumentsDialog.open && document.activeElement !== confirmLockedDocuments) {
    confirmLockedDocuments.focus();
  }
});

for (const button of categoryPanel.querySelectorAll("button")) {
  button.id = `category-${button.dataset.category}`;
  button.addEventListener("click", () => {
    if (!documentsUnlocked || categoryPanel.hidden || document.getElementById("destination-view").hidden) return;
    suspectScrollPosition = window.scrollY;
    suspectReturnFocus = button.id;
    activeCategoryKey = button.dataset.category;
    categoryScrollPosition = 0;
    const title = button.textContent;
    document.getElementById("category-title").textContent = title;
    const list = document.getElementById("document-list");
    list.replaceChildren();
    for (const [index, record] of documentCategories[activeCategoryKey].entries()) {
      const item = document.createElement("li");
      const open = document.createElement("button");
      open.type = "button";
      open.id = `document-${activeCategoryKey}-${index}`;
      open.className = "document-control document-item";
      open.textContent = record.title;
      open.disabled = true;
      const status = document.createElement("p");
      status.className = "document-status";
      status.textContent = "در حال بررسی دسترسی به فایل…";
      item.append(open);
      if (record.subtitle) {
        const subtitle = document.createElement("p");
        subtitle.textContent = record.subtitle;
        subtitle.className = "document-subtitle";
        item.append(subtitle);
      }
      item.append(status);
      list.append(item);
      // HEAD checks availability without downloading a PDF before selection.
      fetch(record.url, { method: "HEAD", cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("PDF unavailable");
        open.disabled = false;
        status.textContent = "";
      }).catch(() => {
        status.textContent = "فایل در دسترس نیست.";
        console.warn(`Expected PDF: public/entry-1/${record.url}`);
      });
      open.addEventListener("click", () => {
        categoryScrollPosition = window.scrollY;
        categoryReturnFocus = open.id;
        document.getElementById("pdf-title").textContent = record.title;
        document.getElementById("pdf-link").href = record.url;
        const frame = document.createElement("iframe");
        frame.className = "pdf-frame";
        frame.title = record.title;
        frame.src = record.url;
        pdfContainer.replaceChildren(frame);
        showInternalView("pdf-view", "pdf-title", record.title);
      });
    }
    showInternalView("category-view", "category-title", title);
  });
}

document.getElementById("return-category").addEventListener("click", returnToSuspects);
document.getElementById("return-pdf").addEventListener("click", returnToSuspects);

document.getElementById("return-document-list").addEventListener("click", () => {
  if (document.getElementById("pdf-view").hidden || !activeCategoryKey) return;
  // Keep the originating list nodes and their availability state intact.
  showInternalView("category-view", categoryReturnFocus,
    document.getElementById("category-title").textContent, categoryScrollPosition);
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
let soundRequested = false;
let soundRevision = 0;

function updateSoundLabel() {
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.setAttribute("aria-label", soundEnabled ? "خاموش کردن صدا" : "روشن کردن صدا");
  soundLabel.textContent = soundEnabled
    ? "صدا روشن"
    : "صدا خاموش";
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
  soundRequested = false;
  soundEnabled = false;
  silenceAudio();
  if (audioContext) audioContext.suspend().catch(() => {});
  updateSoundLabel();
  soundStatus.textContent = "پخش صدا در این مرورگر در دسترس نیست.";
}

function syncAudio() {
  if (!audioContext) return;
  const revision = soundRevision;
  if (!soundRequested || document.hidden) {
    silenceAudio();
    audioContext.suspend().catch(() => {});
    return;
  }
  audioContext.resume().then(() => {
    // A mute or visibility change can occur while resume is pending.
    if (revision !== soundRevision) return;
    if (!soundRequested || document.hidden) {
      silenceAudio();
      return audioContext.suspend().catch(() => {});
    }
    if (audioContext.state !== "running") {
      audioUnavailable();
      return;
    }
    ambientGain.gain.setTargetAtTime(0.008, audioContext.currentTime, 0.4);
    soundEnabled = true;
    updateSoundLabel();
  }).catch(() => {
    if (revision === soundRevision && soundRequested) audioUnavailable();
  });
}

soundToggle.addEventListener("click", () => {
  soundStatus.textContent = "";
  soundRequested = !soundRequested;
  soundRevision++;
  if (!soundRequested) {
    soundEnabled = false;
    updateSoundLabel();
  }
  try {
    if (soundRequested && !audioContext) createAmbientSound();
    // No await, timer, or deferred work precedes resume in this user gesture.
    syncAudio();
  } catch {
    audioUnavailable();
  }
});
updateSoundLabel();

document.addEventListener("visibilitychange", syncAudio);
window.addEventListener("pagehide", () => {
  if (!audioContext) return;
  silenceAudio();
  audioContext.suspend().catch(() => {});
});
window.addEventListener("pageshow", syncAudio);
