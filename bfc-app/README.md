# Baking for a Cause – HTML/CSS prototype

Plain HTML, CSS and a little JavaScript for the **Guest User Screens** of the BfC Figma file. No build step, no dependencies: open `index.html` (screen list) or `login.html` (the real first screen) in a browser, or serve the folder with any static server.

```
index.html            list of every screen
*.html                one file per screen (login, announcements, recipes, forums, ...)
css/styles.css        the single stylesheet; design tokens are the CSS variables at the top
js/icons.js           inline Lucide icons shared by every page
js/recipes-data.js    the club's built-in recipes (24+): add or edit recipes here
js/app.js             app core: storage, recipe/save/like/sign-up stores, toasts, notifications,
                      menus, dropdowns, search + filters (Clear filters), delete confirmation,
                      full-screen photo viewer, return pages, page transitions
js/forms.js           Share / Edit Recipe flow, recipe pages (recipe.html?id=…), your recipes on Recipes
js/forums.js          threads, discussions (answers, replies, votes, answered), Ask / Edit / Delete a question
js/saved.js           Saved Recipes page
js/membership.js      login message, registration status, membership, event + job-application flows
assets/fonts          Lora and Inter, self-hosted (no network needed)
assets/photos         photos exported from Figma; assets/photos/recipes/ holds illustrated recipe photos
```

## How the screens behave
- Each page is a 390 × 844 phone frame, centred on desktop. At 430 px wide or less it fills the screen and the fake status bar is hidden.
- Figma's clicked, filled, error and success states are live behaviour, not separate pages: validation notes, the difficulty dropdown, chip selection, add/remove/drag-to-reorder ingredients and steps, photo upload, payment method selection, likes and saves, filters, and so on.
- Deleting anything you posted (recipe, question, answer, reply) asks first. After you confirm, the dialog stays open with an 8-second countdown: Undo restores it, Done closes the dialog straight away.
- Tap any recipe photo to view it full screen; swipe, drag or use the arrows (or arrow keys) to move between photos.
- Guests can do everything a real user can: share, edit and delete recipes; save and like recipes and posts; ask, edit and delete questions; answer, reply and vote in discussions; register for events and apply for jobs. All of it persists and shows up across pages, in the notifications panel and on the profile ("Your activity").
- Guest data is stored on this device only (`localStorage`; if the browser blocks that, `sessionStorage`, then the tab itself). Guests are told so when they save a recipe or complete a registration/application, with a link to sign up. Nothing is sent anywhere. Card details are checked in the page and only the last four digits are kept for the confirmation screen.
- Pages fade in, lists rise in, menus and popups grow from their buttons, toasts slide up, and buttons respond to presses. Everything respects the system "reduce motion" setting.
- To start over, clear this site's data in the browser.

## Known differences from Figma
- Icons are [Lucide](https://lucide.dev) (inlined SVG), a close match for the icons in the design.
- Most built-in recipes use simple illustrations (`assets/photos/recipes/`) instead of photos. Drop real photos in with the same names, or change `photos` in `js/recipes-data.js`.
- Photos were exported at 1x, so they look a little soft on high-density screens. Replace the files in `assets/photos/` with full-size originals from Figma (same file names) for crisp images.
- The prototype is guest-only: "Sign in" shows the message from the design.
- Comments on announcements show "Under development!" (out of scope). The Event Registration confirmation screen was not in the frames we read, so it follows the membership confirmation.
- The on-screen keyboard frames were not rebuilt (real devices bring their own keyboard).
- "Club Member Screens" and "Club Executive Screens" pages were empty in Figma and are not included.
- The header and bottom navigation are repeated in each page's HTML, so changing them means editing every page.
