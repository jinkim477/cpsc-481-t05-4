# Baking for a Cause – HTML/CSS prototype

Plain HTML, CSS and a little JavaScript for the **Guest User Screens** of the BfC Figma file. No build step, no dependencies: open `index.html` (screen list) or `login.html` (the real first screen) in a browser, or serve the folder with any static server.

```
index.html            list of every screen
*.html                one file per screen (login, announcements, recipes, forums, ...)
css/styles.css        the single stylesheet; design tokens are the CSS variables at the top
js/app.js             menus, notifications, likes/saves, search + filters
js/forms.js           Share Recipe flow, recipe preview and "view shared recipe"
js/forums.js          Ask a Question, discussion answers, delete/undo
js/membership.js      login message, registration status, membership + event flows
assets/fonts          Lora and Inter, self-hosted (no network needed)
assets/photos         photos exported from Figma
```

## How the screens behave
- Each page is a 390 × 844 phone frame, centred on desktop. At 430 px wide or less it fills the screen and the fake status bar is hidden.
- Figma's clicked, filled, error and success states are live behaviour, not separate pages: validation notes, the difficulty dropdown, chip selection, add/remove/drag-to-reorder ingredients and steps, photo upload, payment method selection, likes and saves, filters, "Question Deleted / Undo", and so on.
- What you create (a shared recipe, a question, a membership) is stored in the browser's `localStorage` and appears on the Recipes, Forums and Registration pages. Nothing is sent anywhere. Card details are checked in the page and only the last four digits are kept for the confirmation screen.

## Known differences from Figma
- Icons are [Lucide](https://lucide.dev) (inlined SVG), a close match for the icons in the design.
- Photos were exported at 1x, so they look a little soft on high-density screens. Replace the files in `assets/photos/` with full-size originals from Figma (same file names) for crisp images.
- The prototype is guest-only: "Sign in" shows the message from the design.
- Edit on your own forum question, and reply boxes, show "Under development!" (the design uses that note for unbuilt features). The Event Registration confirmation screen was not in the frames we read, so it follows the membership confirmation.
- The on-screen keyboard frames were not rebuilt (real devices bring their own keyboard).
- "Club Member Screens" and "Club Executive Screens" pages were empty in Figma and are not included.
- The header and bottom navigation are repeated in each page's HTML, so changing them means editing every page.
