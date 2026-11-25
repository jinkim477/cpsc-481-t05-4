/* Baking for a Cause – Saved Recipes page: renders every recipe whose bookmark is on. */
(function () {
  'use strict';
  const list = document.getElementById('saved-list');
  if (!list) return;
  const BFC = window.BFC;
  const emptyNote = list.querySelector('[data-saved-empty]');

  /* The built-in recipes. (The recipe a visitor shares is built by forms.js: BFC.sharedCard.) */
  const CATALOG = {
    focaccia: {
      id: 'focaccia', title: 'Rosemary Focaccia', tags: ['Beginner', '40 min', 'Bread', 'Vegan'],
      text: 'Golden and loaded with flavour, this classic Italian focaccia features a crisp, olive-oil-infused crust and a soft center.',
      likes: 28, photo: 'assets/photos/recipe-rosemary-focaccia.png', alt: 'Sliced rosemary focaccia on a linen cloth',
      href: 'recipe-rosemary-focaccia.html', difficulty: 'beginner', minutes: 40, dish: 'bread',
    },
    'brown-butter': {
      id: 'brown-butter', title: 'Brown Butter Cookies', tags: ['Intermediate', '35 min', 'Dessert', 'Italian'],
      text: 'Rich brown butter takes these classic chocolate chip cookies to a whole new level.',
      likes: 18, photo: 'assets/photos/recipe-brown-butter-cookies.png', alt: 'Brown butter chocolate chip cookies on parchment',
      href: 'recipe-brown-butter-cookies.html', difficulty: 'intermediate', minutes: 35, dish: 'dessert',
    },
  };

  const cardFor = (id) => {
    if (id === 'shared') return BFC.sharedCard ? BFC.sharedCard() : null;
    return CATALOG[id] ? BFC.recipeCard(Object.assign({ saved: true }, CATALOG[id])) : null;
  };
  const refreshEmpty = () => { emptyNote.hidden = !!list.querySelector('[data-filter-item]'); };

  BFC.saved.ids().forEach((id) => {
    const card = cardFor(id);
    if (!card) return; /* e.g. a shared recipe that no longer exists */
    card.querySelector('[data-save]').setAttribute('aria-pressed', 'true');
    list.insertBefore(card, emptyNote);
  });
  refreshEmpty();

  /* Un-saving removes the card from this page right away. */
  document.addEventListener('bfc:saved-change', (e) => {
    if (e.detail.on) return;
    e.detail.card.remove();
    refreshEmpty();
  });
})();
