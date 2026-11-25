/* Baking for a Cause – prototype behaviour (menus, likes/saves, filters, forms). */
(function () {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---- Saved recipes: shared store + recipe-card builder (used by forms.js and saved.js) ---- */
  const BFC = (window.BFC = window.BFC || {});
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON = (n) => (window.BFC_ICONS && window.BFC_ICONS[n]) || '';
  const SAVED_KEY = 'bfc.savedRecipes';
  const savedMemory = { ids: [] };
  BFC.saved = {
    ids() {
      try {
        const v = localStorage.getItem(SAVED_KEY);
        if (v) { const a = JSON.parse(v); if (Array.isArray(a)) return a; }
      } catch (e) { /* storage blocked: fall back to memory */ }
      return savedMemory.ids.slice();
    },
    has(id) { return this.ids().includes(id); },
    set(id, on) {
      const ids = this.ids().filter((x) => x !== id);
      if (on) ids.unshift(id); /* newest first */
      savedMemory.ids = ids;
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)); } catch (e) { /* ignore */ }
    },
    /* Make every bookmark button under `root` reflect what is stored. */
    sync(root = document) {
      $$('[data-recipe-id] [data-save]', root).forEach((b) => {
        b.setAttribute('aria-pressed', String(this.has(b.closest('[data-recipe-id]').dataset.recipeId)));
      });
    },
  };
  /* r: { id, title, tags[], text, likes, photo, alt, href, difficulty, minutes, dish, saved } */
  BFC.recipeCard = (r) => {
    const card = document.createElement('article');
    card.className = 'recipe-card';
    card.setAttribute('data-filter-item', '');
    card.dataset.recipeId = r.id;
    card.dataset.difficulty = r.difficulty;
    card.dataset.minutes = String(r.minutes);
    card.dataset.dish = r.dish;
    card.innerHTML = `
      <div class="recipe-card__photo"><img src="${esc(r.photo)}" alt="${esc(r.alt || '')}"></div>
      <div class="recipe-card__body">
        <div class="recipe-card__head">
          <div class="recipe-card__title-block"><h2 class="recipe-card__title">${esc(r.title)}</h2><div class="tags">${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
          <span class="rating">${ICON('heart')}<span data-like-count>${esc(r.likes || 0)}</span></span>
        </div>
        <p class="recipe-card__text">${esc(r.text)}</p>
        <div class="recipe-card__actions">
          <a class="btn" href="${esc(r.href)}">View recipe ${ICON('arrow-right')}</a>
          <div class="recipe-card__reactions">
            <button class="icon-btn" type="button" aria-label="Like" aria-pressed="false" data-like>${ICON('heart')}</button>
            <button class="icon-btn icon-btn--sm" type="button" aria-label="Save recipe" aria-pressed="${r.saved ? 'true' : 'false'}" data-save>${ICON('bookmark')}</button>
          </div>
        </div>
      </div>`;
    return card;
  };

  /* ---- Popups: bell → notifications, "+" → create menu ------------------------------- */
  const popups = {};
  function setOpen(name, open) {
    const p = popups[name];
    if (!p) return;
    p.target.hidden = !open;
    p.btn.setAttribute('aria-expanded', String(open));
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

  /* ---- Dropdowns: same list style as the Share Recipe "Difficulty" menu ----------------- */
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

  /* Recipe filter selects (Difficulty / Time / Dish type) use the custom list instead of the native menu.
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
    BFC.dropdown(wrap, btn, (o) => {
      sel.value = o.dataset.value;
      $('.select__value', btn).textContent = o.textContent;
      $$('.dropdown__option', list).forEach((x) => x.setAttribute('aria-selected', String(x === o)));
      sel.dispatchEvent(new Event('change'));
    });
  });

  /* Announcements: filter icon in the search bar → Pinned / Event / Update (click again to clear) */
  const typeWrap = $('#type-filter');
  if (typeWrap) {
    const typeBtn = $('#type-filter-button');
    const typeInput = $('[data-filter-key="type"]', typeWrap);
    BFC.dropdown(typeWrap, typeBtn, (o) => {
      const v = typeInput.value === o.dataset.value ? '' : o.dataset.value;
      typeInput.value = v;
      $$('.dropdown__option', typeWrap).forEach((x) => x.setAttribute('aria-selected', String(!!v && x === o)));
      typeBtn.classList.toggle('is-active', !!v);
      typeBtn.setAttribute('aria-label', v ? `Filter posts: ${o.textContent}` : 'Filter posts');
      typeInput.dispatchEvent(new Event('change'));
    });
  }

  /* ---- "Under development!" note for post comment buttons ---------------------------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-comment]');
    if (!b) return;
    const note = $('.dev-note', b.closest('.post, .event-card') || document);
    if (note) note.hidden = false;
  });

  /* ---- Event registrations / job applications the visitor has submitted ----------------- */
  const SIGNUP_KEY = 'bfc.signups';
  const signupMemory = {};
  BFC.signups = {
    all() {
      try { const v = localStorage.getItem(SIGNUP_KEY); if (v) { const o = JSON.parse(v); if (o && typeof o === 'object') return o; } } catch (e) { /* ignore */ }
      return Object.assign({}, signupMemory);
    },
    has(id) { return !!this.all()[id]; },
    add(id) {
      const o = this.all(); o[id] = true; signupMemory[id] = true;
      try { localStorage.setItem(SIGNUP_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ }
    },
  };
  /* Register / Apply buttons for something already submitted turn gray and read "Registered" / "Applied". */
  $$('[data-signup]').forEach((a) => {
    if (!BFC.signups.has(a.dataset.signup)) return;
    a.textContent = a.dataset.doneLabel || 'Registered';
    a.removeAttribute('href');
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('role', 'link');
    a.classList.add('is-done');
  });

  /* ---- Return pages: forms and the profile go back to the page they were opened from ------ */
  const PAGES = {
    announcements: { label: 'Announcements', tab: 'announcements', back: 'Back to announcements' },
    recipes: { label: 'Recipes', tab: 'recipes', back: 'Back to recipes' },
    'saved-recipes': { label: 'Saved Recipes', tab: 'recipes', back: 'Back to saved recipes' },
    forums: { label: 'Forums', tab: 'forums', back: 'Back to forums' },
    registration: { label: 'Registration', tab: 'registration', back: 'Back to registration' },
    profile: { label: 'Your Profile', tab: null, back: 'Back to your profile' },
  };
  const here = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  const fromParam = new URLSearchParams(location.search).get('from');
  BFC.from = PAGES[fromParam] ? fromParam : null;

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
    try {
      if (origin) sessionStorage.setItem('bfc.profileFrom', origin);
      else origin = PAGES[sessionStorage.getItem('bfc.profileFrom')] ? sessionStorage.getItem('bfc.profileFrom') : null;
    } catch (e) { /* ignore */ }
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

  /* ---- Like / save toggles (delegated, so cards added later by forms.js work too) ------ */
  document.addEventListener('click', (e) => {
    const like = e.target.closest('[data-like]');
    if (like) {
      const on = like.getAttribute('aria-pressed') !== 'true';
      like.setAttribute('aria-pressed', String(on));
      const scope = like.closest('[data-filter-item], article');
      const counter = scope && scope.querySelector('[data-like-count]');
      if (counter) counter.textContent = String(parseInt(counter.textContent, 10) + (on ? 1 : -1));
      return;
    }
    const save = e.target.closest('[data-save]');
    if (save) {
      const on = save.getAttribute('aria-pressed') !== 'true';
      save.setAttribute('aria-pressed', String(on));
      const card = save.closest('[data-recipe-id]');
      if (card) {
        BFC.saved.set(card.dataset.recipeId, on);
        document.dispatchEvent(new CustomEvent('bfc:saved-change', { detail: { id: card.dataset.recipeId, on, card } }));
      }
    }
  });

  /* ---- Search + dropdown filtering (Announcements, Recipes) --------------------------- */
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
    };
    input.addEventListener('input', run);
    $$('[data-filter-key]').forEach((s) => s.addEventListener('change', run));
  });

  BFC.saved.sync();
})();
