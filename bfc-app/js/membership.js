/* Baking for a Cause – Login, Registration status, Club Membership and Event Registration flows. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const KEY = 'bfc.member';
  const memory = {};
  const store = {
    get() { try { const v = localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch (e) { /* ignore */ } return memory.m || null; },
    set(m) { memory.m = m; try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* ignore */ } },
  };
  const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';

  /* ---- Login: only "Continue as guest" is available in this prototype ----------------------- */
  const signIn = $('#sign-in');
  if (signIn) signIn.addEventListener('click', () => { $('#login-msg').hidden = false; });

  /* ---- Registration page: show membership status once someone has joined ------------------- */
  const reg = $('#registration');
  if (reg) {
    const m = store.get();
    if (m) {
      $$('[data-member]', reg).forEach((e) => { e.hidden = false; });
      $$('[data-guest]', reg).forEach((e) => { e.hidden = true; });
      reg.classList.add('is-member');
      $('#m-first').textContent = firstName(m.name);
      $('#m-email').textContent = m.email;
    }
  }

  /* ---- Shared step form (membership + event registration) ------------------------------------- */
  const form = $('#member-form') || $('#event-form') || $('#apply-form');
  if (!form) return;
  const flow = form.dataset.flow;
  const body = $('.screen-body', form);
  const errNote = $('#step-error');
  const errText = $('span', errNote);
  const panels = $$('[data-step]', form);
  const val = (id) => $(id).value.trim();
  let step = 1;
  let method = '';

  const mark = (el, bad) => { (el.closest('.input') || el).classList.toggle('is-invalid', bad); };
  const showErr = (msg) => { errText.textContent = msg || 'Please fill in all required fields before continuing.'; errNote.hidden = false; };
  const clearErr = () => { errNote.hidden = true; $$('.is-invalid', form).forEach((e) => e.classList.remove('is-invalid')); };

  /* Prefill from an existing membership (event registration) */
  const saved = store.get();
  if (flow !== 'membership' && saved) {
    $('#f-name').value = saved.name; $('#f-email').value = saved.email;
    if (flow === 'event' && saved.diet) $('#f-diet').value = saved.diet;
  }

  form.addEventListener('input', (e) => {
    mark(e.target, false);
    if (!$$('.is-invalid', form).length) errNote.hidden = true;
  });
  $$('label.input', form).forEach((l) => l.addEventListener('click', () => { const i = $('input, textarea', l); if (i) i.focus(); }));

  /* Card input formatting */
  const num = $('#p-number');
  if (num) num.addEventListener('input', () => { num.value = num.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); });
  const exp = $('#p-exp');
  if (exp) exp.addEventListener('input', () => {
    const d = exp.value.replace(/\D/g, '').slice(0, 4);
    exp.value = d.length > 2 ? d.slice(0, 2) + ' / ' + d.slice(2) : d;
  });
  const cvc = $('#p-cvc');
  if (cvc) cvc.addEventListener('input', () => { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });

  /* Payment method chips */
  $$('[data-method]', form).forEach((c) => c.addEventListener('click', () => {
    method = c.dataset.method;
    $$('[data-method]', form).forEach((o) => o.setAttribute('aria-pressed', String(o === c)));
    $('#card-fields').hidden = method === 'apple';
    $('.chip-group', form).classList.remove('is-invalid');
    if (!$$('.is-invalid', form).length) errNote.hidden = true;
  }));

  function validate() {
    clearErr();
    if (step === 1) {
      const name = $('#f-name'), email = $('#f-email');
      const bad = [];
      if (!name.value.trim()) bad.push(name);
      if (!email.value.trim()) bad.push(email);
      if (flow === 'apply' && !$('#f-avail').value.trim()) bad.push($('#f-avail'));
      bad.forEach((el) => mark(el, true));
      if (bad.length) { showErr(); bad[0].focus(); return false; }
      if (!/^[^\s@]+@([a-z0-9-]+\.)*ucalgary\.ca$/i.test(email.value.trim())) {
        mark(email, true); showErr('Please use your @ucalgary.ca student email.'); email.focus(); return false;
      }
    }
    if (step === 2) {
      if (!method) { showErr('Please choose a payment method.'); $('.chip-group', form).classList.add('is-invalid'); return false; }
      if (method === 'card') {
        const digits = num.value.replace(/\s/g, '');
        const m = /^(\d{2}) \/ (\d{2})$/.exec(exp.value);
        const now = new Date();
        const expOk = m && +m[1] >= 1 && +m[1] <= 12 && (2000 + +m[2]) * 12 + +m[1] >= now.getFullYear() * 12 + now.getMonth() + 1;
        const checks = [[$('#p-name'), $('#p-name').value.trim()], [num, digits.length >= 13], [exp, expOk], [cvc, /^\d{3,4}$/.test(cvc.value)]];
        checks.forEach(([el, ok]) => mark(el, !ok));
        const bad = checks.find(([, ok]) => !ok);
        if (bad) {
          const empty = checks.some(([el]) => !el.value.trim());
          showErr(empty ? 'Please fill in all required fields before continuing.' : 'Please check your card details.');
          bad[0].focus(); return false;
        }
      }
    }
    return true;
  }

  function goto(n) {
    step = n;
    panels.forEach((p) => { p.hidden = p.dataset.step !== String(n); });
    if (flow === 'membership') {
      $('#step-label').textContent = n === 1 ? 'Step 1 of 2 · Member details' : 'Step 2 of 2 · Payment';
      $('#progress-bar').style.width = n === 1 ? '51.75%' : '100%';
      $('#progress-bar').parentElement.setAttribute('aria-valuenow', String(n));
      $('#nav-next').textContent = n === 1 ? 'Next: Payment' : 'Your card is only charged once you pay.';
      $('#btn-next span').textContent = n === 1 ? 'Continue' : 'Pay CA$15.00';
    }
    clearErr();
    body.scrollTop = 0;
  }

  function finish() {
    const name = val('#f-name'), email = val('#f-email'), diet = $('#f-diet') ? val('#f-diet') : '';
    if (flow === 'membership') {
      store.set({ name, email, diet });
      $('#s-pay').textContent = method === 'apple' ? 'Apple Pay' : 'Card ending in ' + num.value.replace(/\s/g, '').slice(-4);
    }
    $('#s-first').textContent = firstName(name);
    $('#s-name').textContent = name;
    $('#s-email').textContent = email;
    const inline = $('#s-email-inline'); if (inline) inline.textContent = email;
    if ($('#s-diet')) $('#s-diet').textContent = diet || 'None provided';
    if (flow === 'apply') {
      $('#s-avail').textContent = val('#f-avail');
      $('#s-exp').textContent = val('#f-exp') || 'None provided';
    }
    $('.flow-intro', form).hidden = true;
    errNote.hidden = true;
    panels.forEach((p) => { p.hidden = p.dataset.step !== 'done'; });
    $('#form-nav').hidden = true;
    body.scrollTop = 0;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (flow === 'membership' && step === 1) return goto(2);
    finish();
  });
  const back = $('#btn-back');
  if (back) back.addEventListener('click', () => { if (step === 1) location.href = 'registration.html'; else goto(step - 1); });
})();
