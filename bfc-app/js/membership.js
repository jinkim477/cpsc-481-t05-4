/* Baking for a Cause – Login, Registration status, Club Membership and Event Registration flows. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const BFC = window.BFC;
  const store = {
    get() { return BFC.member(); },
    set(m) { BFC.db.set('bfc.member', m); },
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

  /* ---- Once someone has joined: hide sign-up prompts and fill in their profile -------------- */
  const member = store.get();
  if (member) {
    $$('.page-intro a[href^="membership.html"]').forEach((a) => a.remove());
    const profile = $('.profile-card');
    if (profile) {
      const initials = (member.name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
      const avatar = $('.profile-card__avatar', profile);
      avatar.textContent = initials || '?';
      avatar.classList.add('profile-card__avatar--initials');
      avatar.setAttribute('aria-label', 'Profile picture: ' + member.name);
      $('.profile-card__value', profile).textContent = member.name;
      const role = $('.role-card');
      $('.role-card__name', role).textContent = 'Club member';
      $('.role-card__text', role).textContent = 'Thanks for baking for a cause! Your membership is active.';
      $$('a[href^="membership.html"]', role).forEach((a) => a.remove());
    }
  }

  /* ---- Profile: what this visitor has saved, shared and signed up for ------------------------- */
  const activity = $('#activity');
  if (activity) {
    const ICON = BFC.icon, esc = BFC.esc;
    const signups = BFC.signups.all();
    const row = (icon, label, value, href) => `<a class="activity-row" href="${href}"><span class="activity-row__icon">${ICON(icon)}</span><span class="activity-row__label">${label}</span><span class="activity-row__value">${value}</span>${ICON('arrow-right')}</a>`;
    const savedCount = BFC.saved.ids().filter((id) => BFC.recipeData(id)).length;
    const events = Object.keys(signups).filter((id) => BFC.events[id]).map((id) => {
      const ev = BFC.events[id];
      return `<li class="activity-item"><span class="activity-row__icon">${ICON(ev.kind === 'event' ? 'calendar' : 'briefcase')}</span><span><strong>${esc(ev.title)}</strong><br>${ev.kind === 'event' ? 'Registered' : 'Applied'} · ${esc(ev.when)}</span></li>`;
    }).join('');
    activity.innerHTML = `<p class="field-label">Your activity</p>
      <div class="activity-rows">
        ${row('bookmark', 'Saved recipes', savedCount, 'saved-recipes.html')}
        ${row('book', 'Recipes shared', BFC.recipes.all().length, 'recipes.html')}
        ${row('message-circle', 'Questions asked', BFC.db.get('bfc.questions', []).length, 'forums.html')}
      </div>
      ${events ? `<p class="field-label">Events &amp; applications</p><ul class="activity-list">${events}</ul>` : ''}
      ${BFC.isGuest() ? `<p class="note note--guest"><span>You’re browsing as a guest, so all of this is stored on this device only. <a href="membership.html?from=profile">Sign up or log in</a> to keep it.</span></p>` : ''}`;
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
  /* Membership always has a payment step; event registration does too for non-members (CA$5.00). */
  const paid = flow === 'membership' || (flow === 'event' && !member);
  const FEE = flow === 'membership' ? 'CA$15.00' : 'CA$5.00';

  /* Already registered / applied: show that instead of letting the form be submitted twice. */
  const signupId = form.dataset.signup;
  if (signupId && BFC.signups.has(signupId)) {
    const note = $('#already-note');
    if (note) note.hidden = false;
    $$('input, textarea, button[type=submit]', form).forEach((el) => { el.disabled = true; });
  }
  /* Guests: what they submit is stored on this device. */
  const guestNote = $('#done-guest-note');
  if (guestNote) guestNote.hidden = !BFC.isGuest();

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
    if (paid) {
      const details = flow === 'membership' ? 'Member details' : 'Registration details';
      $('#step-label').textContent = n === 1 ? `Step 1 of 2 · ${details}` : 'Step 2 of 2 · Payment';
      $('#progress-bar').style.width = n === 1 ? '51.75%' : '100%';
      $('#progress-bar').parentElement.setAttribute('aria-valuenow', String(n));
      $('#nav-next').textContent = n === 1 ? 'Next: Payment' : 'Your card is only charged once you pay.';
      $('#btn-next span').textContent = n === 1 ? 'Continue' : 'Pay ' + FEE;
    }
    clearErr();
    body.scrollTop = 0;
  }

  function finish() {
    const name = val('#f-name'), email = val('#f-email'), diet = $('#f-diet') ? val('#f-diet') : '';
    if (flow === 'membership') {
      store.set({ name, email, diet, joinedAt: Date.now() });
      BFC.notify({ icon: 'users', title: 'Welcome to the club, ' + firstName(name) + '!', text: 'Your Baking for a Cause membership is active.', href: 'profile.html' });
      if (guestNote) guestNote.hidden = true;
    }
    const payEl = $('#s-pay');
    if (payEl) payEl.textContent = paid ? (method === 'apple' ? 'Apple Pay' : 'Card ending in ' + num.value.replace(/\s/g, '').slice(-4)) : 'Free for club members';
    const amountRow = $('#s-amount-row');
    if (amountRow) amountRow.hidden = !paid;
    $('#s-first').textContent = firstName(name);
    $('#s-name').textContent = name;
    $('#s-email').textContent = email;
    const inline = $('#s-email-inline'); if (inline) inline.textContent = email;
    if ($('#s-diet')) $('#s-diet').textContent = diet || 'None provided';
    if (flow !== 'membership') {
      BFC.signups.add(signupId || flow); /* also adds a notification; guests see the device-storage note on the success screen */
    }
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
    if (paid && step === 1) return goto(2);
    finish();
  });
  /* Event registration: members skip payment, so it is a single "Register" step. */
  if (flow === 'event') {
    if (paid) { $('#fee-note').hidden = false; goto(1); }
    else {
      $('#nav-next').hidden = true;
      $('#btn-back').hidden = true;
      $('#form-nav').classList.add('form-nav--single');
    }
  }
  const back = $('#btn-back');
  if (back) back.addEventListener('click', () => { if (step === 1) { const exit = $('.exit-action'); location.href = exit ? exit.href : 'registration.html'; } else goto(step - 1); });
})();
