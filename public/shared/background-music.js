"use strict";

window.createBackgroundMusic = function ({ button, status, onChange = () => {}, effects }) {
  let audio;
  let enabled = false;
  let blocked = false;
  let leaving = false;
  let revision = 0;
  let context;
  let noiseBuffer;
  let voice;
  let lastCue = -Infinity;
  let lastInput = -Infinity;
  const cues = {
    input: [0.035, 0.22, 1, 0.8],
    select: [0.055, 0.5, 1.15, 0.85],
    navigate: [0.09, 0.55, 1, 0.72],
    process: [0.17, 0.45, 0.8, 1.12],
    confirm: [0.24, 0.65, 1.15, 1.65],
    reject: [0.14, 0.45, 0.85, 0.65],
    notice: [0.12, 0.45, 1, 0.9],
    reveal: [0.16, 0.5, 1, 1.3]
  };

  function silenceEffects(immediate = false) {
    if (!voice) return;
    const { envelope, sources } = voice;
    const now = context.currentTime;
    if (envelope.gain.cancelAndHoldAtTime) envelope.gain.cancelAndHoldAtTime(now);
    else {
      const level = envelope.gain.value;
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setValueAtTime(level, now);
    }
    envelope.gain.linearRampToValueAtTime(0, now + 0.006);
    if (immediate) envelope.disconnect();
    sources.forEach((source) => source.stop(immediate ? now : now + 0.008));
    voice = null;
  }

  function syncEffects(initialize = false) {
    if (!effects) return;
    try {
      if (blocked || leaving || document.hidden) {
        silenceEffects(true);
        if (context && context.state !== "closed") context.suspend().catch(() => {});
        return;
      }
      // Create the effects context only from an explicit user interaction.
      if (!context && initialize) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
        noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.3), context.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
      }
      if (context && context.state !== "closed" && context.state !== "running") context.resume().catch(() => {});
    } catch (_) {
      // Decorative audio must never interrupt the game or background playback.
    }
  }

  function playCue(name) {
    if (!effects || blocked || leaving || document.hidden || context?.state !== "running") return;
    const cue = cues[name];
    if (!cue) return;
    const now = context.currentTime;
    const input = name === "input";
    // Drop rapid cues and all cues during initialization; never queue playback.
    if (now - lastCue < 0.075 || (input && now - lastInput < 0.13)) return;
    try {
      silenceEffects();
      const [duration, level, start, end] = cue;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(level * 0.025, now + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.00001, now + duration);
      envelope.gain.linearRampToValueAtTime(0, now + duration + 0.006);
      envelope.connect(context.destination);
      const tone = context.createOscillator();
      tone.type = effects.waveform;
      tone.frequency.setValueAtTime(effects.frequency * start, now);
      tone.frequency.exponentialRampToValueAtTime(effects.frequency * end, now + duration);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = effects.cutoff;
      filter.Q.value = 0.5;
      tone.connect(filter).connect(envelope);
      const noise = context.createBufferSource();
      noise.buffer = noiseBuffer;
      const texture = context.createBiquadFilter();
      texture.type = "bandpass";
      texture.frequency.value = effects.cutoff;
      texture.Q.value = 0.6;
      const textureGain = context.createGain();
      textureGain.gain.value = effects.texture;
      noise.connect(texture).connect(textureGain).connect(envelope);
      const currentVoice = { envelope, sources: [tone, noise] };
      voice = currentVoice;
      tone.onended = () => {
        [tone, noise, filter, texture, textureGain, envelope].forEach((node) => node.disconnect());
        if (voice === currentVoice) voice = null;
      };
      for (const source of currentVoice.sources) {
        source.start(now);
        source.stop(now + duration + 0.008);
      }
      lastCue = now;
      if (input) lastInput = now;
    } catch (_) {
      // Unsupported or interrupted synthesis leaves all interactions usable.
    }
  }

  function render() {
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", enabled ? "خاموش کردن صدا" : "روشن کردن صدا");
    onChange(enabled);
  }

  function sync(initialize = false) {
    syncEffects(initialize === true);
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
      syncEffects();
      audio.pause();
      status.textContent = "پخش موسیقی در دسترس نیست؛ فایل صوتی را بررسی و دوباره تلاش کنید.";
      render();
    });
  }

  if (effects) {
    const activateEffects = (event) => {
      if (event.isTrusted) syncEffects(true);
    };
    for (const name of ["pointerup", "keydown", "click"]) {
      document.addEventListener(name, activateEffects, { capture: true });
    }
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { leaving = true; sync(); });
  window.addEventListener("pageshow", () => { leaving = false; sync(); });
  render();

  return {
    get enabled() { return enabled; },
    playCue,
    watchInput(input) {
      let previous = input.value;
      input.addEventListener("input", () => {
        if (input.value !== previous && input.value.length) playCue("input");
        previous = input.value;
      });
    },
    toggle() {
      enabled = !enabled;
      status.textContent = "";
      render();
      sync(true);
    },
    setBlocked(value) { blocked = value; sync(); }
  };
};
