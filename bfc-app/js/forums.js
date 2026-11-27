/* Baking for a Cause – Forums: thread list, discussions (answers, replies, thumbs), Ask / Edit a question.
   Everything the visitor posts is stored with BFC.db (app.js). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const BFC = window.BFC;
  const db = BFC.db;
  const ICON = BFC.icon;
  const esc = BFC.esc;
  const initials = (n) => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'A';
  const params = new URLSearchParams(location.search);

  /* ---- Built-in threads ------------------------------------------------------------------- */
  const THREADS = {
    swap: {
      author: 'Sam M.', time: '2 hrs ago', ago: 120, likes: 15, comments: 6,
      title: 'Anyone up for a library bake swap on Friday?',
      body: 'Hey everyone! I’m planning a mid-semester study break and thought it’d be fun to host an informal bake swap this Friday at 2:00 PM on the 3rd floor of the library.',
      answers: [
        { id: 'swap-1', author: 'Marcus C.', time: '15 mins ago', up: 5, down: 0, text: 'Count me in! I’ve been needing a reason to take a break from studying anyway. I can bring a batch of chocolate chip cookies!' },
        { id: 'swap-2', author: 'Priya R.', sage: true, time: '1 hr ago', up: 3, down: 0, text: 'I’ll bring focaccia! Should we make a sign-up list so we don’t end up with ten batches of cookies?' },
      ],
    },
    sourdough: {
      author: 'Jamie L.', time: '12 hrs ago', ago: 720, likes: 8, comments: 12, answered: true,
      title: 'Is my sourdough starter meant to smell like this?',
      body: 'My starter is about a week old and it suddenly smells sharp, almost like nail polish remover. There’s a grey liquid on top too. Did I ruin it?',
      answers: [
        { id: 'sourdough-1', author: 'Dana K.', time: '10 hrs ago', up: 9, down: 0, accepted: true, text: 'You didn’t ruin it! That smell and the grey liquid (“hooch”) mean it’s hungry. Pour off the liquid, then feed it twice a day at room temperature for a few days and it will mellow out.' },
        { id: 'sourdough-2', author: 'Leo T.', time: '8 hrs ago', up: 2, down: 0, text: 'Switching to a bit of whole-wheat flour in the feedings helped mine get more active, too.' },
      ],
    },
    focaccia: {
      author: 'Priya R.', sage: true, time: '2d ago', ago: 2880, likes: 24, comments: 8,
      title: 'My first focaccia! A little wonky, a lot delicious.',
      body: 'Used the club’s Rosemary Focaccia recipe for the first time. The dimples flattened out a bit in the oven, but the crust was amazing. Any tips for next time?',
      answers: [
        { id: 'focaccia-1', author: 'Sam M.', time: '1d ago', up: 6, down: 0, text: 'Looks great! Press the dimples right before baking, all the way to the bottom of the pan, and be generous with the oil so they hold.' },
      ],
    },
  };

  /* ---- Stores ----------------------------------------------------------------------------- */
  const questions = {
    all() { const a = db.get('bfc.questions', []); return Array.isArray(a) ? a : []; },
    get(id) { return this.all().find((q) => q.id === id) || null; },
    save(q) { const l = this.all(); const i = l.findIndex((x) => x.id === q.id); if (i >= 0) l[i] = q; else l.unshift(q); db.set('bfc.questions', l); },
    remove(id) { const l = this.all(); const i = l.findIndex((x) => x.id === id); if (i < 0) return null; const [q] = l.splice(i, 1); db.set('bfc.questions', l); return { q, i }; },
    restore({ q, i }) { const l = this.all().filter((x) => x.id !== q.id); l.splice(Math.min(i, l.length), 0, q); db.set('bfc.questions', l); },
  };
  /* Migrate the single question older versions stored. */
  const legacy = db.get('bfc.question', null);
  if (legacy) { questions.save(Object.assign({ id: BFC.uid('q'), at: Date.now() }, legacy)); db.remove('bfc.question'); }
  /* A keyed list store: { [parentId]: [items] }. remove() returns what restore() needs for Undo. */
  const keyed = (key, newestFirst) => ({
    of(pid) { return db.get(key, {})[pid] || []; },
    add(pid, x) { const all = db.get(key, {}); const l = all[pid] || []; all[pid] = newestFirst ? [x].concat(l) : l.concat(x); db.set(key, all); },
    remove(pid, id) {
      const all = db.get(key, {}); const l = all[pid] || []; const i = l.findIndex((x) => x.id === id);
      if (i < 0) return null;
      const [item] = l.splice(i, 1); all[pid] = l; db.set(key, all);
      return { pid, item, i };
    },
    restore({ pid, item, i }) { const all = db.get(key, {}); const l = (all[pid] || []).filter((x) => x.id !== item.id); l.splice(Math.min(i, l.length), 0, item); all[pid] = l; db.set(key, all); },
  });
  const answers = keyed('bfc.answers', true);
  const replies = keyed('bfc.replies', false);
  const thumbs = {
    get(id) { return db.get('bfc.thumbs', {})[id] || ''; },
    set(id, v) { const all = db.get('bfc.thumbs', {}); if (v) all[id] = v; else delete all[id]; db.set('bfc.thumbs', all); },
  };
  const me = () => { const m = BFC.member(); return m ? m.name : 'You'; };
  const shortText = (t) => { const x = String(t || '').trim(); return x.length > 60 ? x.slice(0, 57).trimEnd() + '…' : x; };
  /* Number of user-posted answers + replies in a thread (added to the thread's comment count). */
  const myActivity = (threadId, staticAnswers) => {
    const mine = answers.of(threadId);
    const ids = mine.map((a) => a.id).concat((staticAnswers || []).map((a) => a.id));
    return mine.length + ids.reduce((n, id) => n + replies.of(id).length, 0);
  };

  /* ---- Delete a question (confirm, then a countdown with Undo) ---------------------------------- */
  const deleteQuestion = (q, { onDeleted, onRestored, onClose } = {}) => BFC.confirmDelete({
    noun: 'question', name: q.title, text: 'and its answers will be removed from the Forums.',
    onDelete: () => { const r = questions.remove(q.id); if (onDeleted) onDeleted(); return r; },
    onUndo: (r) => { if (r) { questions.restore(r); if (onRestored) onRestored(); BFC.toast('Question restored.'); } },
    onClose,
  });

  /* ---- Forums list -------------------------------------------------------------------------- */
  const threadsEl = $('#threads');
  if (threadsEl) {
    /* Comment counts on built-in threads include what the visitor has posted. */
    $$('[data-thread-id]', threadsEl).forEach((a) => {
      const t = THREADS[a.dataset.threadId];
      const c = $('[data-comment-count]', a);
      if (!t) return;
      const n = t.comments + myActivity(a.dataset.threadId, t.answers);
      if (c) c.textContent = String(n);
      Object.assign(a.dataset, { at: String(Date.now() - t.ago * 60000), likes: String(t.likes), comments: String(n), answered: t.answered ? 'yes' : 'no' });
    });
    /* Sort by: newest (default) / oldest / most likes / most comments */
    const sortSel = $('[data-filter-key="sort"]');
    const SORTS = {
      '': (x, y) => y.at - x.at,
      oldest: (x, y) => x.at - y.at,
      likes: (x, y) => y.likes - x.likes || y.at - x.at,
      comments: (x, y) => y.comments - x.comments || y.at - x.at,
    };
    const sortThreads = () => {
      const by = SORTS[sortSel ? sortSel.value : ''] || SORTS[''];
      const empty = $('[data-filter-empty]', threadsEl);
      $$('.thread', threadsEl)
        .map((el) => { const lc = $('[data-like-count]', el); return { el, at: +el.dataset.at || 0, likes: lc ? +lc.textContent || 0 : 0, comments: +el.dataset.comments || 0 }; })
        .sort(by)
        .forEach(({ el }) => threadsEl.insertBefore(el, empty));
    };
    if (sortSel) sortSel.addEventListener('change', sortThreads);
    threadsEl.addEventListener('click', (e) => { if (e.target.closest('[data-like]') && sortSel && sortSel.value === 'likes') setTimeout(sortThreads, 380); });
    const threadFor = (q) => {
      const a = document.createElement('article');
      a.className = 'thread';
      a.setAttribute('data-filter-item', '');
      a.dataset.questionId = q.id;
      a.dataset.likeId = 'thread-' + q.id;
      const count = myActivity(q.id, []);
      Object.assign(a.dataset, { at: String(q.at || 0), likes: '0', comments: String(count), answered: q.answered ? 'yes' : 'no' });
      a.innerHTML = `
        <div class="thread__author"><span class="avatar">${esc(q.anonymous ? 'A' : initials(q.name))}</span><span class="thread__name">${esc(q.anonymous ? 'Anonymous' : q.name)}</span><span class="thread__time">· ${esc(BFC.timeAgo(q.at))}</span><span class="thread__mine">YOUR QUESTION</span></div>
        <h2 class="thread__title">${esc(q.title)}</h2>
        <div class="thread__meta">${q.answered ? '<span class="thread__answered">ANSWERED</span>' : ''}<span>${ICON('message-circle')}${count}</span><span>${ICON('heart')}<span data-like-count>0</span></span></div>
        <div class="thread__cta"><a class="btn btn--cta" href="forum-discussion.html?q=${encodeURIComponent(q.id)}">View discussion ${ICON('arrow-right')}</a><button class="icon-btn" type="button" aria-label="Like this discussion" aria-pressed="false" data-like>${ICON('heart')}</button></div>
        <div class="thread__actions"><a class="btn-soft" href="ask-question.html?edit=${encodeURIComponent(q.id)}">${ICON('pencil')}Edit</a><button class="btn-soft btn-soft--danger" type="button" data-delete>${ICON('trash-2')}Delete</button></div>`;
      BFC.syncReactions(a);
      $('[data-delete]', a).addEventListener('click', () => deleteQuestion(q, {
        onDeleted: () => BFC.removeAnimated(a, BFC.refilter),
        onRestored: render,
      }));
      return a;
    };
    function render() {
      $$('[data-question-id]', threadsEl).forEach((x) => x.remove());
      questions.all().slice().reverse().forEach((q) => threadsEl.prepend(threadFor(q)));
      sortThreads();
      BFC.refilter();
    }
    render();
  }

  /* ---- Discussion page ---------------------------------------------------------------------- */
  const disc = $('#discussion');
  if (disc) {
    const qid = params.get('q');
    const tid = params.get('t') || (qid ? null : 'swap');
    const userQ = qid ? questions.get(qid) : null;
    const thread = userQ
      ? { id: userQ.id, author: userQ.anonymous ? 'Anonymous' : userQ.name, anon: userQ.anonymous, time: BFC.timeAgo(userQ.at), title: userQ.title, body: userQ.details, answers: [], mine: true }
      : THREADS[tid] ? Object.assign({ id: tid }, THREADS[tid]) : null;
    const gone = (title, text) => {
      disc.innerHTML = `<div class="empty-block"><h1 class="discussion__title">${esc(title)}</h1>
        <p class="lede">${esc(text)}</p>
        <a class="btn btn--lg btn--block" href="forums.html">Back to Forums</a></div>`;
    };
    if (!thread) { gone('Discussion not found', 'This question was deleted or isn’t on this device.'); return; }
    const pageHtml = disc.innerHTML;

    function setup() {
      document.title = thread.title + ' · Baking for a Cause';
      $('#d-title').textContent = thread.title;
      $('#d-avatar').textContent = thread.anon ? 'A' : initials(thread.author);
      $('#d-avatar').classList.toggle('avatar--sage', !!thread.sage);
      $('#d-name').textContent = thread.author;
      $('#d-time').textContent = '· ' + thread.time;
      $('#d-body').textContent = thread.body;
      const stats = document.createElement('div');
      stats.className = 'thread__meta discussion__stats';
      stats.dataset.likeId = 'thread-' + thread.id;
      const commentCount = (thread.comments || 0) + myActivity(thread.id, thread.answers);
      stats.innerHTML = `<span>${ICON('message-circle')}<span data-d-comments>${commentCount}</span> comments</span><span>${ICON('heart')}<span data-like-count>${thread.likes || 0}</span> likes</span>`;
      $('#d-body').after(stats);
      BFC.syncReactions(stats);
      let head = $('.focused-nav .recipe-actions');
      if (!head) {
        head = document.createElement('div');
        head.className = 'recipe-actions';
        head.innerHTML = `<button class="icon-btn icon-btn--header" type="button" aria-label="Like this discussion" aria-pressed="false" data-like>${ICON('heart')}</button>`;
        $('.focused-nav').appendChild(head);
      }
      head.dataset.likeId = 'thread-' + thread.id;
      BFC.syncReactions(head);
      const refreshCount = () => { $('[data-d-comments]', stats).textContent = String((thread.comments || 0) + myActivity(thread.id, thread.answers)); };
      disc.addEventListener('bfc:forum-change', refreshCount);

      /* Answered badge (built-in threads) or the owner's controls (your own question) */
      const owner = document.createElement('div');
      owner.className = 'discussion__owner';
      $('#d-body').after(owner);
      const drawOwner = () => {
        const q = thread.mine ? questions.get(thread.id) : null;
        const answered = q ? !!q.answered : !!thread.answered;
        owner.innerHTML = (answered ? `<p class="answered-flag">${ICON('circle-check')}Marked as answered</p>` : '')
          + (q ? `<div class="thread__actions">
              <button class="btn-soft${answered ? ' is-on' : ''}" type="button" data-answered aria-pressed="${answered}">${ICON(answered ? 'undo-2' : 'check-check')}${answered ? 'Mark as unanswered' : 'Mark as answered'}</button>
              <a class="btn-soft btn-soft--icon" href="ask-question.html?edit=${encodeURIComponent(q.id)}" aria-label="Edit question">${ICON('pencil')}</a>
              <button class="btn-soft btn-soft--danger btn-soft--icon" type="button" data-delete-question aria-label="Delete question">${ICON('trash-2')}</button>
            </div>` : '');
      };
      drawOwner();
      owner.addEventListener('click', (e) => {
        if (e.target.closest('[data-answered]')) {
          const q = questions.get(thread.id);
          if (!q) return;
          q.answered = !q.answered;
          questions.save(q);
          drawOwner();
          BFC.toast(q.answered ? 'Marked as answered. It shows as “Answered” on the Forums page.' : 'Marked as unanswered.');
          const f = $('.answered-flag', owner); if (f) { f.classList.add('is-popping'); }
        } else if (e.target.closest('[data-delete-question]')) {
          const q = questions.get(thread.id);
          if (q) deleteQuestion(q, {
            onDeleted: () => gone('Question deleted', `“${q.title}” was removed from the Forums.`),
            onRestored: () => { disc.innerHTML = pageHtml; setup(); },
          });
        }
      });

      const list = $('#answers');
      const noAnswers = $('#no-answers');
      const posted = $('#answer-posted');

      /* Up / down votes (answers and replies). One vote per item; tap again to take it back. */
      const votesHtml = (item, label) => {
        const btn = (dir) => {
          const base = dir === 'up' ? item.up || 0 : item.down || 0;
          const on = thumbs.get(item.id) === dir;
          return `<button class="thumb" type="button" aria-label="${dir === 'up' ? 'Upvote' : 'Downvote'} this ${label}" aria-pressed="${on}" data-thumb="${dir}" data-base="${base}">${ICON(dir === 'up' ? 'thumbs-up' : 'thumbs-down')}<span class="thumb__count">${base + (on ? 1 : 0)}</span></button>`;
        };
        return `<span class="votes" data-vote-id="${esc(item.id)}">${btn('up')}${btn('down')}</span>`;
      };
      const replyHtml = (r) => `<div class="reply" data-reply-id="${esc(r.id)}"><span class="reply__icon">${ICON('corner-down-right')}</span><div class="reply__body"><div class="thread__author"><span class="avatar">${esc(initials(r.author))}</span><span class="thread__name">${esc(r.author)}</span><span class="thread__time">· ${esc(BFC.timeAgo(r.at))}</span></div><p class="answer__text">${esc(r.text)}</p>
        <div class="answer__reactions answer__reactions--reply"><button class="answer__delete" type="button" data-delete-reply>${ICON('trash-2')}Delete</button>${votesHtml(r, 'reply')}</div></div></div>`;
      const answerHtml = (a, mine) => {
        const first = a.author.split(' ')[0];
        return `<div class="answer-block" data-answer-id="${esc(a.id)}">
          <article class="answer${a.accepted ? ' answer--accepted' : ''}">
            <div class="thread__author"><span class="avatar${a.sage ? ' avatar--sage' : ''}">${esc(mine ? initials(a.author === 'You' ? 'Y' : a.author) : initials(a.author))}</span><span class="thread__name">${esc(a.author)}</span><span class="thread__time">· ${esc(mine ? BFC.timeAgo(a.at) : a.time)}</span>${a.accepted ? '<span class="thread__answered">ACCEPTED ANSWER</span>' : ''}</div>
            <p class="answer__text"${mine ? ' style="color:var(--color-ink)"' : ''}>${esc(a.text)}</p>
            <div class="answer__reactions">${mine ? `<button class="answer__delete" type="button" data-delete-answer>${ICON('trash-2')}Delete</button>` : ''}${votesHtml(a, 'answer')}</div>
          </article>
          <div class="replies">${replies.of(a.id).map(replyHtml).join('')}</div>
          <form class="compose reply-form" data-reply novalidate>
            <label class="input"><input type="text" placeholder="Reply to ${esc(mine ? 'your answer' : first)}..." aria-label="Reply to ${esc(mine ? 'your answer' : first)}"><button class="compose__send" type="submit" aria-label="Send reply">${ICON('send')}</button></label>
          </form>
        </div>`;
      };
      const refreshEmpty = () => { noAnswers.hidden = answers.of(thread.id).length + thread.answers.length > 0; };
      const render = () => {
        const mine = answers.of(thread.id);
        list.innerHTML = mine.map((a) => answerHtml(a, true)).join('') + thread.answers.map((a) => answerHtml(a, false)).join('');
        refreshEmpty();
      };
      render();

      /* Post an answer */
      const form = $('#answer-form');
      const text = $('#answer-text');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = text.value.trim();
        if (!v) { text.closest('.input').classList.add('is-invalid'); text.focus(); return; }
        text.closest('.input').classList.remove('is-invalid');
        answers.add(thread.id, { id: BFC.uid('a'), author: me(), text: v, at: Date.now() });
        text.value = '';
        render();
        disc.dispatchEvent(new Event('bfc:forum-change'));
        posted.hidden = false;
        posted.classList.remove('is-entering'); void posted.offsetWidth; posted.classList.add('is-entering');
        clearTimeout(posted._t); posted._t = setTimeout(() => { posted.hidden = true; }, 3000);
      });
      text.addEventListener('input', () => text.closest('.input').classList.remove('is-invalid'));

      /* Replies, votes and deleting your own answers / replies (delegated: answers are re-rendered) */
      list.addEventListener('submit', (e) => {
        const f = e.target.closest('[data-reply]');
        if (!f) return;
        e.preventDefault();
        const input = $('input', f);
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        const block = f.closest('[data-answer-id]');
        const r = { id: BFC.uid('re'), author: me(), text: v, at: Date.now() };
        replies.add(block.dataset.answerId, r);
        $('.replies', block).insertAdjacentHTML('beforeend', replyHtml(r));
        input.value = '';
        disc.dispatchEvent(new Event('bfc:forum-change'));
      });
      list.addEventListener('click', (e) => {
        const delA = e.target.closest('[data-delete-answer]');
        if (delA) {
          const block = delA.closest('[data-answer-id]');
          const a = answers.of(thread.id).find((x) => x.id === block.dataset.answerId);
          if (!a) return;
          BFC.confirmDelete({
            noun: 'answer', name: shortText(a.text), text: 'will be removed from this discussion, along with its replies.',
            onDelete: () => { const r = answers.remove(thread.id, a.id); BFC.removeAnimated(block, refreshEmpty); disc.dispatchEvent(new Event('bfc:forum-change')); return r; },
            onUndo: (r) => { if (r) { answers.restore(r); render(); disc.dispatchEvent(new Event('bfc:forum-change')); BFC.toast('Answer restored.'); } },
          });
          return;
        }
        const delR = e.target.closest('[data-delete-reply]');
        if (delR) {
          const el = delR.closest('[data-reply-id]');
          const answerId = el.closest('[data-answer-id]').dataset.answerId;
          const r = replies.of(answerId).find((x) => x.id === el.dataset.replyId);
          if (!r) return;
          BFC.confirmDelete({
            noun: 'reply', name: shortText(r.text), text: 'will be removed from this discussion.',
            onDelete: () => { const t = replies.remove(answerId, r.id); BFC.removeAnimated(el); disc.dispatchEvent(new Event('bfc:forum-change')); return t; },
            onUndo: (t) => { if (t) { replies.restore(t); render(); disc.dispatchEvent(new Event('bfc:forum-change')); BFC.toast('Reply restored.'); } },
          });
          return;
        }
        const t = e.target.closest('[data-thumb]');
        if (!t) return;
        const box = t.closest('[data-vote-id]');
        const id = box.dataset.voteId;
        const v = thumbs.get(id) === t.dataset.thumb ? '' : t.dataset.thumb;
        thumbs.set(id, v);
        $$('[data-thumb]', box).forEach((b) => {
          const on = b.dataset.thumb === v;
          b.setAttribute('aria-pressed', String(on));
          $('.thumb__count', b).textContent = String(Number(b.dataset.base) + (on ? 1 : 0));
          if (on) { b.classList.remove('is-popping'); void b.offsetWidth; b.classList.add('is-popping'); }
        });
      });
    }
    setup();
  }

  /* ---- Ask a Question / Edit your question --------------------------------------------------- */
  const ask = $('#ask-form');
  if (ask) {
    const err = $('#ask-error');
    const name = $('#q-name'), anon = $('#q-anon'), title = $('#q-title'), details = $('#q-details');
    const editing = params.get('edit') ? questions.get(params.get('edit')) : null;
    const member = BFC.member();
    if (editing) {
      name.value = editing.name || ''; anon.checked = !!editing.anonymous; name.disabled = anon.checked;
      title.value = editing.title; details.value = editing.details;
      $('#ask-title').textContent = 'Edit Question';
      $('#ask-submit').lastChild.textContent = 'Save changes';
      document.title = 'Edit Question · Baking for a Cause';
    } else if (member) name.value = member.name;
    const mark = (el, bad) => { (el.closest('.input') || el).classList.toggle('is-invalid', bad); };
    anon.addEventListener('change', () => { name.disabled = anon.checked; mark(name, false); });
    ask.addEventListener('input', (e) => { mark(e.target, false); if (!$$('.is-invalid', ask).length) err.hidden = true; });
    ask.addEventListener('submit', (e) => {
      e.preventDefault();
      const checks = [[name, anon.checked || name.value.trim()], [title, title.value.trim()], [details, details.value.trim()]];
      checks.forEach(([el, ok]) => mark(el, !ok));
      const bad = checks.find(([, ok]) => !ok);
      if (bad) { err.hidden = false; bad[0].focus(); return; }
      const q = Object.assign({}, editing || { id: BFC.uid('q'), at: Date.now() },
        { name: name.value.trim(), anonymous: anon.checked, title: title.value.trim(), details: details.value.trim() });
      if (editing) q.editedAt = Date.now();
      questions.save(q);
      if (!editing) BFC.notify({ icon: 'message-circle', title: 'Question posted', text: q.title, href: 'forum-discussion.html?q=' + encodeURIComponent(q.id) });
      err.hidden = true;
      $('#ask-fields').hidden = true;
      $('#ask-nav').hidden = true;
      $('#ask-title').hidden = true;
      $('#ask-done').hidden = false;
      if (editing) {
        $('#ask-done .success__title').textContent = 'Question Updated!';
        $('#ask-done .success__text').textContent = 'Your changes are now on the Forums page.';
      }
      $('#done-avatar').textContent = q.anonymous ? 'A' : initials(q.name);
      $('#done-name').textContent = q.anonymous ? 'Anonymous' : q.name;
      $('#done-q').textContent = q.title;
      $('#done-view').href = 'forum-discussion.html?q=' + encodeURIComponent(q.id);
      $('.screen-body', ask).scrollTop = 0;
    });
  }
})();
