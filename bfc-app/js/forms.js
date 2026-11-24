/* Baking for a Cause – forms: Share Recipe flow, recipe preview/view rendering, shared-recipe storage. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const ICON = (n) => (window.BFC_ICONS && window.BFC_ICONS[n]) || '';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---- Storage for the recipe a visitor shares (falls back to memory if storage is blocked) ---- */
  const KEY = 'bfc.sharedRecipe';
  const COVER_FALLBACK = 'assets/photos/recipe-brown-butter-cookies.png';
  const memory = {};
  const store = {
    get() {
      try { const v = localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch (e) { /* ignore */ }
      return memory.recipe || null;
    },
    set(d) {
      memory.recipe = d;
      try { localStorage.setItem(KEY, JSON.stringify(d)); }
      catch (e) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, d, { photos: [] }))); } catch (e2) { /* ignore */ } }
    },
  };

  /* Content shown on the "Recipe Shared" / "View recipe" screens when nothing has been shared yet. */
  const DEMO = {
    title: 'Chocolate Chip Cookies',
    desc: 'Crisp edges, soft centres and pools of dark chocolate. Nutty brown butter makes these no-chill cookies a favourite for bake sales and study breaks.',
    time: '25 min', difficulty: 'Beginner', yield: 'Makes 12',
    dish: ['Cookies'], diet: ['Vegetarian'], occasion: ['Bake Sale'], allergens: ['Wheat / gluten', 'Milk', 'Egg'],
    subs: 'For a swap, try chopped milk chocolate; allergens may change. Check all ingredient labels, including chocolate, and your kitchen for possible cross-contact. Not suitable for milk, egg or wheat allergies.',
    photos: [],
    ingredients: [
      { qty: '115', unit: 'g', name: 'Unsalted butter' }, { qty: '100', unit: 'g', name: 'Light brown sugar' },
      { qty: '50', unit: 'g', name: 'Caster sugar' }, { qty: '1', unit: 'large', name: 'Egg' },
      { qty: '1', unit: 'tsp', name: 'Vanilla extract' }, { qty: '160', unit: 'g', name: 'All-purpose flour' },
      { qty: '½', unit: 'tsp', name: 'Baking soda' }, { qty: '¼', unit: 'tsp', name: 'Fine salt' },
      { qty: '100', unit: 'g', name: 'Dark chocolate (cocoa, sugar), chopped' },
    ],
    steps: [
      { title: 'Brown the butter', text: 'Heat the oven to 180°C (350°F). Line two baking trays with parchment. Melt the butter in a small pan over medium heat for 5 minutes, swirling until golden with brown flecks. Pour into a heatproof bowl and cool for 3 minutes.' },
      { title: 'Mix the dough', text: 'Whisk both sugars into the warm butter. Whisk in the egg and vanilla until smooth. Fold in the flour, baking soda and salt, then the chopped chocolate, just until combined.' },
      { title: 'Portion and bake', text: 'Divide the dough into 12 equal balls, six per tray, leaving 5 cm between them. Bake both trays for 10 minutes, swapping racks halfway, until edges are golden and centres look slightly soft.' },
      { title: 'Cool and enjoy', text: 'Leave on the trays for 3 minutes, then move to a wire rack. Serve warm or cool completely before storing in an airtight container for up to 3 days.' },
    ],
  };

  /* ---- Rendering helpers --------------------------------------------------------------- */
  const tagsOf = (d) => [d.difficulty].concat(d.dish, d.diet, d.occasion).filter(Boolean);
  function niceList(a) {
    const l = a.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x));
    return l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l[0] || '';
  }
  function containsText(d) {
    const a = (d.allergens || []).filter((x) => x !== 'None');
    if (a.length) return niceList(a);
    return (d.allergens || []).includes('None') ? 'No listed allergens' : 'Not specified';
  }
  const coverOf = (d) => (d.photos && d.photos[0]) || COVER_FALLBACK;

  /* The recipe body (tags → instructions). `editable` adds the "Edit" links used on the preview step. */
  function renderRecipe(d, editable) {
    const edit = (step, label) => (editable ? `<a class="edit-link" href="#" data-goto="${step}">${ICON('pencil')}${label || 'Edit'}</a>` : '');
    const head = (t, step) => `<div class="review-heading"><h2>${t}</h2>${edit(step)}</div>`;
    const n = (d.photos && d.photos.length) || 1;
    const ing = d.ingredients.map((i) => {
      const q = [i.qty, i.unit && i.unit !== 'None' ? i.unit : ''].filter(Boolean).join(' ');
      return `<li><span class="ingredient-list__qty">${esc(q)}</span><span>${esc(i.name)}</span></li>`;
    }).join('');
    const steps = d.steps.map((s, i) => `<li class="method__step"><span class="method__num">${i + 1}</span><div class="method__body">${s.title ? `<p class="method__title">${esc(s.title)}</p>` : ''}<p class="method__text">${esc(s.text)}</p></div></li>`).join('');
    return `
      <section class="review-section">${head('Tags', 2)}<div class="tags">${tagsOf(d).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></section>
      <section class="recipe-overview">
        <div class="recipe-overview__photo recipe-overview__photo--tall"><img src="${esc(coverOf(d))}" alt="Cover photo for ${esc(d.title)}"></div>
        ${editable ? `<div class="media-summary"><span>Cover photo · ${n} photo${n === 1 ? '' : 's'}</span><a class="edit-link" href="#" data-goto="3">${ICON('pencil')}Edit photos</a></div>` : ''}
        <div class="recipe-meta"><span class="recipe-meta__time">${ICON('clock')}${esc(d.time || '—')}</span><span>${esc(d.difficulty)}</span><span>${esc(d.yield || '—')}</span></div>
        <p class="recipe-overview__text">${esc(d.desc)}</p>
      </section>
      <section class="review-section">${head('Dietary &amp; Allergens', 2)}
        <div class="allergen-box">
          <p class="allergen-box__row">Dietary preference: ${esc(d.diet.length ? d.diet.join(', ') : 'None selected')}</p>
          <p class="allergen-box__contains">Contains: ${esc(containsText(d))}</p>
          ${d.subs ? `<p class="allergen-box__label">Substitutions &amp; cross-contact</p><p class="allergen-box__text">${esc(d.subs)}</p>` : ''}
          <p class="allergen-box__note">Unselected allergens are not an allergen-free claim.</p>
        </div>
      </section>
      <section class="review-section">${head('Ingredients', 4)}${d.yield ? `<p class="yield-line">${esc(d.yield)}</p>` : ''}<ul class="ingredient-list">${ing}</ul></section>
      <section class="review-section" style="gap:18px">${head('Instructions', 5)}<ol class="method">${steps}</ol></section>`;
  }

  /* ---- "View recipe" page for the recipe a visitor just shared -------------------------- */
  const view = $('#shared-recipe-view');
  if (view) {
    const d = store.get() || DEMO;
    document.title = d.title + ' · Baking for a Cause';
    view.innerHTML = `<h1 class="page-title page-title--sm">${esc(d.title)}</h1>` + renderRecipe(d, false);
  }

  /* ---- Recipes list: show the shared recipe at the top ---------------------------------- */
  const list = $('#recipes');
  const shared = list && store.get();
  if (shared) {
    const hrs = /(\d+(?:\.\d+)?)\s*h/i.exec(shared.time || '');
    const mins = /(\d+)\s*m/i.exec(shared.time || '');
    const minutes = (hrs ? parseFloat(hrs[1]) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0) || parseInt(shared.time, 10) || 0;
    const dish = (shared.dish[0] || '').toLowerCase();
    const dishKey = dish === 'bread' ? 'bread' : dish ? 'dessert' : '';
    const chips = [shared.difficulty, shared.time].concat(shared.dish, shared.diet).filter(Boolean);
    const card = document.createElement('article');
    card.className = 'recipe-card';
    card.setAttribute('data-filter-item', '');
    card.dataset.difficulty = shared.difficulty.toLowerCase();
    card.dataset.minutes = String(minutes);
    card.dataset.dish = dishKey;
    card.innerHTML = `
      <div class="recipe-card__photo"><img src="${esc(coverOf(shared))}" alt=""></div>
      <div class="recipe-card__body">
        <div class="recipe-card__head">
          <div class="recipe-card__title-block"><h2 class="recipe-card__title">${esc(shared.title)}</h2><div class="tags">${chips.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
          <span class="rating">${ICON('heart')}<span data-like-count>0</span></span>
        </div>
        <p class="recipe-card__text">${esc(shared.desc.length > 140 ? shared.desc.slice(0, 137).trimEnd() + '…' : shared.desc)}</p>
        <div class="recipe-card__actions">
          <a class="btn" href="recipe-shared.html">View recipe ${ICON('arrow-right')}</a>
          <div class="recipe-card__reactions">
            <button class="icon-btn" type="button" aria-label="Like" aria-pressed="false" data-like>${ICON('heart')}</button>
            <button class="icon-btn icon-btn--sm" type="button" aria-label="Save recipe" aria-pressed="false" data-save>${ICON('bookmark')}</button>
          </div>
        </div>
      </div>`;
    const pills = $('.pill-row', list);
    if (pills) pills.after(card); else list.prepend(card);
  }

  /* ---- Share Recipe flow ------------------------------------------------------------------ */
  const form = $('#share-form');
  if (!form) return;

  const LABELS = ['Basics', 'Tags & Dietary Info', 'Photos', 'Ingredients', 'Instructions', 'Preview'];
  const body = $('.screen-body', form);
  const panels = $$('[data-step]', form);
  const errorNote = $('#step-error');
  const errorText = $('span', errorNote);
  let step = 1;
  let jumpedFromPreview = false;
  const photos = [];

  const val = (id) => $(id).value.trim();
  const group = (name) => $$(`.chip[data-group="${name}"][aria-pressed="true"]`, form).map((c) => c.textContent.trim());

  function collect() {
    return {
      title: val('#f-title'), desc: val('#f-desc'), time: val('#f-time'), difficulty: val('#f-difficulty'), yield: val('#f-yield'),
      dish: group('dish'), diet: group('diet'), occasion: group('occasion'), allergens: group('allergen'), subs: val('#f-subs'),
      photos: photos.slice(),
      ingredients: $$('#ingredient-list [data-entry]', form).map((e) => ({ qty: $('[data-f=qty]', e).value.trim(), unit: $('[data-f=unit]', e).value, name: $('[data-f=name]', e).value.trim() })).filter((i) => i.name),
      steps: $$('#step-list [data-entry]', form).map((e) => ({ title: $('[data-f=title]', e).value.trim(), text: $('[data-f=text]', e).value.trim() })).filter((s) => s.text),
    };
  }

  function showError(msg) { errorText.textContent = msg; errorNote.hidden = false; }
  function clearError() { errorNote.hidden = true; $$('.is-invalid', form).forEach((e) => e.classList.remove('is-invalid')); }

  function validate(n) {
    clearError();
    if (n === 1) {
      const bad = [['#f-title', '#f-title'], ['#f-desc', '#f-desc'], ['#f-difficulty', '#difficulty-button']].filter(([v]) => !val(v));
      bad.forEach(([, el]) => { const t = $(el); (t.closest('.input') || t).classList.add('is-invalid'); });
      if (bad.length) { showError('Please fill in all required fields before continuing.'); $(bad[0][1]).focus(); return false; }
    }
    if (n === 4 && !collect().ingredients.length) {
      $$('#ingredient-list [data-f=name]', form).forEach((i) => i.classList.add('is-invalid'));
      showError('Please add at least one ingredient with a name before continuing.'); return false;
    }
    if (n === 5 && !collect().steps.length) {
      $$('#step-list [data-f=text]', form).forEach((i) => i.classList.add('is-invalid'));
      showError('Please add at least one instruction step before continuing.'); return false;
    }
    return true;
  }

  function goto(n) {
    step = n;
    panels.forEach((p) => { p.hidden = Number(p.dataset.step) !== n; });
    $('#step-label').textContent = `Step ${n} of 6 · ${LABELS[n - 1]}`;
    $('#progress-bar').style.width = Math.min(100, (n * 59) / 3.42) + '%';
    $('#progress-bar').parentElement.setAttribute('aria-valuenow', String(n));
    $('#share-title').textContent = n === 6 ? 'Ready to share?' : 'Share Recipe';
    $('#share-title').classList.toggle('page-title--md', n === 6);
    $('#nav-next').textContent = jumpedFromPreview && n !== 6 ? 'Next: Preview' : n === 6 ? 'Your recipe will appear on the Recipes page.' : `Next: ${LABELS[n]}`;
    const btn = $('#btn-next');
    btn.lastChild.textContent = n === 6 ? 'Share recipe' : 'Continue';
    if (n === 6) $('#preview-body').innerHTML = previewHtml();
    clearError();
    body.scrollTop = 0;
  }

  function previewHtml() {
    const d = collect();
    return `<div class="preview-title"><h2>${esc(d.title)}</h2><a class="edit-link" href="#" data-goto="1">${ICON('pencil')}Edit</a></div>` + renderRecipe(d, true);
  }

  function next() {
    if (!validate(step)) return;
    if (step === 6) return finish();
    if (jumpedFromPreview) { jumpedFromPreview = false; return goto(6); }
    goto(step + 1);
  }
  function back() {
    if (step === 1) { location.href = 'recipes.html'; return; }
    jumpedFromPreview = false;
    goto(step - 1);
  }

  function finish() {
    const d = collect();
    store.set(d);
    $('#share-intro').hidden = true;
    panels.forEach((p) => { p.hidden = p.dataset.step !== 'done'; });
    $('#form-nav').hidden = true;
    clearError();
    $('#done-photo').src = coverOf(d);
    $('#done-title').textContent = d.title;
    $('#done-meta').textContent = tagsOf(d).join(' · ');
    body.scrollTop = 0;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); next(); });
  $('#btn-back').addEventListener('click', back);
  form.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); jumpedFromPreview = step === 6; goto(Number(g.dataset.goto)); }
  });
  form.addEventListener('input', (e) => {
    const t = e.target.closest('.is-invalid, .input, .mini');
    if (t) { t.classList.remove('is-invalid'); const w = t.closest('.input'); if (w) w.classList.remove('is-invalid'); }
    if (!$$('.is-invalid', form).length) errorNote.hidden = true;
  });
  /* Clicking anywhere on a field box focuses its text control. */
  $$('label.input', form).forEach((l) => l.addEventListener('click', () => { const i = $('input, textarea', l); if (i) i.focus(); }));

  /* Difficulty dropdown */
  const dd = $('#difficulty-dropdown');
  const ddBtn = $('#difficulty-button');
  const ddList = $('.dropdown__list', dd);
  const setDd = (open) => { ddList.hidden = !open; ddBtn.setAttribute('aria-expanded', String(open)); };
  ddBtn.addEventListener('click', (e) => { e.stopPropagation(); setDd(ddList.hidden); });
  $$('.dropdown__option', dd).forEach((o) => o.addEventListener('click', () => {
    $('#f-difficulty').value = o.dataset.value;
    $('.input__value', ddBtn).textContent = o.dataset.value;
    ddBtn.classList.add('has-value'); ddBtn.classList.remove('is-invalid');
    $$('.dropdown__option', dd).forEach((x) => x.setAttribute('aria-selected', String(x === o)));
    setDd(false);
    if (!$$('.is-invalid', form).length) errorNote.hidden = true;
  }));
  document.addEventListener('click', (e) => { if (!e.target.closest('#difficulty-dropdown')) setDd(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDd(false); });

  /* Tag / allergen chips */
  form.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const on = c.getAttribute('aria-pressed') !== 'true';
    c.setAttribute('aria-pressed', String(on));
    if (c.dataset.group === 'allergen' && on) {
      const none = c.dataset.none === 'true';
      $$('.chip[data-group="allergen"]', form).forEach((o) => { if (o !== c && (none || o.dataset.none === 'true')) o.setAttribute('aria-pressed', 'false'); });
    }
  });

  /* Photos */
  const fileInput = $('#photo-input');
  const grid = $('#photo-grid');
  const drop = $('#dropzone');
  const photoNote = $('#photo-note');
  const readPhoto = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const s = Math.min(1, 1000 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
  function drawPhotos() {
    $('#photo-count').textContent = `${photos.length} of 5 photos`;
    grid.hidden = !photos.length;
    grid.innerHTML = photos.map((p, i) => `<div class="photo-grid__item"><img src="${p}" alt="Photo ${i + 1}">${i === 0 ? '<span class="photo-grid__cover">COVER</span>' : ''}<button type="button" class="photo-grid__remove" aria-label="Remove photo ${i + 1}" data-remove-photo="${i}">${ICON('x')}</button></div>`).join('');
    drop.hidden = photos.length >= 5;
    drop.classList.toggle('dropzone--compact', photos.length > 0);
  }
  fileInput.addEventListener('change', async () => {
    photoNote.hidden = true;
    const files = Array.from(fileInput.files);
    fileInput.value = '';
    let msg = '';
    const ok = [];
    for (const f of files) {
      if (!/^image\/(jpeg|png)$/.test(f.type)) { msg = 'Only JPG or PNG photos can be added.'; continue; }
      if (f.size > 10 * 1024 * 1024) { msg = 'Each photo must be 10 MB or smaller.'; continue; }
      if (photos.length + ok.length >= 5) { msg = 'You can add up to 5 photos.'; break; }
      ok.push(f);
    }
    try { (await Promise.all(ok.map(readPhoto))).forEach((p) => photos.push(p)); } catch (e) { msg = 'One of those photos could not be read.'; }
    drawPhotos();
    if (msg) { $('span', photoNote).textContent = msg; photoNote.hidden = false; }
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove-photo]');
    if (b) { photos.splice(Number(b.dataset.removePhoto), 1); drawPhotos(); }
  });
  drawPhotos();

  /* Ingredients and steps: add, remove, drag to reorder */
  function makeList(listId, tplId, addId, onChange) {
    const listEl = $(listId);
    const add = () => {
      const node = $(tplId).content.firstElementChild.cloneNode(true);
      listEl.appendChild(node);
      onChange();
      const f = $('input, textarea', node);
      if (f) f.focus();
    };
    $(addId).addEventListener('click', add);
    listEl.addEventListener('click', (e) => {
      const r = e.target.closest('[data-remove]');
      if (r) { r.closest('[data-entry]').remove(); onChange(); }
    });
    listEl.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('[data-grip]');
      const item = grip && grip.closest('[data-entry]');
      if (!item) return;
      e.preventDefault();
      item.classList.add('is-dragging');
      const move = (ev) => {
        const others = Array.from(listEl.children).filter((c) => c !== item);
        const before = others.find((s) => { const r = s.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
        if (before) { if (item.nextElementSibling !== before) listEl.insertBefore(item, before); } else if (listEl.lastElementChild !== item) listEl.appendChild(item);
      };
      const up = () => {
        item.classList.remove('is-dragging');
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        onChange();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });
    return add;
  }
  const refreshIngredients = () => { const has = $$('#ingredient-list [data-entry]').length > 0; $('#ingredient-help').hidden = !has; $('#ingredient-labels').hidden = !has; $('#ingredient-block').hidden = !has; };
  const refreshSteps = () => { $$('#step-list [data-num]').forEach((n, i) => { n.textContent = String(i + 1); }); $('#step-block').hidden = !$$('#step-list [data-entry]').length; };
  makeList('#ingredient-list', '#tpl-ingredient', '#add-ingredient', refreshIngredients);
  makeList('#step-list', '#tpl-step', '#add-step', refreshSteps);
  refreshIngredients(); refreshSteps();

  goto(1);
})();
