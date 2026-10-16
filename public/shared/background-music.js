"use strict";

window.createBackgroundMusic = function ({ button, status, onChange = () => {} }) {
  let audio;
  let enabled = false;
  let blocked = false;
  let leaving = false;
  let revision = 0;

  function render() {
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", enabled ? "خاموش کردن صدا" : "روشن کردن صدا");
    onChange(enabled);
  }

  function sync() {
    const current = ++revision;
    if (!enabled || blocked || leaving || document.hidden) {
      if (audio) audio.pause();
      return;
    }
    if (!audio) {
      audio = new Audio("assets/audio/background.mp3");
      audio.loop = true;
      audio.preload = "none";
      audio.volume = 0.3;
    }
    // Start inside the click handler so browser activation is preserved.
    audio.play().catch(() => {
      if (current !== revision) return;
      enabled = false;
      audio.pause();
      status.textContent = "پخش موسیقی در دسترس نیست؛ فایل صوتی را بررسی و دوباره تلاش کنید.";
      render();
    });
  }

  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { leaving = true; sync(); });
  window.addEventListener("pageshow", () => { leaving = false; sync(); });
  render();

  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      status.textContent = "";
      render();
      sync();
    },
    setBlocked(value) { blocked = value; sync(); }
  };
};
