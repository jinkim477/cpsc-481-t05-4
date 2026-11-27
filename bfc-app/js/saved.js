/* Baking for a Cause – Saved Recipes page: renders every recipe whose bookmark is on (built-in or the visitor's own). */
(function () {
  'use strict';
  const list = document.getElementById('saved-list');
  if (!list) return;
  const BFC = window.BFC;
  const emptyNote = list.querySelector('[data-saved-empty]');
  const guestNote = document.getElementById('saved-guest-note');
  if (guestNote) guestNote.hidden = !BFC.isGuest();

  const cards = () => Array.from(list.querySelectorAll('[data-recipe-id]'));
  const refreshEmpty = () => { emptyNote.hidden = cards().length > 0; BFC.refilter(); };
  const cardFor = (id) => { const d = BFC.recipeData(id); return d ? BFC.recipeCard(d) : null; };

  /* Rebuild the list in saved order (newest first). Recipes that no longer exist are skipped. */
  function render() {
    cards().forEach((c) => c.remove());
    BFC.saved.ids().forEach((id) => {
      const card = cardFor(id);
      if (card) list.insertBefore(card, emptyNote);
    });
    refreshEmpty();
  }
  render();

  /* Un-saving removes the card (with Undo in the toast); Undo puts it back in place. */
  document.addEventListener('bfc:saved-change', (e) => {
    if (e.detail.on) { render(); return; }
    const card = cards().find((c) => c.dataset.recipeId === e.detail.id);
    if (card) BFC.removeAnimated(card, refreshEmpty);
  });
})();
