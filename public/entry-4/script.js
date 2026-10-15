import { entry4Config } from './config.js';

const workspace = document.getElementById('workspace');
const progress = Array(7).fill(0);
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
function configurationComplete(test) {
  return test && hasText(test.question) && Array.isArray(test.options) &&
    test.options.length === 3 && test.options.every((option) => hasText(option.image) && hasText(option.label)) &&
    Number.isInteger(test.correctOption) && test.correctOption >= 1 && test.correctOption <= 3;
}
function showImageTest(index) {
  if (index !== currentTest || index > 1 || accessGranted) return;
  const test = entry4Config.imageTests?.[index];
  const configured = configurationComplete(test);
  const loaded = [false, false, false];
  const { view, panel } = createView(index);
  panel.append(element('p', 'test-number', testNames[index]));
  const title = element('h1', '', hasText(test?.question) ? test.question : 'اطلاعات این بررسی هنوز تکمیل نشده است.');
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
  const availability = status('configuration-status');
  availability.textContent = configured ? 'در حال بررسی تصاویر…' : 'این بررسی هنوز آماده نیست.';
  const refreshAvailability = () => {
    const ready = configured && loaded.every(Boolean);
    submit.disabled = !ready;
    radios.forEach((radio) => { radio.disabled = !ready; });
    availability.textContent = ready ? '' : 'این بررسی هنوز آماده نیست.';
    availability.hidden = ready;
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
    const card = element('span', 'choice-card');
    const frame = element('span', 'choice-image');
    const fallback = element('span', 'image-placeholder', 'تصویر در دسترس نیست');
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
        refreshAvailability();
      });
      image.addEventListener('error', () => {
        loaded[optionIndex] = false;
        image.hidden = true;
        fallback.hidden = false;
        refreshAvailability();
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
  form.append(fieldset, availability, footer);
  panel.append(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (index !== currentTest || !configured || !loaded.every(Boolean) || transitionPending) return;
    const selected = radios.find((radio) => radio.checked);
    if (!selected) { message.textContent = 'ابتدا یک تصویر انتخاب کنید.'; return; }
    if (Number(selected.value) !== test.correctOption) {
      message.textContent = 'پاسخ درست نیست. دوباره بررسی کنید.';
      return;
    }
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
    if (inputs.some((input) => input.value === '')) { message.textContent = 'مقدار هر سه نماد را وارد کنید.'; return; }
    if (inputs.map((input) => input.value).join('') !== '370') { message.textContent = 'پاسخ درست نیست. محاسبه را دوباره بررسی کنید.'; return; }
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
  for (let index = 0; index < 7; index++) {
    const item = element('li');
    const open = button('', 'evidence-open');
    const number = element('span', 'document-number', String(index + 1).padStart(2, '0'));
    number.setAttribute('aria-hidden', 'true');
    const name = element('span', 'evidence-name', `Evidence ${index + 1}`);
    name.dir = 'ltr';
    name.lang = 'en';
    const arrow = element('span', 'evidence-arrow', '←');
    arrow.setAttribute('aria-hidden', 'true');
    open.append(number, name, arrow);
    open.addEventListener('click', () => showEvidence(index));
    item.append(open);
    list.append(item);
  }
  panel.append(list);
  mount(view, title);
}
function showEvidence(index) {
  if (!accessGranted || index < 0 || index > 6) return;
  const { view, panel } = createView();
  const back = button('بازگشت به فهرست مراحل', 'return-button');
  back.addEventListener('click', showIndex);
  view.prepend(back);
  const title = element('h1', 'evidence-name', `Evidence ${index + 1}`);
  title.dir = 'ltr';
  title.lang = 'en';
  title.style.textAlign = 'right';
  panel.append(title);
  const notes = element('ol', 'note-stack');
  const actions = element('div', 'note-actions');
  const message = status('configuration-status');
  const reveal = button('نمایش یادداشت اول');
  const content = entry4Config.evidenceNotes?.[index];
  const appendNote = (noteIndex, animate) => {
    const note = element('li', 'note');
    note.dataset.number = String(noteIndex + 1).padStart(2, '0');
    if (!animate) note.style.animation = 'none';
    note.append(element('p', '', content[noteIndex]));
    notes.append(note);
    return note;
  };
  for (let noteIndex = 0; noteIndex < progress[index]; noteIndex++) appendNote(noteIndex, false);
  function updateControl() {
    if (progress[index] === 3) { reveal.remove(); message.remove(); return; }
    const ready = hasText(content?.[progress[index]]);
    reveal.textContent = progress[index] === 0 ? 'نمایش یادداشت اول' : 'نمایش یادداشت بعدی';
    reveal.disabled = !ready;
    message.textContent = ready ? '' : 'متن این یادداشت هنوز در دسترس نیست.';
    message.hidden = ready;
  }
  reveal.addEventListener('click', () => {
    const next = progress[index];
    if (next >= 3 || !hasText(content?.[next])) return;
    const note = appendNote(next, true);
    progress[index]++;
    updateControl();
    focusHeading(note);
    note.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  });
  actions.append(message, reveal);
  panel.append(notes, actions);
  updateControl();
  mount(view, title);
}

document.getElementById('begin').addEventListener('click', () => {
  if (currentTest !== -1) return;
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
