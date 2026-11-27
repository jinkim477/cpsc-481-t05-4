/* Baking for a Cause – app core: storage, data stores, toasts, notifications, menus, likes/saves,
   filters, return pages and page transitions. Loaded on every page after js/icons.js. */
(function () {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const BFC = (window.BFC = window.BFC || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = (n) => (window.BFC_ICONS && window.BFC_ICONS[n]) || '';
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  BFC.esc = esc;
  BFC.icon = ICON;
  BFC.uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ==== Storage ===========================================================================
     Everything a guest creates lives on this device. localStorage is used when the browser allows it;
     otherwise sessionStorage, otherwise window.name (survives page changes within the same tab). */
  const probe = (area) => { try { area.setItem('bfc.__probe', '1'); const ok = area.getItem('bfc.__probe') === '1'; area.removeItem('bfc.__probe'); return ok; } catch (e) { return false; } };
  let area = null;
  let kind = 'tab';
  try { if (probe(window.localStorage)) { area = window.localStorage; kind = 'device'; } } catch (e) { /* blocked */ }
  if (!area) { try { if (probe(window.sessionStorage)) { area = window.sessionStorage; kind = 'session'; } } catch (e) { /* blocked */ } }
  const WN = '__bfc__';
  const tabStore = (() => { try { return window.name.indexOf(WN) === 0 ? JSON.parse(window.name.slice(WN.length)) : {}; } catch (e) { return {}; } })();
  const writeTab = () => { try { window.name = WN + JSON.stringify(tabStore); } catch (e) { /* ignore */ } };
  const memory = {};
  BFC.db = {
    kind, /* 'device' | 'session' | 'tab' */
    get(key, fallback) {
      let raw = null;
      if (area) { try { raw = area.getItem(key); } catch (e) { /* ignore */ } }
      if (raw == null && key in tabStore) raw = tabStore[key];
      if (raw == null && key in memory) raw = memory[key];
      if (raw == null) return fallback;
      try { const v = JSON.parse(raw); return v == null ? fallback : v; } catch (e) { return fallback; }
    },
    /* Returns false when the value could not be stored (e.g. storage full). */
    set(key, value) {
      const raw = JSON.stringify(value);
      memory[key] = raw;
      if (area) { try { area.setItem(key, raw); return true; } catch (e) { return false; } }
      tabStore[key] = raw; writeTab();
      return true;
    },
    remove(key) {
      delete memory[key];
      if (area) { try { area.removeItem(key); } catch (e) { /* ignore */ } }
      if (key in tabStore) { delete tabStore[key]; writeTab(); }
    },
  };
  const db = BFC.db;
  if (!db.get('bfc.firstVisit')) db.set('bfc.firstVisit', Date.now());

  BFC.member = () => db.get('bfc.member', null);
  BFC.isGuest = () => !BFC.member();
  const here = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  BFC.here = here;

  /* ==== Toasts ============================================================================ */
  let toastStack = null;
  /* opts: { action: { label, href } | { label, onClick }, duration } */
  BFC.toast = (message, opts = {}) => {
    const phone = $('.phone') || document.body;
    if (!toastStack) {
      toastStack = document.createElement('div');
      toastStack.className = 'toast-stack';
      toastStack.setAttribute('role', 'status');
      toastStack.setAttribute('aria-live', 'polite');
      phone.appendChild(toastStack);
    }
    /* Sit just above the bottom navigation / form buttons, whichever this screen has. */
    const bar = $$('.nav, .form-nav', phone).find((b) => b.offsetParent !== null);
    const pb = phone.getBoundingClientRect();
    toastStack.style.bottom = (bar ? Math.max(16, pb.bottom - bar.getBoundingClientRect().top + 12) : 24) + 'px';
    while (toastStack.children.length >= 2) toastStack.firstElementChild.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="toast__text">${esc(message)}</span>`;
    const close = () => {
      if (!t.isConnected || t.classList.contains('is-leaving')) return;
      t.classList.add('is-leaving');
      setTimeout(() => t.remove(), reducedMotion() ? 0 : 200);
    };
    if (opts.action) {
      const a = document.createElement(opts.action.href ? 'a' : 'button');
      a.className = 'toast__action';
      a.textContent = opts.action.label;
      if (opts.action.href) a.href = opts.action.href;
      else { a.type = 'button'; a.addEventListener('click', () => { opts.action.onClick(); close(); }); }
      t.appendChild(a);
    }
    toastStack.appendChild(t);
    setTimeout(close, opts.duration || 4500);
    return close;
  };
  const joinHref = () => 'membership.html' + (here && here !== 'membership' ? '?from=' + here : '');
  /* Shown to guests whenever something is stored only on this device. */
  BFC.guestToast = (message) => {
    if (BFC.isGuest()) BFC.toast(message + ' It’s stored on this device only — sign up or log in to keep it.', { action: { label: 'Sign up', href: joinHref() }, duration: 6000 });
    else BFC.toast(message);
  };
  /* If the browser blocks storage entirely, say so once per tab instead of silently losing data. */
  if (db.kind === 'tab' && !tabStore.__warned) {
    tabStore.__warned = '1'; writeTab();
    setTimeout(() => BFC.toast('This browser is blocking storage, so your changes only last while this tab is open.', { duration: 7000 }), 300);
  }

  /* ==== Content catalog (built-in recipes from js/recipes-data.js, events) ================== */
  const shorten = (s, n) => ((s || '').length > n ? s.slice(0, n - 3).trimEnd() + '…' : s || '');
  /* Full recipe (same shape as a recipe the visitor shares) for a built-in recipe. */
  BFC.builtin = {};
  BFC.catalog = {};
  (window.BFC_RECIPES || []).forEach((r) => {
    const photos = r.photos || ['assets/photos/recipes/' + r.id + '.svg', 'assets/photos/recipes/' + r.id + '-2.svg'];
    const full = Object.assign({}, r, {
      photos,
      ingredients: (r.ingredients || []).map(([qty, unit, name]) => ({ qty, unit, name })),
      steps: (r.steps || []).map(([title, text]) => ({ title, text })),
    });
    BFC.builtin[r.id] = full;
    BFC.catalog[r.id] = {
      id: r.id, title: r.title, author: r.author,
      tags: Array.from(new Set([r.difficulty, r.time].concat(r.dish || [], r.diet || []))),
      text: r.text || shorten(r.desc, 140), likes: r.likes || 0,
      photo: photos[0], alt: r.alt || r.title, href: r.href || 'recipe.html?id=' + encodeURIComponent(r.id),
      difficulty: (r.difficulty || '').toLowerCase(), minutes: 0, dish: r.course || '', diet: '',
    };
  });
  BFC.events = {
    'cinnamon-social': { title: 'Cinnamon Roll Social', when: 'Thu Dec. 3, 6–8 pm', where: 'Maple Hall Kitchen', kind: 'event' },
    'holiday-hiring': { title: 'Student baker, holiday market', when: 'Mon Nov. 30 to Fri Dec. 18', where: '2–4 hours/week', kind: 'application' },
  };

  /* ==== Recipes the visitor has shared ===================================================== */
  const migrate = () => {
    const old = db.get('bfc.sharedRecipe', null);
    if (!old) return;
    const id = BFC.uid('r');
    const list = db.get('bfc.recipes', []);
    list.unshift(Object.assign({ id, createdAt: Date.now() }, old));
    if (db.set('bfc.recipes', list)) {
      db.remove('bfc.sharedRecipe');
      db.set('bfc.savedRecipes', db.get('bfc.savedRecipes', []).map((x) => (x === 'shared' ? id : x)));
    }
  };
  migrate();
  BFC.recipes = {
    all() { const a = db.get('bfc.recipes', []); return Array.isArray(a) ? a : []; },
    get(id) { return this.all().find((r) => r.id === id) || null; },
    /* Insert or update. Returns { ok, droppedPhotos } — photos are dropped if the device runs out of space. */
    save(recipe) {
      const list = this.all();
      const i = list.findIndex((r) => r.id === recipe.id);
      if (i >= 0) list[i] = recipe; else list.unshift(recipe);
      if (db.set('bfc.recipes', list)) return { ok: true, droppedPhotos: false };
      recipe.photos = [];
      if (i >= 0) list[i] = recipe; else list[0] = recipe;
      return { ok: db.set('bfc.recipes', list), droppedPhotos: true };
    },
    remove(id) {
      const list = this.all();
      const index = list.findIndex((r) => r.id === id);
      if (index < 0) return null;
      const [recipe] = list.splice(index, 1);
      db.set('bfc.recipes', list);
      return { recipe, index };
    },
    restore({ recipe, index }) {
      const list = this.all().filter((r) => r.id !== recipe.id);
      list.splice(Math.min(index, list.length), 0, recipe);
      db.set('bfc.recipes', list);
    },
  };
  const DESSERTS = ['cookies', 'cakes', 'pastries', 'pies', 'brownies', 'cupcakes', 'muffins', 'tarts', 'desserts'];
  BFC.recipeMinutes = (time) => {
    const t = String(time || '');
    const hrs = /(\d+(?:\.\d+)?)\s*h/i.exec(t);
    const mins = /(\d+)\s*m/i.exec(t);
    return Math.round((hrs ? parseFloat(hrs[1]) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0)) || parseInt(t, 10) || 0;
  };
  BFC.dietKeys = (diet) => {
    const k = (diet || []).map((x) => x.toLowerCase());
    if (k.includes('vegan')) k.push('vegetarian', 'dairy-free');
    return Array.from(new Set(k)).join(' ');
  };
  const dishKey = (dish) => {
    const d = (dish || []).map((x) => x.toLowerCase());
    if (d.includes('bread')) return 'bread';
    if (d.some((x) => DESSERTS.includes(x))) return 'dessert';
    if (d.some((x) => /snack|bar|scone/.test(x))) return 'snack';
    return d.length ? 'dessert' : '';
  };
  /* Minutes and diet keys for built-in recipes (helpers above are now defined). */
  Object.keys(BFC.catalog).forEach((id) => {
    const r = BFC.builtin[id];
    BFC.catalog[id].minutes = BFC.recipeMinutes(r.time);
    BFC.catalog[id].diet = BFC.dietKeys(r.diet);
  });
  /* Card data for one of the visitor's recipes. */
  BFC.userRecipeData = (r) => ({
    id: r.id,
    title: r.title,
    tags: [r.difficulty, r.time].concat(r.dish || [], r.diet || []).filter(Boolean),
    text: shorten(r.desc, 140),
    likes: 0,
    photo: (r.photos && r.photos[0]) || null,
    alt: 'Cover photo for ' + r.title,
    href: 'recipe.html?id=' + encodeURIComponent(r.id),
    difficulty: (r.difficulty || '').toLowerCase(),
    minutes: BFC.recipeMinutes(r.time),
    dish: dishKey(r.dish),
    diet: BFC.dietKeys(r.diet),
    mine: true,
  });
  /* Card data for any recipe id (built-in or the visitor's own). */
  BFC.recipeData = (id) => {
    if (BFC.catalog[id]) return BFC.catalog[id];
    const r = BFC.recipes.get(id);
    return r ? BFC.userRecipeData(r) : null;
  };

  /* r: { id, title, tags[], text, likes, photo (null = "No photo uploaded"), alt, href, difficulty, minutes, dish, diet, mine } */
  BFC.recipeCard = (r) => {
    const card = document.createElement('article');
    card.className = 'recipe-card';
    card.setAttribute('data-filter-item', '');
    card.dataset.recipeId = r.id;
    card.dataset.difficulty = r.difficulty;
    card.dataset.minutes = String(r.minutes);
    card.dataset.dish = r.dish;
    card.dataset.diet = r.diet || '';
    card.innerHTML = `
      <div class="recipe-card__photo">${r.photo ? `<img src="${esc(r.photo)}" alt="${esc(r.alt || '')}" loading="lazy">` : '<div class="no-photo">No photo uploaded</div>'}${r.mine ? '<span class="recipe-card__badge">YOUR RECIPE</span>' : ''}</div>
      <div class="recipe-card__body">
        <div class="recipe-card__head">
          <div class="recipe-card__title-block"><h2 class="recipe-card__title">${esc(r.title)}</h2><div class="tags">${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
          <span class="rating">${ICON('heart')}<span data-like-count>${esc(r.likes || 0)}</span></span>
        </div>
        ${r.author || r.mine ? `<p class="recipe-card__by">By ${esc(r.mine ? 'you' : r.author)}</p>` : ''}
        <p class="recipe-card__text">${esc(r.text)}</p>
        <div class="recipe-card__actions">
          <a class="btn" href="${esc(r.href)}">View recipe ${ICON('arrow-right')}</a>
          <div class="recipe-card__reactions">
            <button class="icon-btn" type="button" aria-label="Like" aria-pressed="false" data-like>${ICON('heart')}</button>
            <button class="icon-btn icon-btn--sm" type="button" aria-label="Save recipe" aria-pressed="false" data-save>${ICON('bookmark')}</button>
          </div>
        </div>
      </div>`;
    BFC.syncReactions(card);
    return card;
  };

  /* ==== Saved recipes + likes ============================================================== */
  BFC.saved = {
    ids() { const a = db.get('bfc.savedRecipes', []); return Array.isArray(a) ? a : []; },
    has(id) { return this.ids().includes(id); },
    set(id, on) {
      const ids = this.ids().filter((x) => x !== id);
      if (on) ids.unshift(id); /* newest first */
      db.set('bfc.savedRecipes', ids);
    },
  };
  BFC.likes = {
    ids() { const a = db.get('bfc.likes', []); return Array.isArray(a) ? a : []; },
    has(id) { return this.ids().includes(id); },
    set(id, on) {
      const ids = this.ids().filter((x) => x !== id);
      if (on) ids.push(id);
      db.set('bfc.likes', ids);
    },
  };
  const likeId = (el) => { const s = el.closest('[data-recipe-id], [data-like-id]'); return s ? s.dataset.recipeId || s.dataset.likeId : null; };
  const saveId = (el) => { const s = el.closest('[data-recipe-id]'); return s ? s.dataset.recipeId : null; };
  /* Make every like / save button (and like counter) under root match what is stored. */
  BFC.syncReactions = (root = document) => {
    const scopes = root.matches && root.matches('[data-recipe-id], [data-like-id]') ? [root] : [];
    scopes.concat($$('[data-recipe-id], [data-like-id]', root)).forEach((scope) => {
      const id = scope.dataset.recipeId || scope.dataset.likeId;
      const liked = BFC.likes.has(id);
      $$('[data-like]', scope).forEach((b) => { if (likeId(b) === id) b.setAttribute('aria-pressed', String(liked)); });
      $$('[data-save]', scope).forEach((b) => { if (saveId(b) === id) b.setAttribute('aria-pressed', String(BFC.saved.has(id))); });
      const counter = $('[data-like-count]', scope);
      if (counter && likeId(counter) === id) {
        if (!counter.dataset.base) counter.dataset.base = String(parseInt(counter.textContent, 10) || 0);
        counter.textContent = String(Number(counter.dataset.base) + (liked ? 1 : 0));
      }
    });
  };
  const pop = (el) => { el.classList.remove('is-popping'); void el.offsetWidth; el.classList.add('is-popping'); };
  document.addEventListener('click', (e) => {
    const like = e.target.closest('[data-like]');
    if (like) {
      const id = likeId(like);
      if (!id) return;
      const on = !BFC.likes.has(id);
      BFC.likes.set(id, on);
      $$('[data-recipe-id], [data-like-id]').filter((s) => (s.dataset.recipeId || s.dataset.likeId) === id).forEach((s) => BFC.syncReactions(s));
      if (on) pop(like);
      return;
    }
    const save = e.target.closest('[data-save]');
    if (save) {
      const id = saveId(save);
      if (!id) return;
      const on = !BFC.saved.has(id);
      BFC.saved.set(id, on);
      $$('[data-recipe-id]').filter((s) => s.dataset.recipeId === id).forEach((s) => BFC.syncReactions(s));
      if (on) pop(save);
      document.dispatchEvent(new CustomEvent('bfc:saved-change', { detail: { id, on, card: save.closest('[data-recipe-id]') } }));
      if (on) BFC.guestToast('Recipe saved.');
      else BFC.toast('Removed from saved recipes.', { action: { label: 'Undo', onClick: () => {
        BFC.saved.set(id, true);
        $$('[data-recipe-id]').filter((s) => s.dataset.recipeId === id).forEach((s) => BFC.syncReactions(s));
        document.dispatchEvent(new CustomEvent('bfc:saved-change', { detail: { id, on: true, undo: true } }));
      } } });
    }
  });

  /* Remove an element with a short collapse animation. */
  BFC.removeAnimated = (el, done) => {
    if (reducedMotion()) { el.remove(); if (done) done(); return; }
    el.style.height = el.offsetHeight + 'px';
    el.classList.add('is-removing');
    requestAnimationFrame(() => { el.style.height = '0px'; });
    setTimeout(() => { el.remove(); el.classList.remove('is-removing'); el.style.height = ''; if (done) done(); }, 260);
  };

  /* ==== Overlays (dialogs, photo viewer) sit over the whole phone screen ==================== */
  const overlay = (cls, label) => {
    const el = document.createElement('div');
    el.className = cls;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (label) el.setAttribute('aria-label', label);
    ($('.phone') || document.body).appendChild(el);
    return el;
  };
  const closeOverlay = (el, done) => {
    el.classList.add('is-closing');
    setTimeout(() => { el.remove(); if (done) done(); }, reducedMotion() ? 0 : 180);
  };
  /* Keep Tab focus inside an open overlay. */
  const trapFocus = (el, e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button:not([disabled]), a[href]', el).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  };

  /* ---- Delete confirmation -------------------------------------------------------------------
     1. "Delete this …?"  Cancel / Delete
     2. After Delete: "… deleted" with a countdown. Undo restores it; "Done" closes right away.
     opts: { noun ('recipe'), name, text, seconds (8), onDelete(): token, onUndo(token), onClose(undone) } */
  BFC.confirmDelete = (opts) => {
    const noun = opts.noun || 'item';
    const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
    const seconds = opts.seconds || 8;
    const opener = document.activeElement;
    const el = overlay('modal', 'Delete ' + noun);
    el.innerHTML = `<div class="modal__card">
        <span class="modal__emblem modal__emblem--danger">${ICON('trash-2')}</span>
        <h2 class="modal__title">Delete this ${esc(noun)}?</h2>
        <p class="modal__text">${opts.name ? `“${esc(opts.name)}” ` : ''}${esc(opts.text || 'will be permanently removed.')}</p>
        <div class="modal__actions">
          <button type="button" class="btn btn--lg btn--secondary" data-modal="cancel">Cancel</button>
          <button type="button" class="btn btn--lg btn--danger" data-modal="delete">${ICON('trash-2')}Delete</button>
        </div>
      </div>`;
    const card = $('.modal__card', el);
    let stage = 'confirm';
    let token = null;
    let timer = null;
    let tick = null;
    const finish = (undone) => {
      if (stage === 'closed') return;
      stage = 'closed';
      clearTimeout(timer); clearInterval(tick);
      document.removeEventListener('keydown', onKey, true);
      closeOverlay(el, () => {
        if (opts.onClose) opts.onClose(undone);
        if (opener && opener.isConnected && opener.focus) opener.focus();
      });
    };
    const showDeleted = () => {
      stage = 'deleted';
      const R = 26, C = 2 * Math.PI * R;
      card.classList.remove('is-swapping'); void card.offsetWidth; card.classList.add('is-swapping');
      card.innerHTML = `
        <span class="modal__timer" aria-hidden="true">
          <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" class="modal__timer-track"/><circle cx="32" cy="32" r="${R}" class="modal__timer-ring" style="stroke-dasharray:${C};stroke-dashoffset:0"/></svg>
          <span class="modal__timer-num">${seconds}</span>
        </span>
        <h2 class="modal__title">${esc(Noun)} deleted</h2>
        <p class="modal__text" aria-live="polite">Changed your mind? You can undo this for <strong data-left>${seconds}</strong> more second${seconds === 1 ? '' : 's'}.</p>
        <div class="modal__actions">
          <button type="button" class="btn btn--lg btn--secondary" data-modal="undo">${ICON('undo-2')}Undo</button>
          <button type="button" class="btn btn--lg" data-modal="done">Done</button>
        </div>`;
      const ring = $('.modal__timer-ring', card);
      requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.transition = `stroke-dashoffset ${seconds}s linear`; ring.style.strokeDashoffset = String(C); }));
      let left = seconds;
      tick = setInterval(() => {
        left -= 1;
        if (left <= 0) return;
        $('.modal__timer-num', card).textContent = String(left);
        const l = $('[data-left]', card);
        l.textContent = String(left);
        l.nextSibling.textContent = ` more second${left === 1 ? '' : 's'}.`;
      }, 1000);
      timer = setTimeout(() => finish(false), seconds * 1000);
      $('[data-modal="undo"]', card).focus();
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-modal]');
      if (!b) { if (e.target === el && stage === 'confirm') finish(false); return; }
      const what = b.dataset.modal;
      if (what === 'cancel') finish(false);
      else if (what === 'delete') { token = opts.onDelete ? opts.onDelete() : null; showDeleted(); }
      else if (what === 'undo') { if (opts.onUndo) opts.onUndo(token); finish(true); }
      else if (what === 'done') finish(false);
    });
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); finish(false); return; }
      trapFocus(el, e);
    }
    document.addEventListener('keydown', onKey, true);
    $('[data-modal="cancel"]', card).focus();
  };

  /* ---- Full-screen photo viewer: swipe, drag or use the arrows / arrow keys ------------------- */
  BFC.lightbox = (photos, start = 0, title = 'Photo') => {
    if (!photos.length) return;
    const opener = document.activeElement;
    const el = overlay('lightbox', title + ' photos');
    const many = photos.length > 1;
    el.innerHTML = `
      <div class="lightbox__bar"><span class="lightbox__count" aria-live="polite"></span><button type="button" class="lightbox__close" aria-label="Close photo viewer">${ICON('x')}</button></div>
      <div class="lightbox__stage"><div class="lightbox__track">${photos.map((p, i) => `<figure class="lightbox__slide"><img src="${esc(p.src)}" alt="${esc(p.alt || `${title}, photo ${i + 1}`)}" draggable="false"></figure>`).join('')}</div></div>
      ${many ? `<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous photo">${ICON('chevron-left')}</button>
      <button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next photo">${ICON('chevron-right')}</button>
      <div class="lightbox__dots">${photos.map((_, i) => `<button type="button" class="lightbox__dot" aria-label="Photo ${i + 1}" data-dot="${i}"></button>`).join('')}</div>` : ''}`;
    const track = $('.lightbox__track', el);
    const stage = $('.lightbox__stage', el);
    let index = Math.max(0, Math.min(start, photos.length - 1));
    const show = (i, animate = true) => {
      index = Math.max(0, Math.min(i, photos.length - 1));
      track.style.transition = animate && !reducedMotion() ? 'transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1)' : 'none';
      track.style.transform = `translateX(${-index * 100}%)`;
      $('.lightbox__count', el).textContent = many ? `${index + 1} / ${photos.length}` : '';
      if (many) {
        $('.lightbox__nav--prev', el).disabled = index === 0;
        $('.lightbox__nav--next', el).disabled = index === photos.length - 1;
        $$('.lightbox__dot', el).forEach((d, j) => d.setAttribute('aria-current', String(j === index)));
      }
    };
    show(index, false);
    const close = () => {
      document.removeEventListener('keydown', onKey, true);
      closeOverlay(el, () => { if (opener && opener.isConnected && opener.focus) opener.focus(); });
    };
    el.addEventListener('click', (e) => {
      if (e.target.closest('.lightbox__close')) close();
      else if (e.target.closest('.lightbox__nav--prev')) show(index - 1);
      else if (e.target.closest('.lightbox__nav--next')) show(index + 1);
      else if (e.target.closest('[data-dot]')) show(Number(e.target.closest('[data-dot]').dataset.dot));
    });
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
      else trapFocus(el, e);
    }
    document.addEventListener('keydown', onKey, true);
    /* Swipe / drag between photos. A tap (no drag) on the dark area around the photo closes. */
    let startX = null, dx = 0, startT = 0, pid = null;
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      startX = e.clientX; dx = 0; startT = Date.now(); pid = e.pointerId;
      track.style.transition = 'none';
      try { stage.setPointerCapture(pid); } catch (err) { /* ignore */ }
    });
    stage.addEventListener('pointermove', (e) => {
      if (startX == null || e.pointerId !== pid) return;
      dx = e.clientX - startX;
      if (!many) dx /= 4;
      else if ((index === 0 && dx > 0) || (index === photos.length - 1 && dx < 0)) dx /= 3; /* rubber-band at the ends */
      track.style.transform = `translateX(calc(${-index * 100}% + ${dx}px))`;
    });
    const end = (e) => {
      if (startX == null || e.pointerId !== pid) return;
      const w = stage.clientWidth || 1;
      const fast = Math.abs(dx) > 30 && Date.now() - startT < 250;
      const tapped = Math.abs(dx) < 5;
      startX = null;
      if (tapped && e.type === 'pointerup' && !e.target.closest('img')) { close(); return; }
      if (many && (Math.abs(dx) > w * 0.2 || fast)) show(index + (dx < 0 ? 1 : -1));
      else show(index);
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    $('.lightbox__close', el).focus();
  };
  /* Recipe pages: tapping the cover or any photo opens the viewer with every photo of that recipe. */
  const PHOTO_SEL = '.recipe-view .recipe-overview__photo img, .recipe-view .photo-strip img';
  BFC.enhancePhotos = (root = document) => {
    $$(PHOTO_SEL, root).forEach((img) => {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      if (!img.dataset.label) img.dataset.label = img.alt;
      img.setAttribute('aria-label', 'View photo full screen: ' + img.dataset.label);
    });
  };
  const openPhotos = (img) => {
    const view = img.closest('.recipe-view');
    const imgs = $$(PHOTO_SEL, view);
    const titleEl = $('.page-title', view);
    BFC.lightbox(imgs.map((i) => ({ src: i.currentSrc || i.src, alt: i.dataset.label || i.alt })), imgs.indexOf(img), titleEl ? titleEl.textContent.trim() : 'Recipe');
  };
  document.addEventListener('click', (e) => { const img = e.target.closest(PHOTO_SEL); if (img) openPhotos(img); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const img = e.target.closest && e.target.closest(PHOTO_SEL);
    if (img) { e.preventDefault(); openPhotos(img); }
  });

  /* ==== Event registrations / job applications ============================================= */
  BFC.signups = {
    all() { const o = db.get('bfc.signups', {}); return o && typeof o === 'object' ? o : {}; },
    has(id) { return !!this.all()[id]; },
    add(id) {
      const o = this.all();
      if (o[id]) return;
      o[id] = { at: Date.now() };
      db.set('bfc.signups', o);
      const ev = BFC.events[id];
      if (ev) BFC.notify(ev.kind === 'event'
        ? { icon: 'calendar', title: 'You’re registered for ' + ev.title, text: `${ev.when} · ${ev.where}`, href: 'registration.html' }
        : { icon: 'briefcase', title: 'Application sent: ' + ev.title, text: 'We’ll review it and email you. ' + ev.when + '.', href: 'announcements.html' });
    },
  };
  /* Register / Apply buttons for something already submitted turn gray and read "Registered" / "Applied". */
  $$('a[data-signup]').forEach((a) => {
    if (!BFC.signups.has(a.dataset.signup)) return;
    a.textContent = a.dataset.doneLabel || 'Registered';
    a.removeAttribute('href');
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('role', 'link');
    a.classList.add('is-done');
  });

  /* ==== Notifications ======================================================================= */
  const SEED = [
    { id: 'seed-brown-butter', at: Date.parse('2026-11-20T10:00:00'), icon: 'book', title: 'New Recipe Posted: Brown Butter Cookies', text: 'Chewy cookies, sea salt, simple ingredients. Find the recipe in Recipes.', href: 'recipe-brown-butter-cookies.html', read: true },
    { id: 'seed-welcome', at: db.get('bfc.firstVisit', Date.now()), icon: 'smartphone', title: 'Welcome to Baking for a Cause!', text: 'You’re browsing as a guest. Recipes you save and events you sign up for are kept on this device.', href: 'profile.html' },
  ];
  BFC.notify = (n) => {
    const list = db.get('bfc.notices', []);
    list.unshift(Object.assign({ id: BFC.uid('n'), at: Date.now() }, n));
    db.set('bfc.notices', list.slice(0, 30));
    renderNotices();
  };
  const readIds = () => db.get('bfc.noticesRead', []);
  const allNotices = () => db.get('bfc.notices', []).concat(SEED).sort((a, b) => b.at - a.at);
  const isUnread = (n) => !n.read && !readIds().includes(n.id);
  BFC.timeAgo = (at) => {
    const d = new Date(at);
    const diff = (Date.now() - at) / 60000;
    if (diff < 1) return 'Just now';
    if (diff < 60) return Math.floor(diff) + ' min ago';
    if (d.toDateString() === new Date().toDateString()) return 'Today · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    if (diff < 60 * 24 * 7) return Math.floor(diff / 60 / 24) + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  let shownUnread = [];
  function renderNotices() {
    const list = $('#notifications .notice-list');
    const bell = $('[data-toggle="notifications"]');
    const items = allNotices();
    if (bell) bell.classList.toggle('has-unread', items.some(isUnread));
    if (!list) return;
    list.innerHTML = items.map((n) => {
      const unread = isUnread(n) || shownUnread.includes(n.id);
      return `<a class="notice${unread ? ' notice--unread' : ''}" href="${esc(n.href || '#')}">
        <span class="notice__emblem">${ICON(n.icon) || ICON('bell')}</span>
        <span class="notice__body">
          <span class="notice__meta"><span>${esc(BFC.timeAgo(n.at))}${unread ? '' : ' · Read'}</span>${unread ? '<span class="notice__new">NEW</span>' : ''}</span>
          <span class="notice__title">${esc(n.title)}</span>
          <span class="notice__text">${esc(n.text)}</span>
        </span></a>`;
    }).join('') || '<p class="notice-empty">You’re all caught up.</p>';
  }
  /* Opening the panel marks everything read (the NEW tags stay until it is closed). */
  document.addEventListener('bfc:popup', (e) => {
    if (e.detail.name !== 'notifications') return;
    if (e.detail.open) {
      shownUnread = allNotices().filter(isUnread).map((n) => n.id);
      db.set('bfc.noticesRead', Array.from(new Set(readIds().concat(shownUnread))).slice(-100));
    } else shownUnread = [];
    renderNotices();
  });
  renderNotices();

  /* ==== Popups: bell → notifications, "+" → create menu ===================================== */
  const popups = {};
  function setOpen(name, open) {
    const p = popups[name];
    if (!p || p.target.hidden === !open) return;
    p.target.hidden = !open;
    p.btn.setAttribute('aria-expanded', String(open));
    document.dispatchEvent(new CustomEvent('bfc:popup', { detail: { name, open } }));
  }
  function closeAll() { Object.keys(popups).forEach((n) => setOpen(n, false)); }
  $$('[data-toggle]').forEach((btn) => {
    const name = btn.dataset.toggle;
    const target = document.getElementById(name);
    if (!target) return;
    popups[name] = { btn, target };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = target.hidden;
      closeAll();
      setOpen(name, willOpen);
    });
  });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => setOpen(b.dataset.close, false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.popup, .fab-menu')) closeAll(); });

  /* ==== Dropdowns: same list style as the Share Recipe "Difficulty" menu ===================== */
  /* wrap: .dropdown element holding a trigger button and a .dropdown__list of .dropdown__option buttons.
     onPick(option) runs after an option is chosen; return false from it to keep the list open. */
  const dropdowns = [];
  BFC.dropdown = (wrap, btn, onPick) => {
    const list = $('.dropdown__list', wrap);
    const set = (open) => { list.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    dropdowns.push(() => set(false));
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const willOpen = list.hidden;
      dropdowns.forEach((close) => close());
      set(willOpen);
    });
    $$('.dropdown__option', list).forEach((o) => o.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (onPick(o) !== false) set(false);
    }));
    return set;
  };
  document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown')) dropdowns.forEach((close) => close()); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dropdowns.forEach((close) => close()); });

  /* Recipe filter selects use the custom list instead of the native menu.
     The hidden <select> keeps the value, so the filtering below still reads it. */
  $$('label.select').forEach((label) => {
    const sel = $('select', label);
    if (!sel) return;
    const wrap = document.createElement('div');
    wrap.className = 'dropdown dropdown--select';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'select';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', sel.getAttribute('aria-label') || '');
    while (label.firstChild) btn.appendChild(label.firstChild);
    sel.remove();
    sel.hidden = true;
    const list = document.createElement('div');
    list.className = 'dropdown__list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    list.innerHTML = Array.from(sel.options).map((o) =>
      `<button type="button" class="dropdown__option" role="option" aria-selected="${o.selected}" data-value="${esc(o.value)}">${esc(o.textContent)}</button>`).join('');
    label.replaceWith(wrap);
    wrap.append(btn, list, sel);
    const pick = (o, silent) => {
      sel.value = o.dataset.value;
      $('.select__value', btn).textContent = o.textContent;
      btn.classList.toggle('has-value', !!o.dataset.value);
      $$('.dropdown__option', list).forEach((x) => x.setAttribute('aria-selected', String(x === o)));
      if (!silent) sel.dispatchEvent(new Event('change'));
    };
    BFC.dropdown(wrap, btn, (o) => pick(o));
    sel.bfcLabel = () => (sel.value ? $('.select__value', btn).textContent : '');
    sel.bfcReset = () => pick($('.dropdown__option', list), true);
  });

  /* Announcements: filter icon in the search bar → Pinned / Event / Update (click again to clear) */
  const typeWrap = $('#type-filter');
  if (typeWrap) {
    const typeBtn = $('#type-filter-button');
    const typeInput = $('[data-filter-key="type"]', typeWrap);
    const setType = (o, silent) => {
      const v = !o || typeInput.value === o.dataset.value ? '' : o.dataset.value;
      typeInput.value = v;
      $$('.dropdown__option', typeWrap).forEach((x) => x.setAttribute('aria-selected', String(!!v && x === o)));
      typeBtn.classList.toggle('is-active', !!v);
      typeBtn.setAttribute('aria-label', v ? `Filter posts: ${o.textContent}` : 'Filter posts');
      if (!silent) typeInput.dispatchEvent(new Event('change'));
    };
    BFC.dropdown(typeWrap, typeBtn, (o) => setType(o));
    typeInput.bfcLabel = () => { const o = $(`.dropdown__option[data-value="${typeInput.value}"]`, typeWrap); return typeInput.value && o ? o.textContent : ''; };
    typeInput.bfcReset = () => setType(null, true);
  }

  /* "Under development!" note for post comment buttons (comments are out of scope). */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-comment]');
    if (!b) return;
    const note = $('.dev-note', b.closest('.post, .event-card') || document);
    if (note) note.hidden = false;
  });

  /* ==== Search + dropdown filtering (Announcements, Recipes, Saved, Forums) ================= */
  const filterRuns = [];
  $$('[data-filter-input]').forEach((input) => {
    const container = document.getElementById(input.dataset.filterInput);
    if (!container) return;
    const run = () => {
      const q = input.value.trim().toLowerCase();
      const sel = {};
      $$('[data-filter-key]').forEach((s) => { sel[s.dataset.filterKey] = s.value; });
      let shown = 0;
      $$('[data-filter-item]', container).forEach((item) => {
        let ok = !q || item.textContent.toLowerCase().includes(q);
        if (ok && sel.type) ok = (item.dataset.type || '').split(/\s+/).includes(sel.type);
        if (ok && sel.answered) ok = item.dataset.answered === sel.answered;
        if (ok && sel.diet) ok = (item.dataset.diet || '').split(/\s+/).includes(sel.diet);
        if (ok && sel.difficulty) ok = item.dataset.difficulty === sel.difficulty;
        if (ok && sel.dish) ok = item.dataset.dish === sel.dish;
        if (ok && sel.time) {
          const m = Number(item.dataset.minutes);
          ok = sel.time === 'u30' ? m < 30 : sel.time === '30-60' ? m >= 30 && m <= 60 : m > 60;
        }
        item.hidden = !ok;
        if (ok) shown += 1;
      });
      const empty = $('[data-filter-empty]', container);
      if (empty) empty.hidden = shown !== 0 || !$$('[data-filter-item]', container).length;
      /* "Filtered by … · N shown · Clear filters" bar while a search or filter is active */
      const status = $('[data-filter-status]');
      if (status) {
        const parts = $$('[data-filter-key]').filter((k) => k.dataset.filterKey !== 'sort').map((k) => (k.bfcLabel ? k.bfcLabel() : k.value)).filter(Boolean);
        if (q) parts.unshift(`“${input.value.trim()}”`);
        status.hidden = !parts.length;
        $('[data-filter-summary]', status).innerHTML = `<strong>${esc(parts.join(' · '))}</strong><span>${shown} shown</span>`;
      }
    };
    filterRuns.push(run);
    input.addEventListener('input', run);
    $$('[data-filter-key]').forEach((s) => s.addEventListener('change', run));
  });
  /* Re-apply the current search/filters after cards are added or removed. */
  BFC.refilter = () => filterRuns.forEach((run) => run());
  /* "Clear filters": empty the search box and put every filter back to "Any". */
  BFC.clearFilters = () => {
    $$('[data-filter-input]').forEach((i) => { i.value = ''; });
    $$('[data-filter-key]').forEach((k) => { if (k.bfcReset) k.bfcReset(); else k.value = ''; });
    BFC.refilter();
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-filter-clear]')) return;
    BFC.clearFilters();
    const search = $('[data-filter-input]');
    if (search) search.focus({ preventScroll: true });
  });

  /* ==== Return pages: forms and the profile go back to the page they were opened from ======== */
  const PAGES = {
    announcements: { label: 'Announcements', tab: 'announcements', back: 'Back to announcements' },
    recipes: { label: 'Recipes', tab: 'recipes', back: 'Back to recipes' },
    'saved-recipes': { label: 'Saved Recipes', tab: 'recipes', back: 'Back to saved recipes' },
    forums: { label: 'Forums', tab: 'forums', back: 'Back to forums' },
    registration: { label: 'Registration', tab: 'registration', back: 'Back to registration' },
    profile: { label: 'Your Profile', tab: null, back: 'Back to your profile' },
  };
  const fromParam = new URLSearchParams(location.search).get('from');
  BFC.from = PAGES[fromParam] ? fromParam : null;
  BFC.pages = PAGES;

  /* Every profile button remembers which page it was opened from. */
  if (here !== 'profile' && PAGES[here]) {
    $$('a[href="profile.html"]').forEach((a) => { a.href = 'profile.html?from=' + here; });
  }
  /* Form pages (membership, event registration, hiring application): Close / Back / "Back to …" */
  if (BFC.from && here !== 'profile') {
    const target = BFC.from + '.html';
    $$('.exit-action, [data-return]').forEach((a) => { a.href = target; });
    $$('[data-return]').forEach((a) => { a.textContent = PAGES[BFC.from].back; });
  }
  /* Profile: back link and bottom nav point at the page the profile was opened from. */
  if (here === 'profile') {
    let origin = BFC.from;
    if (origin) db.set('bfc.profileFrom', origin);
    else origin = PAGES[db.get('bfc.profileFrom')] ? db.get('bfc.profileFrom') : null;
    origin = origin && origin !== 'profile' ? origin : 'announcements';
    const back = $('.back-link');
    if (back) {
      back.href = origin + '.html';
      const icon = $('svg', back);
      back.textContent = PAGES[origin].label;
      if (icon) back.prepend(icon);
    }
    const tab = PAGES[origin].tab;
    $$('.nav__tab').forEach((t) => {
      if (t.getAttribute('href') === tab + '.html') t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
  }

  /* ==== Floating "+" button hides while scrolling down (so it never covers card buttons) ====== */
  const fab = $('.fab');
  const scroller = $('.screen-body--nav');
  if (fab && scroller) {
    let lastY = scroller.scrollTop;
    scroller.addEventListener('scroll', () => {
      const y = scroller.scrollTop;
      if (Math.abs(y - lastY) < 6) return;
      const hide = y > lastY && y > 40 && fab.getAttribute('aria-expanded') !== 'true';
      fab.classList.toggle('is-hidden', hide);
      lastY = y;
    }, { passive: true });
  }

  /* ==== Page transitions ======================================================================
     Pages fade in (CSS). Internal links fade the current page out briefly before navigating. */
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || reducedMotion()) return;
    const href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^[a-z]+:/i.test(href)) return;
    e.preventDefault();
    document.documentElement.classList.add('is-leaving');
    setTimeout(() => { location.href = a.href; }, 140);
  });
  window.addEventListener('pageshow', () => document.documentElement.classList.remove('is-leaving'));

  BFC.enhancePhotos();
  BFC.syncReactions();
})();
