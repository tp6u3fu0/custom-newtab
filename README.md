# Custom New Tab

A minimal, modular Chrome / Brave new tab extension. Every module is draggable, resizable, and individually toggleable — build your own layout.

![manifest version](https://img.shields.io/badge/manifest-v3-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

## Modules

| Module | Description |
|--------|-------------|
| 🕐 Clock | Time and date display with 12 / 24-hour format |
| 🌤 Weather | Current conditions and hourly / daily forecast via Open-Meteo |
| 🔍 Search | Quick search bar |
| 🔗 Links | Customizable bookmarks |
| 🏎 F1 | Next race countdown, weekend schedule, circuit map, and driver / team standings |
| 💻 LeetCode | Daily solved-problem streak and statistics |

---

## Features

- **Drag & resize** — freely arrange modules on a snap grid
- **Multiple sizes** — each module adapts its layout to 1×1, 2×1, 3×1, 2×2, 3×2, etc.
- **Module toggles** — enable or disable individual modules from settings
- **Theming** — light / dark / system, three visual styles, custom background (solid color, gradient, or image)
- **No account required** — all data stored locally in `localStorage` / `chrome.storage`

---

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual (Developer Mode)

1. Clone or download this repository
   ```bash
   git clone https://github.com/tp6u3fu0/custom-newtab.git
   ```
2. Open Chrome / Brave and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the cloned folder
5. Open a new tab

---

## Tech Stack

- Vanilla JS (ES Modules, no build step)
- Chrome Extension Manifest V3
- CSS custom properties for theming
- APIs: [Open-Meteo](https://open-meteo.com), [Ergast via jolpi.ca](https://api.jolpi.ca), [flagcdn.com](https://flagcdn.com), LeetCode GraphQL

---

## Adding a Module

Each module follows the same pattern:

1. **Create** `modules/your-module.js` and export an `initYourModule(settings)` function
2. **Add a template** `<template id="tpl-your-module">` in `newtab.html`
3. **Register** a default position and size in `DEFAULT_POSITIONS` / `DEFAULT_SIZES` in `newtab.js`
4. **Call** `initYourModule` from `initModuleContent()` in `newtab.js`
5. **Add CSS** size variants using `[data-size="NxM"]` selectors in `newtab.css`
6. *(Optional)* Add settings controls to `settings.html` / `settings.js`

A full contributing guide is coming soon.

---

## Privacy

This extension does not collect or transmit any personal data to the developer.
See the full [Privacy Policy](https://tp6u3fu0.github.io/custom-newtab/privacy).

---

## License

MIT
