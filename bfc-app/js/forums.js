/* Baking for a Cause – Forums: question form, discussion replies, thumbs, shared-question storage. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const ICON = (n) => (window.BFC_ICONS && window.BFC_ICONS[n]) || '';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'A';

  const KEY = 'bfc.question';
  const memory = {};
  const store = {
    get() { try { const v = localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch (e) { /* ignore */ } return memory.q || null; },
    set(q) { memory.q = q; try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) { /* ignore */ } },
    clear() { memory.q = null; try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
  };

  /* "Under development!" buttons on discussions that have no designed screen */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dev]');
    if (!b) return;
    const note = b.nextElementSibling;
    if (note && note.classList.contains('dev-note')) note.hidden = false;
  });

  /* ---- Forums list: show a question the visitor just asked ------------------------------ */
  const threads = $('#threads');
  const mine = threads && store.get();
  if (mine) {
    const a = document.createElement('article');
    a.className = 'thread';
    a.setAttribute('data-filter-item', '');
    a.innerHTML = `
      <div class="thread__author"><span class="avatar">${esc(mine.anonymous ? 'A' : initials(mine.name))}</span><span class="thread__name">${esc(mine.anonymous ? 'Anonymous' : mine.name)}</span><span class="thread__time">· Just now</span></div>
      <h2 class="thread__title">${esc(mine.title)}</h2>
      <div class="thread__meta"><span>${ICON('message-circle')}0</span><span>${ICON('heart')}0</span></div>
      <a class="btn btn--cta" href="forum-discussion.html?q=mine">View discussion ${ICON('arrow-right')}</a>
      <div class="thread__actions"><button class="btn-soft" type="button" data-dev>Edit</button><button class="btn-soft btn-soft--danger" type="button" data-delete>Delete</button></div>`;
    threads.prepend(a);
    /* Edit is not designed in Figma: show the same "Under development!" note used elsewhere. */
    const actions = $('.thread__actions', a);
    const devNote = document.createElement('p');
    devNote.className = 'dev-note'; devNote.hidden = true; devNote.textContent = 'Under development!';
    actions.querySelector('[data-dev]').addEventListener('click', () => { devNote.hidden = false; });
    actions.after(devNote);
    /* Delete with Undo */
    const banner = $('#deleted-banner');
    actions.querySelector('[data-delete]').addEventListener('click', () => { store.clear(); a.hidden = true; banner.hidden = false; });
    $('#undo-delete').addEventListener('click', () => { store.set(mine); a.hidden = false; banner.hidden = true; });
  }

  /* ---- Discussion page --------------------------------------------------------------------- */
  const disc = $('#discussion');
  if (disc) {
    const q = new URLSearchParams(location.search).get('q') === 'mine' ? store.get() : null;
    if (q) {
      const who = q.anonymous ? 'Anonymous' : q.name;
      $('#d-title').textContent = q.title;
      $('#d-avatar').textContent = q.anonymous ? 'A' : initials(q.name);
      $('#d-name').textContent = who;
      $('#d-time').textContent = '· Just now';
      $('#d-body').textContent = q.details;
      $('#marcus').remove();
      const reply = $('[data-reply]');
      if (reply) reply.remove();
      $('#no-answers').hidden = false;
    }

    const form = $('#answer-form');
    const text = $('#answer-text');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = text.value.trim();
      if (!v) { text.focus(); return; }
      $('#answer-posted').hidden = false;
      $('#no-answers').hidden = true;
      const card = document.createElement('div');
      card.style.cssText = 'display:flex;flex-direction:column;gap:12px';
      card.innerHTML = `
        <article class="answer">
          <div class="thread__author"><span class="avatar">Y</span><span class="thread__name">You</span><span class="thread__time">· Just now</span></div>
          <p class="answer__text" style="color:var(--color-ink)">${esc(v)}</p>
          <div class="answer__reactions">
            <button class="thumb" type="button" aria-label="Like this answer" aria-pressed="false" data-thumb="up">${ICON('thumbs-up')}<span class="thumb__count">0</span></button>
            <button class="thumb" type="button" aria-label="Dislike this answer" aria-pressed="false" data-thumb="down">${ICON('thumbs-down')}<span class="thumb__count">0</span></button>
          </div>
        </article>
        <form class="compose reply-form" data-reply novalidate>
          <label class="input"><input type="text" placeholder="Reply to yourself..." aria-label="Reply to yourself"><button class="compose__send" type="submit" aria-label="Send reply">${ICON('send')}</button></label>
        </form>`;
      $('#my-answer').prepend(card);
      text.value = '';
    });

    /* Replies are not part of the prototype scope: show the same "Under development!" note as the design. */
    disc.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-reply]');
      if (!f) return;
      e.preventDefault();
      $('#dev-note').hidden = false;
    });

    /* Thumbs up / down on answers (mutually exclusive) */
    disc.addEventListener('click', (e) => {
      const t = e.target.closest('[data-thumb]');
      if (!t) return;
      const wrap = t.closest('.answer__reactions');
      const adjust = (btn, d) => { const c = $('.thumb__count', btn); c.textContent = String(Math.max(0, parseInt(c.textContent, 10) + d)); };
      const turningOn = t.getAttribute('aria-pressed') !== 'true';
      const other = $$('[data-thumb]', wrap).find((b) => b !== t);
      if (turningOn && other.getAttribute('aria-pressed') === 'true') { other.setAttribute('aria-pressed', 'false'); adjust(other, -1); }
      t.setAttribute('aria-pressed', String(turningOn));
      adjust(t, turningOn ? 1 : -1);
    });
  }

  /* ---- Ask a Question ------------------------------------------------------------------------ */
  const ask = $('#ask-form');
  if (ask) {
    const err = $('#ask-error');
    const name = $('#q-name'), anon = $('#q-anon'), title = $('#q-title'), details = $('#q-details');
    const mark = (el, bad) => { (el.closest('.input') || el).classList.toggle('is-invalid', bad); };
    anon.addEventListener('change', () => { name.disabled = anon.checked; mark(name, false); });
    ask.addEventListener('input', (e) => { mark(e.target, false); if (!$$('.is-invalid', ask).length) err.hidden = true; });
    ask.addEventListener('submit', (e) => {
      e.preventDefault();
      const checks = [[name, anon.checked || name.value.trim()], [title, title.value.trim()], [details, details.value.trim()]];
      checks.forEach(([el, ok]) => mark(el, !ok));
      const bad = checks.find(([, ok]) => !ok);
      if (bad) { err.hidden = false; bad[0].focus(); return; }
      const q = { name: name.value.trim(), anonymous: anon.checked, title: title.value.trim(), details: details.value.trim() };
      store.set(q);
      err.hidden = true;
      $('#ask-fields').hidden = true;
      $('#ask-nav').hidden = true;
      $('#ask-title').hidden = true;
      $('#ask-done').hidden = false;
      $('#done-avatar').textContent = q.anonymous ? 'A' : initials(q.name);
      $('#done-name').textContent = q.anonymous ? 'Anonymous' : q.name;
      $('#done-q').textContent = q.title;
      $('.screen-body', ask).scrollTop = 0;
    });
  }
})();
