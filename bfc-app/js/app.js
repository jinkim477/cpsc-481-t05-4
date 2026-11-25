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

  /* ---- Select boxes show their current value ------------------------------------------ */
  $$('.select select').forEach((sel) => {
    sel.addEventListener('change', () => {
      const v = sel.closest('.select').querySelector('.select__value');
      if (v) v.textContent = sel.options[sel.selectedIndex].textContent;
    });
  });

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
