import { entry4Config } from './config.js';

const backgroundMusic = window.createBackgroundMusic({
  button: document.getElementById('sound-toggle'),
  status: document.getElementById('sound-status'),
  effects: { frequency: 260, cutoff: 1400, waveform: 'triangle', texture: 0.45 }
});
document.getElementById('sound-toggle').addEventListener('click', () => backgroundMusic.toggle());

const workspace = document.getElementById('workspace');
const progress = new Map(entry4Config.hintSections.map(({ id }) => [id, 0]));
const testNames = ['بررسی اول', 'بررسی دوم', 'بررسی سوم'];
let currentTest = -1;
let accessGranted = false;
let transitionPending = false;
let welcomeTimer;

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className = 'primary') {
  const node = element('button', className, text);
  node.type = 'button';
  return node;
}
function focusHeading(heading) {
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
function mount(view, heading) {
  workspace.replaceChildren(view);
  window.scrollTo({ top: 0, behavior: 'instant' });
  focusHeading(heading);
}
function createView(testIndex) {
  const view = element('section', 'view');
  if (testIndex !== undefined) {
    const top = element('div', 'view-topline');
    top.append(element('p', 'view-kicker', 'بررسی آشنایی'));
    const steps = element('ol', 'progress');
    steps.setAttribute('aria-label', 'روند بررسی');
    testNames.forEach((name, index) => {
      const step = element('li', index < testIndex ? 'complete' : '');
      step.setAttribute('aria-label', name);
      if (index === testIndex) step.setAttribute('aria-current', 'step');
      steps.append(step);
    });
    top.append(steps);
    view.append(top);
  }
  const panel = element('div', 'paper-panel');
  view.append(panel);
  return { view, panel };
}
function status(className = 'form-message') {
  const node = element('p', className);
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  return node;
}
function showImageTest(index) {
  if (index !== currentTest || index > 1 || accessGranted) return;
  const test = entry4Config.imageTests?.[index];
  const loaded = [false, false, false];
  const { view, panel } = createView(index);
  panel.append(element('p', 'test-number', testNames[index]));
  const title = element('h1', '', test.question);
  title.id = 'test-title';
  view.setAttribute('aria-labelledby', title.id);
  panel.append(title);
  const form = element('form');
  const fieldset = element('fieldset', 'choice-fieldset');
  fieldset.append(element('legend', '', 'انتخاب تصویر'));
  const choices = element('div', 'image-choices');
  const radios = [];
  const submit = button('تأیید انتخاب');
  submit.type = 'submit';
  submit.disabled = true;
  const message = status();
  message.id = 'image-message';
  const refreshSelection = () => {
    radios.forEach((radio, optionIndex) => {
      radio.disabled = !loaded[optionIndex];
      if (radio.disabled) radio.checked = false;
    });
    submit.disabled = !radios.some((radio) => radio.checked && !radio.disabled);
  };
  for (let optionIndex = 0; optionIndex < 3; optionIndex++) {
    const option = test?.options?.[optionIndex];
    const label = element('label', 'image-choice');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'image-choice';
    radio.value = String(optionIndex + 1);
    radio.disabled = true;
    radio.setAttribute('aria-describedby', message.id);
    radios.push(radio);
    radio.addEventListener('change', () => {
      backgroundMusic.playCue('select');
      message.textContent = '';
      refreshSelection();
    });
    const card = element('span', 'choice-card');
    const frame = element('span', 'choice-image');
    const fallback = element('span', 'image-placeholder', 'تصویر در دسترس نیست');
    fallback.hidden = true;
    fallback.setAttribute('aria-hidden', 'true');
    frame.append(fallback);
    if (hasText(option?.image)) {
      const image = element('img');
      image.alt = '';
      image.hidden = true;
      image.addEventListener('load', () => {
        loaded[optionIndex] = image.naturalWidth > 0;
        image.hidden = !loaded[optionIndex];
        fallback.hidden = loaded[optionIndex];
        refreshSelection();
      });
      image.addEventListener('error', () => {
        loaded[optionIndex] = false;
        image.hidden = true;
        fallback.hidden = false;
        refreshSelection();
      });
      image.src = option.image;
      frame.append(image);
    }
    card.append(frame, element('span', 'choice-label', hasText(option?.label) ? option.label : `تصویر ${['۱', '۲', '۳'][optionIndex]}`));
    label.append(radio, card);
    choices.append(label);
  }
  fieldset.append(choices);
  const footer = element('div', 'form-footer');
  footer.append(message, submit);
  form.append(fieldset, footer);
  panel.append(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (index !== currentTest || transitionPending) return;
    const selected = radios.find((radio) => radio.checked && !radio.disabled);
    if (!selected) { backgroundMusic.playCue('reject'); message.textContent = 'ابتدا یک تصویر انتخاب کنید.'; return; }
    if (Number(selected.value) !== test.correctOption) {
      backgroundMusic.playCue('reject');
      message.textContent = 'پاسخ درست نیست. دوباره بررسی کنید.';
      return;
    }
    backgroundMusic.playCue('confirm');
    submit.disabled = true;
    currentTest++;
    if (currentTest === 1) showImageTest(1);
    else showMathTest();
  });
  mount(view, title);
}

function shape(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('class', 'shape');
  svg.setAttribute('aria-hidden', 'true');
  const types = { circle: ['circle', { cx: 16, cy: 16, r: 11 }], triangle: ['path', { d: 'M16 4 29 27H3Z' }], square: ['rect', { x: 5, y: 5, width: 22, height: 22 }] };
  const [tag, attributes] = types[name];
  const symbol = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => symbol.setAttribute(key, value));
  svg.append(symbol);
  return svg;
}
function normalizeDigit(value) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit <= '۹' && digit >= '۰' ? 1776 : 1632))).replace(/[^0-9]/g, '').slice(0, 1);
}
function showMathTest() {
  if (currentTest !== 2 || accessGranted) return;
  const { view, panel } = createView(2);
  panel.classList.add('math-panel');
  panel.append(element('p', 'test-number', testNames[2]));
  const title = element('h1', '', 'مقدار هر نماد را وارد کنید.');
  title.id = 'math-title';
  view.setAttribute('aria-labelledby', title.id);
  panel.append(title);
  const equation = element('figure', 'arithmetic');
  equation.dir = 'ltr';
  equation.setAttribute('role', 'img');
  equation.setAttribute('aria-label', 'جمع عمودی: دایره، مثلث، مربع؛ به‌علاوه دایره، دایره، مربع؛ برابر با مثلث، مربع، مربع. ستون‌ها از چپ: صدگان، دهگان، یکان.');
  [['', 'circle', 'triangle', 'square'], ['+', 'circle', 'circle', 'square'], ['', 'triangle', 'square', 'square']].forEach((row) => {
    row.forEach((symbol, column) => equation.append(column === 0 ? element('span', 'plus', symbol) : shape(symbol)));
  });
  panel.append(equation);
  const form = element('form');
  form.noValidate = true;
  const fields = element('div', 'symbol-fields');
  const inputs = [];
  const message = status();
  message.id = 'math-message';
  [['circle', 'دایره'], ['triangle', 'مثلث'], ['square', 'مربع']].forEach(([name, text]) => {
    const label = element('label', 'symbol-field');
    const caption = element('span', 'symbol-label');
    caption.append(shape(name), element('span', '', text));
    const input = element('input');
    input.type = 'text';
    input.name = name;
    input.id = `symbol-${name}`;
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dir = 'ltr';
    input.enterKeyHint = name === 'square' ? 'done' : 'next';
    input.setAttribute('aria-describedby', message.id);
    // Normalize before limiting length so pasted Persian and Arabic digits work too.
    input.addEventListener('input', () => { input.value = normalizeDigit(input.value); });
    backgroundMusic.watchInput(input);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && name !== 'square') { event.preventDefault(); inputs[inputs.indexOf(input) + 1].focus(); }
    });
    inputs.push(input);
    label.append(caption, input);
    fields.append(label);
  });
  const submit = button('تأیید پاسخ');
  submit.type = 'submit';
  const footer = element('div', 'form-footer');
  footer.append(message, submit);
  form.append(fields, footer);
  panel.append(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (currentTest !== 2 || transitionPending || accessGranted) return;
    inputs.forEach((input) => { input.value = normalizeDigit(input.value); });
    if (inputs.some((input) => input.value === '')) { backgroundMusic.playCue('reject'); message.textContent = 'مقدار هر سه نماد را وارد کنید.'; return; }
    if (inputs.map((input) => input.value).join('') !== '370') { backgroundMusic.playCue('reject'); message.textContent = 'پاسخ درست نیست. محاسبه را دوباره بررسی کنید.'; return; }
    backgroundMusic.playCue('confirm');
    transitionPending = true;
    submit.disabled = true;
    inputs.forEach((input) => { input.disabled = true; });
    document.activeElement?.blur();
    const welcome = element('div', 'welcome');
    const welcomeText = element('p', '', 'خوش آمدید.');
    welcome.setAttribute('role', 'status');
    welcome.append(element('div', 'welcome-mark'), welcomeText);
    panel.replaceChildren(welcome);
    focusHeading(welcomeText);
    welcomeTimer = window.setTimeout(() => {
      accessGranted = true;
      transitionPending = false;
      showIndex();
    }, 1400);
  });
  mount(view, title);
}

function showIndex() {
  if (!accessGranted) return;
  const { view, panel } = createView();
  panel.classList.add('index-panel');
  const header = element('div', 'index-heading');
  const title = element('h1', '', 'فهرست مراحل');
  header.append(title, element('span', '', '01 — 07'));
  header.lastElementChild.dir = 'ltr';
  panel.append(header);
  const list = element('ol', 'evidence-list');
  for (const section of entry4Config.hintSections) {
    const item = element('li');
    const open = button('', 'evidence-open');
    const number = element('span', 'document-number', section.id === 'chest-code' ? '' : section.id.slice(-2));
    number.setAttribute('aria-hidden', 'true');
    const name = element('span', 'evidence-name', section.title);
    name.dir = 'ltr';
    name.lang = 'en';
    const arrow = element('span', 'evidence-arrow', '←');
    arrow.setAttribute('aria-hidden', 'true');
    open.append(number, name, arrow);
    open.dataset.sectionId = section.id;
    open.addEventListener('click', () => { backgroundMusic.playCue('navigate'); showEvidence(section.id); });
    item.append(open);
    list.append(item);
  }
  panel.append(list);
  mount(view, title);
}
function showEvidence(id) {
  const section = entry4Config.hintSections.find((item) => item.id === id);
  if (!accessGranted || !section) return;
  const { view, panel } = createView();
  const back = button('بازگشت به فهرست مراحل', 'return-button');
  back.addEventListener('click', () => { backgroundMusic.playCue('navigate'); showIndex(); });
  view.prepend(back);
  const title = element('h1', 'evidence-name', section.title);
  title.dir = 'ltr';
  title.lang = 'en';
  title.style.textAlign = 'right';
  panel.append(title);
  const notes = element('ol', 'note-stack');
  const actions = element('div', 'note-actions');
  const reveal = button('نمایش یادداشت اول');
  const content = section.hints;
  const appendNote = (noteIndex, animate) => {
    const note = element('li', 'note');
    note.dataset.number = String(noteIndex + 1).padStart(2, '0');
    if (!animate) note.style.animation = 'none';
    const paragraph = element('p');
    // Isolate Latin identifiers without changing the exact authored text.
    content[noteIndex].split(/(Evidence ID|E-06|B-11|UV)/g).forEach((part) => {
      if (/^(Evidence ID|E-06|B-11|UV)$/.test(part)) {
        const isolated = element('bdi', '', part);
        isolated.dir = 'ltr';
        paragraph.append(isolated);
      } else paragraph.append(document.createTextNode(part));
    });
    note.append(paragraph);
    notes.append(note);
    return note;
  };
  for (let noteIndex = 0; noteIndex < progress.get(id); noteIndex++) appendNote(noteIndex, false);
  function updateControl() {
    if (progress.get(id) === 3) { reveal.remove(); return; }
    const ready = hasText(content?.[progress.get(id)]);
    reveal.textContent = progress.get(id) === 0 ? 'نمایش یادداشت اول' : 'نمایش یادداشت بعدی';
    reveal.disabled = !ready;
  }
  reveal.addEventListener('click', () => {
    const next = progress.get(id);
    if (next >= 3 || !hasText(content?.[next])) return;
    backgroundMusic.playCue('reveal');
    const note = appendNote(next, true);
    progress.set(id, progress.get(id) + 1);
    updateControl();
    focusHeading(note);
    note.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  });
  actions.append(reveal);
  panel.append(notes, actions);
  updateControl();
  mount(view, title);
}

document.getElementById('begin').addEventListener('click', () => {
  if (currentTest !== -1) return;
  backgroundMusic.playCue('navigate');
  currentTest = 0;
  showImageTest(0);
});
window.addEventListener('pagehide', () => {
  // An interrupted welcome must not leave a restored page stuck indefinitely.
  if (transitionPending) {
    clearTimeout(welcomeTimer);
    accessGranted = true;
    transitionPending = false;
    showIndex();
  }
});
