/* Baking for a Cause – prototype behaviour (menus, likes/saves, filters, forms). */
(function () {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
    if (save) save.setAttribute('aria-pressed', String(save.getAttribute('aria-pressed') !== 'true'));
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
      if (empty) empty.hidden = shown !== 0;
    };
    input.addEventListener('input', run);
    $$('[data-filter-key]').forEach((s) => s.addEventListener('change', run));
  });
})();
