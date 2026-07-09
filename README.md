# ScriptSentry

A Manifest V3 Chrome extension that passively monitors every JavaScript resource a page loads, classifies each one as first-party or third-party, and gives you a searchable, exportable list — per tab, in real time.

Built for recon: point it at a target, let it run, pull every `.js` URL it saw. Feeds directly into source-map / endpoint extraction workflows (e.g. JS URL Mapper → Secret Hunter handoff).

---

## Features

- **Real-time capture** — hooks `PerformanceObserver` at `document_start`, so it catches scripts loaded before and after the content script attaches
- **Per-tab isolation** — each tab gets its own URL set in `chrome.storage.local`, keyed by tab ID
- **First-party / third-party classification** — compares script hostname against the tab's hostname (exact match or subdomain relationship)
- **Live badge counter** — extension icon shows the running count of unique scripts detected on the active tab
- **Auto-reset on navigation** — tab data clears automatically on reload or navigation to a new URL, so results never carry over between pages
- **Popup dashboard**
  - Total script count + unique domain count
  - Live search/filter across captured URLs
  - Copy single URL, copy all, or download the full list as `.txt`
  - One-click open of any captured script in a new tab
- **Zero network calls** — everything stays in `chrome.storage.local`; nothing is sent off-device

---

## How it works

```
┌─────────────────────────┐        chrome.runtime         ┌──────────────────────────┐
│  content-scripts/        │  ────  sendMessage  ────────▶ │  background.js           │
│  scriptsentry-content.js │        { action:'addJsUrls',  │  (service worker)         │
│                          │          urls: [...] }         │                          │
│  • PerformanceObserver    │                                │  • dedupes per tab       │
│  • getEntriesByType()     │                                │  • writes storage.local  │
│  • filters *.js / script  │                                │  • updates badge count   │
│    initiatorType          │                                │  • clears on navigation  │
└─────────────────────────┘                                └────────────┬─────────────┘
                                                                          │
                                                                          │ chrome.storage.local
                                                                          ▼
                                                              ┌──────────────────────────┐
                                                              │  popup/popup.js          │
                                                              │  • reads tab_{id} record  │
                                                              │  • renders URL cards      │
                                                              │  • search / copy /        │
                                                              │    download / clear       │
                                                              └──────────────────────────┘
```

1. **Detection** (`content-scripts/scriptsentry-content.js`) runs at `document_start` in every frame. It reads `performance.getEntriesByType('resource')` for anything already loaded, then keeps a `PerformanceObserver` running to catch scripts loaded afterward. A resource counts as a script if its path ends in `.js` or Chrome tags it with `initiatorType: 'script'`. A local `Set` prevents the same URL from being reported twice from within one page session.

2. **Aggregation** (`background.js`) is the single source of truth. It receives `addJsUrls` messages, merges new URLs into a per-tab record in `chrome.storage.local` (keyed `tab_{tabId}`), and updates the toolbar badge with the running total. On `chrome.tabs.onUpdated` with `status: 'loading'` and a new URL, it wipes that tab's record — so a reload or navigation always starts clean. On tab close, the record is deleted entirely.

3. **Presentation** (`popup/`) reads the current tab's record on open, classifies each URL as first- or third-party against the tab's own hostname, and renders it as a card with copy/open actions. The search box filters client-side against the rendered cards; Copy All and Download operate on the full in-memory URL list regardless of the current filter.

---

## Project structure

```
scriptsentry/
├── manifest.json                       # MV3 manifest — permissions, entry points
├── background.js                       # Service worker: aggregation, badge, lifecycle
├── content-scripts/
│   └── scriptsentry-content.js         # Injected at document_start on <all_urls>
├── popup/
│   ├── popup.html                      # Popup markup
│   ├── popup.css                       # Popup styling (neon blue/purple theme)
│   └── popup.js                        # Popup controller: render, filter, export
├── assets/
│   ├── icons/
│   │   ├── icon.png                    # Toolbar / store icon (raster)
│   │   └── icon.svg                    # Source vector icon
│   └── fonts/
│       └── consolas.ttf                # Monospace font for URL display
└── README.md
```

> This layout is a reorganization of the flat file set the extension was built from. `manifest.json`'s `content_scripts`, `action.default_popup`, and `icons` paths, along with `popup.css`'s `@font-face` `src`, have been updated to match — load `scriptsentry/` as the unpacked extension root.

---

## Installation (unpacked / developer mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `scriptsentry/` folder
5. Pin the extension from the toolbar overflow menu for quick access

---

## Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Persists per-tab script URLs in `chrome.storage.local` |
| `activeTab` | Reads the active tab's URL/title when the popup opens |
| `<all_urls>` (content script match) | Required to observe script loads on any page you're actively recon'ing |

No `host_permissions` for network access, no remote code, no analytics. All processing is local to the browser.

---

## Known limitations

- **In-memory dedup resets per page load** — the `sentUrls` Set in the content script is scoped to a single page context; a full navigation (not a SPA route change) naturally clears it, which is intended.
- **SPA route changes without a real navigation** won't trigger `chrome.tabs.onUpdated`'s `loading` state, so scripts loaded via client-side routing accumulate onto the existing tab record rather than resetting — usually desirable for recon, worth knowing if you expect a hard reset per view.
- **`.js`-extension matching is path-based**, so a script served without a `.js` extension is only caught via `initiatorType: 'script'`; some CDN/proxy-obscured script URLs may need manual review.
- **Manifest `description` field currently reads "Exfiltrates and monitors..."** — recommend changing to something like *"Monitors and catalogs JavaScript resources loaded by the active tab, entirely on-device"* before any Chrome Web Store submission; "exfiltrates" reads as malware behavior to automated review and to any security-conscious user reading the listing, even though the extension makes no network calls.

---

## Roadmap ideas

- JSON export (in addition to `.txt`) to standardize handoff into downstream tooling
- Optional source-map detection/flagging for scripts serving a `.map` sibling
- Regex/glob-based filtering in addition to substring search
- Session-level (cross-tab) aggregate view
