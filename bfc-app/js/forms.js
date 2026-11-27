/* Baking for a Cause – recipes: Share Recipe flow (create + edit), recipe preview / view pages,
   and the visitor's own recipes on the Recipes list (edit, delete with Undo). Data lives in BFC.recipes (app.js). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const BFC = window.BFC;
  const ICON = BFC.icon;
  const esc = BFC.esc;

  /* ---- Rendering helpers --------------------------------------------------------------- */
  const tagsOf = (d) => [d.difficulty].concat(d.dish || [], d.diet || [], d.occasion || []).filter(Boolean);
  function niceList(a) {
    const l = a.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x));
    return l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l[0] || '';
  }
  function containsText(d) {
    const a = (d.allergens || []).filter((x) => x !== 'None');
    if (a.length) return niceList(a);
    return (d.allergens || []).includes('None') ? 'No listed allergens' : 'Not specified';
  }
  const coverOf = (d) => (d.photos && d.photos[0]) || null;
  /* Cover image, or a "No photo uploaded" placeholder when the recipe has no photos. */
  const coverHtml = (d) => (coverOf(d)
    ? `<img src="${esc(coverOf(d))}" alt="Cover photo for ${esc(d.title)}">`
    : '<div class="no-photo">No photo uploaded</div>');

  /* The recipe body (tags → instructions). `editable` adds the "Edit" links used on the preview step. */
  function renderRecipe(d, editable) {
    const edit = (step, label) => (editable ? `<a class="edit-link" href="#" data-goto="${step}">${ICON('pencil')}${label || 'Edit'}</a>` : '');
    const head = (t, step) => `<div class="review-heading"><h2>${t}</h2>${edit(step)}</div>`;
    const n = (d.photos && d.photos.length) || 0;
    const diet = d.diet || [];
    const ing = (d.ingredients || []).map((i) => {
      const q = [i.qty, i.unit && i.unit !== 'None' ? i.unit : ''].filter(Boolean).join(' ');
      return `<li><span class="ingredient-list__qty">${esc(q)}</span><span>${esc(i.name)}</span></li>`;
    }).join('');
    const steps = (d.steps || []).map((s, i) => `<li class="method__step"><span class="method__num">${i + 1}</span><div class="method__body">${s.title ? `<p class="method__title">${esc(s.title)}</p>` : ''}<p class="method__text">${esc(s.text)}</p></div></li>`).join('');
    /* Extra photos (after the cover) appear as a strip under it. */
    const extra = (d.photos || []).slice(1).map((p, i) => `<img src="${esc(p)}" alt="Photo ${i + 2} of ${esc(d.title)}">`).join('');
    return `
      <section class="review-section">${head('Tags', 2)}<div class="tags">${tagsOf(d).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></section>
      <section class="recipe-overview">
        <div class="recipe-overview__photo recipe-overview__photo--tall">${coverHtml(d)}</div>
        ${!editable && extra ? `<div class="photo-strip">${extra}</div>` : ''}
        ${editable ? `<div class="media-summary"><span>${n ? `Cover photo · ${n} photo${n === 1 ? '' : 's'}` : 'No photo uploaded'}</span><a class="edit-link" href="#" data-goto="3">${ICON('pencil')}Edit photos</a></div>` : ''}
        <div class="recipe-meta"><span class="recipe-meta__time">${ICON('clock')}${esc(d.time || '—')}</span><span>${esc(d.difficulty)}</span><span>${esc(d.yield || '—')}</span></div>
        <p class="recipe-overview__text">${esc(d.desc)}</p>
      </section>
      <section class="review-section">${head('Dietary &amp; Allergens', 2)}
        <div class="allergen-box">
          <p class="allergen-box__row">Dietary preference: ${esc(diet.length ? diet.join(', ') : 'None selected')}</p>
          <p class="allergen-box__contains">Contains: ${esc(containsText(d))}</p>
          ${d.subs ? `<p class="allergen-box__label">Substitutions &amp; cross-contact</p><p class="allergen-box__text">${esc(d.subs)}</p>` : ''}
          <p class="allergen-box__note">Unselected allergens are not an allergen-free claim.</p>
        </div>
      </section>
      <section class="review-section">${head('Ingredients', 4)}${d.yield ? `<p class="yield-line">${esc(d.yield)}</p>` : ''}<ul class="ingredient-list">${ing}</ul></section>
      <section class="review-section" style="gap:18px">${head('Instructions', 5)}<ol class="method">${steps}</ol></section>`;
  }

  /* ---- Delete one of the visitor's recipes: confirm first, then a countdown with Undo ------------
     onDeleted() runs right after deleting, onRestored() after Undo. */
  function deleteRecipe(id, { onDeleted, onRestored, onClose } = {}) {
    const r = BFC.recipes.get(id);
    if (!r) return;
    BFC.confirmDelete({
      noun: 'recipe', name: r.title,
      text: 'will be removed from Recipes and from anyone’s saved recipes on this device.',
      onDelete: () => {
        const wasSaved = BFC.saved.has(id);
        const removed = BFC.recipes.remove(id);
        BFC.saved.set(id, false);
        if (onDeleted) onDeleted();
        return { removed, wasSaved };
      },
      onUndo: (t) => {
        if (!t || !t.removed) return;
        BFC.recipes.restore(t.removed);
        if (t.wasSaved) BFC.saved.set(id, true);
        if (onRestored) onRestored();
        BFC.toast('Recipe restored.');
      },
      onClose,
    });
  }

  /* ---- Recipe page (recipe.html?id=…): built-in recipes and the visitor's own -------------------- */
  const view = $('#shared-recipe-view');
  if (view) {
    const id = new URLSearchParams(location.search).get('id');
    const builtin = id && BFC.builtin[id];
    /* The two original recipes have their own hand-made pages. */
    if (builtin && builtin.href && !builtin.ingredients.length) { location.replace(builtin.href); return; }
    const actions = $('.recipe-actions');
    const notFound = (title, text) => {
      document.title = title + ' · Baking for a Cause';
      if (actions) actions.hidden = true;
      view.innerHTML = `<div class="empty-block"><h1 class="page-title page-title--sm">${esc(title)}</h1>
        <p class="lede">${esc(text)}</p>
        <a class="btn btn--lg btn--block" href="recipes.html">Browse recipes</a></div>`;
    };
    const show = () => {
      const d = builtin || (id ? BFC.recipes.get(id) : BFC.recipes.all()[0]);
      if (!d) { notFound('Recipe not found', 'This recipe was deleted or isn’t on this device.'); return; }
      const mine = !builtin;
      document.title = d.title + ' · Baking for a Cause';
      if (actions) { actions.hidden = false; actions.dataset.recipeId = d.id; BFC.syncReactions(actions); }
      const by = mine ? `Shared by you · ${esc(BFC.timeAgo(d.updatedAt || d.createdAt))}` : `By ${esc(d.author || 'BfC Kitchen Team')} · Baking for a Cause`;
      view.innerHTML = `<h1 class="page-title page-title--sm">${esc(d.title)}</h1>
        <p class="recipe-byline">${by}</p>
        ${mine ? `<div class="thread__actions"><a class="btn-soft" href="share-recipe.html?edit=${encodeURIComponent(d.id)}">${ICON('pencil')}Edit</a><button class="btn-soft btn-soft--danger" type="button" data-delete-recipe>${ICON('trash-2')}Delete</button></div>` : ''}`
        + renderRecipe(d, false);
      BFC.enhancePhotos(view);
      const del = $('[data-delete-recipe]', view);
      if (del) del.addEventListener('click', () => deleteRecipe(d.id, {
        onDeleted: () => notFound('Recipe deleted', `“${d.title}” was removed from the Recipes page.`),
        onRestored: show,
      }));
    };
    show();
  }

  /* ---- Recipes list: the visitor's recipes (newest first, with Edit / Delete), then the club's ------ */
  const list = $('#recipes');
  if (list) {
    const pills = $('.pill-row', list);
    const empty = $('[data-filter-empty]', list);
    const cardFor = (r) => {
      const card = BFC.recipeCard(BFC.userRecipeData(r));
      const owner = document.createElement('div');
      owner.className = 'thread__actions';
      owner.innerHTML = `<a class="btn-soft" href="share-recipe.html?edit=${encodeURIComponent(r.id)}">${ICON('pencil')}Edit</a><button class="btn-soft btn-soft--danger" type="button" data-delete-recipe>${ICON('trash-2')}Delete</button>`;
      $('.recipe-card__body', card).appendChild(owner);
      $('[data-delete-recipe]', owner).addEventListener('click', () => deleteRecipe(r.id, {
        onDeleted: () => BFC.removeAnimated(card, BFC.refilter),
        onRestored: renderMine,
      }));
      return card;
    };
    function renderMine() {
      $$('[data-recipe-id]', list).filter((c) => !BFC.catalog[c.dataset.recipeId]).forEach((c) => c.remove());
      let anchor = pills;
      BFC.recipes.all().forEach((r) => {
        const card = cardFor(r);
        anchor.after(card);
        anchor = card;
      });
      BFC.refilter();
    }
    Object.keys(BFC.catalog).forEach((id) => list.insertBefore(BFC.recipeCard(BFC.catalog[id]), empty));
    renderMine();
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
  const editId = new URLSearchParams(location.search).get('edit');
  const editing = editId ? BFC.recipes.get(editId) : null;

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
    $('#share-title').textContent = editing ? (n === 6 ? 'Ready to update?' : 'Edit Recipe') : (n === 6 ? 'Ready to share?' : 'Share Recipe');
    $('#share-title').classList.toggle('page-title--md', n === 6);
    $('#nav-next').textContent = jumpedFromPreview && n !== 6 ? 'Next: Preview' : n === 6 ? (editing ? 'Your changes will appear on the Recipes page.' : 'Your recipe will appear on the Recipes page.') : `Next: ${LABELS[n]}`;
    const btn = $('#btn-next');
    btn.lastChild.textContent = n === 6 ? (editing ? 'Save changes' : 'Share recipe') : 'Continue';
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
    if (step === 1) { location.href = $('.exit-action').href; return; }
    jumpedFromPreview = false;
    goto(step - 1);
  }

  function finish() {
    const d = collect();
    const now = Date.now();
    const recipe = Object.assign({}, editing || {}, d, editing ? { updatedAt: now } : { id: BFC.uid('r'), createdAt: now });
    const res = BFC.recipes.save(recipe);
    if (!res.ok) { showError('This device is out of storage space, so the recipe couldn’t be saved. Remove some photos and try again.'); return; }
    if (res.droppedPhotos) { d.photos = []; BFC.toast('Your photos were too large to keep on this device, so the recipe was saved without them.', { duration: 7000 }); }
    if (!editing) BFC.notify({ icon: 'book', title: 'Recipe shared: ' + d.title, text: 'It’s now on the Recipes page.', href: 'recipe.html?id=' + encodeURIComponent(recipe.id) });
    $('#done-view').href = 'recipe.html?id=' + encodeURIComponent(recipe.id);
    const note = $('#done-guest-note');
    if (note) note.hidden = !BFC.isGuest();
    $('#share-intro').hidden = true;
    panels.forEach((p) => { p.hidden = p.dataset.step !== 'done'; });
    $('#form-nav').hidden = true;
    clearError();
    $('#done-photo-box').innerHTML = coverHtml(d);
    if (editing) {
      $('.success__title', form).textContent = 'Recipe Updated!';
      $('.success__text', form).textContent = 'Your changes are now on the club’s Recipes page.';
    }
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
    grid.innerHTML = photos.map((p, i) => `<div class="photo-grid__item" data-index="${i}"><img src="${p}" alt="Photo ${i + 1}" draggable="false">${i === 0 ? '<span class="photo-grid__cover">COVER</span>' : ''}<button type="button" class="photo-grid__remove" aria-label="Remove photo ${i + 1}" data-remove-photo="${i}">${ICON('x')}</button></div>`).join('');
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
  /* Drag a thumbnail onto another to reorder; the first photo is always the cover. */
  grid.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.photo-grid__item');
    if (!item || e.target.closest('[data-remove-photo]')) return;
    e.preventDefault();
    item.classList.add('is-dragging');
    const move = (ev) => {
      const items = $$('.photo-grid__item', grid);
      const over = items.find((o) => {
        if (o === item) return false;
        const r = o.getBoundingClientRect();
        return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      });
      if (!over) return;
      if (items.indexOf(over) > items.indexOf(item)) over.after(item); else over.before(item);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      const order = $$('.photo-grid__item', grid).map((o) => photos[Number(o.dataset.index)]);
      photos.splice(0, photos.length, ...order);
      drawPhotos();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });
  drawPhotos();

  /* Ingredients and steps: add, remove, drag to reorder */
  function makeList(listId, tplId, addId, onChange, onCreate) {
    const listEl = $(listId);
    /* values (optional): prefill the new row, e.g. { qty, unit, name } or { title, text } */
    const add = (values) => {
      const node = $(tplId).content.firstElementChild.cloneNode(true);
      listEl.appendChild(node);
      if (onCreate) onCreate(node);
      if (values) {
        Object.keys(values).forEach((k) => { const f = $(`[data-f="${k}"]`, node); if (f) f.value = values[k]; });
        if (node.setUnit) node.setUnit(values.unit || 'None');
      }
      onChange();
      const f = !values && $('input:not([type=hidden]), textarea', node);
      if (f) f.focus();
    };
    $(addId).addEventListener('click', () => add());
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
  /* Unit picker: same dropdown list as Difficulty */
  const setupUnit = (node) => {
    const wrap = $('.unit', node);
    if (!wrap) return;
    const btn = $('.mini--unit', wrap);
    const input = $('[data-f=unit]', wrap);
    node.setUnit = (v) => {
      input.value = v;
      $('.unit__value', btn).textContent = v;
      $$('.dropdown__option', wrap).forEach((o) => o.setAttribute('aria-selected', String(o.dataset.value === v)));
    };
    window.BFC.dropdown(wrap, btn, (o) => node.setUnit(o.dataset.value));
  };
  const addIngredient = makeList('#ingredient-list', '#tpl-ingredient', '#add-ingredient', refreshIngredients, setupUnit);
  const addStep = makeList('#step-list', '#tpl-step', '#add-step', refreshSteps);
  refreshIngredients(); refreshSteps();

  /* Editing a posted recipe: fill every step with what was shared. */
  if (editing) {
    const d = editing;
    $('#f-title').value = d.title || ''; $('#f-desc').value = d.desc || ''; $('#f-time').value = d.time || '';
    $('#f-yield').value = d.yield || ''; $('#f-subs').value = d.subs || '';
    const opt = $$('.dropdown__option', dd).find((o) => o.dataset.value === d.difficulty);
    if (opt) {
      $('#f-difficulty').value = opt.dataset.value;
      $('.input__value', ddBtn).textContent = opt.dataset.value;
      ddBtn.classList.add('has-value');
      $$('.dropdown__option', dd).forEach((x) => x.setAttribute('aria-selected', String(x === opt)));
    }
    const groups = { dish: d.dish, diet: d.diet, occasion: d.occasion, allergen: d.allergens };
    $$('.chip[data-group]', form).forEach((c) => {
      c.setAttribute('aria-pressed', String((groups[c.dataset.group] || []).includes(c.textContent.trim())));
    });
    (d.photos || []).slice(0, 5).forEach((p) => photos.push(p));
    drawPhotos();
    (d.ingredients || []).forEach((i) => addIngredient(i));
    (d.steps || []).forEach((st) => addStep(st));
    document.title = 'Edit Recipe · Baking for a Cause';
  }

  goto(1);
})();
