# DC Service Worker Prefetcher

**Version:** 1.3.8  
**Requires WordPress:** 6.8+  
**Requires PHP:** 8.0+  
**WooCommerce tested up to:** 10.4.3  
**License:** GPLv2 or later

Partytown service worker + consent-aware third-party script management + viewport/pagination prefetching for WooCommerce. Fully vendored — no npm required.

---

## What it does

1. **Partytown Web Worker execution** — unlike `async`/`defer` which only delay loading (scripts still run on the main thread after download), Partytown executes third-party scripts entirely in a Web Worker. The browser main thread is freed from analytics and ad code — no layout jank, no TBT impact, no competition with user interactions. Officially tested compatible services: **Google Tag Manager**, **Facebook Pixel**, **HubSpot**, **Intercom**, **Klaviyo**, **TikTok Pixel**, **Mixpanel** ([full list](https://partytown.qwik.dev/common-services/)). Scripts are consent-gated: output as `type="text/partytown"` when consent is present, `type="text/plain"` (browser-blocked) when it is not.

2. **Viewport/pagination prefetching** — `IntersectionObserver` watches visible WooCommerce products and issues `<link rel="prefetch">` before the user clicks. The next-page link is also prefetched 2 s after page load.

3. **Bonus performance** — WP emoji removal (saves ~76 KB + one DNS lookup), PHP fallback cache headers when W3 Total Cache is absent.

---

## Supported consent plugins

| Plugin | Cookie read |
|---|---|
| Complianz | `cmplz_marketing = allow` |
| Cookiebot (Cybot) | `CookieConsent` contains `marketing:true` |
| CookieYes | `cookieyes-consent` contains `marketing:yes` |
| Borlabs Cookie | `borlabs-cookie` JSON `.consents.marketing` |
| Cookie Notice (dFactory) | `cookie_notice_accepted = true` |
| WebToffee GDPR | `cookie_cat_marketing = accept` |
| Cookie Information | `CookieInformationConsent` JSON consents array |
| Moove GDPR | `moove_gdpr_popup` JSON `.thirdparty = 1` |

If no supported CMP cookie is found, scripts remain `type="text/plain"` — safe default.

---

## Architecture

```
Page request (PHP)
  └─ dc_swp_has_marketing_consent()   ← reads CMP cookies
       ├─ consent present  → type="text/partytown"  → Partytown SW runs it off-thread
       └─ no consent       → type="text/plain"      → browser ignores it
```

```
Layer                    Handled by
───────────────────────  ──────────────────────────────────
Third-party scripts      Partytown service worker
HTML page caching        W3 Total Cache (or PHP fallback)
Product/page prefetch    DC Prefetch (IntersectionObserver)
```

---

## Key features

- **No npm / no build step** — Partytown lib files are vendored in `assets/partytown/`
- **Auto-detect** — one-click scan in admin discovers external scripts on your homepage
- **Pattern-based** — enter one URL pattern per line; full URLs and partial patterns both work
- **Exclusion list** — built-in exclusions for Trustpilot, Stripe, PayPal, Braintree, Facebook SDK, Google Maps, and Reamaze; add your own
- **Bot-safe** — bots receive no Partytown JS (clean HTML for crawlers)
- **Cart/checkout safe** — Partytown and prefetcher disabled on cart, checkout, account pages
- **Bilingual admin** — English default, Danish auto-detected from WP locale
- **Weekly auto-updates** — GitHub Actions workflow opens a PR when a new Partytown release is detected

---

## Installation

1. Upload the `dc-sw-prefetch` folder to `/wp-content/plugins/`.
2. Activate from the **Plugins** screen.
3. Go to **SW Prefetch** in the admin menu.
4. Add URL patterns for any third-party scripts you want to offload (e.g. `analytics.ahrefs.com` or the full GTM URL). Use the **Auto-Detect** button to scan your homepage.
5. Save.

The `window.partytown.forward` array is pre-configured for all officially tested services: `dataLayer.push` (GTM), `fbq` (Facebook Pixel), `_hsq.push` (HubSpot), `Intercom`, `_learnq.push` (Klaviyo), `ttq.track`/`ttq.page`/`ttq.load` (TikTok Pixel), `mixpanel.track` (Mixpanel). See [partytown.qwik.dev/common-services](https://partytown.qwik.dev/common-services/) for details.

---

## Updating the vendored Partytown library

**Automatic:** the `update-partytown.yml` workflow runs every Monday at 08:00 UTC.

**Manual:**
```bash
# Latest release
bash scripts/update-partytown.sh

# Pin a specific version
bash scripts/update-partytown.sh 0.11.2
```

Then commit `assets/partytown/` and `package.json`.

---

## Repository structure

```
dc-sw-prefetch.php   — Main plugin file
admin.php            — Admin settings page (EN/DA)
uninstall.php        — Cleanup on deletion
assets/partytown/    — Vendored Partytown lib (do NOT hand-edit)
scripts/             — update-partytown.sh
.github/workflows/   — deploy.yml, update-partytown.yml
package.json         — Tracks vendored Partytown version
languages/           — .pot translation template
```

---

## Changelog

### 1.3.8
- Refactor: Auto-detect scan now returns all third-party scripts found on the homepage.
- Scripts on Partytown's officially verified services list are pre-checked with a green compatibility badge.
- Unrecognised scripts are shown unchecked with an explicit compatibility warning.
- Removed auto-population of the exclude/blocklist in auto-detect; architecture is now allow-list first.

### 1.3.7
- Revert: Removed `script_loader_tag` patching of third-party plugin scripts.
- DC SW Prefetch now only manages scripts explicitly moved into Partytown.

### 1.3.6
- Fix: Removed `crossorigin="anonymous"` from Trustpilot `widget-bootstrap-js` when needed under `COEP: credentialless`.

### 1.3.5
- Revert: Restored `partytown-config.js` as a normal enqueued file.
- Removed unnecessary inline `file_get_contents()` output path.

### 1.3.4
- Fix: `resolveUrl` now uses `this.pathRewrites`, `this.proxyAllowedHosts`, and `this.proxyUrl`.
- Ensures the function is self-contained after Partytown serialises it into the worker.

### 1.3.3
- Fix: Prevent `ReferenceError: dcSwpPartytownData is not defined` in Partytown SW sandbox.

### 1.3.2
- Update: Vendored Partytown 0.13.1 (built from source, pre-release).

### 1.3.1
- Refactor: Moved inline JS into static files in `assets/js/` with `wp_localize_script()` data injection.
- Added `DC_SWP_VERSION` constant for consistent script versioning/cache-busting.
- Added ESLint tooling for `assets/js/`.

### 1.3.0
- New: Consent-aware script loading for 8 common WordPress CMP cookies.
- Scripts now render as `type="text/partytown"` with consent and `type="text/plain"` without consent.

### 1.2.0
- New: WP emoji removal (`print_emoji_detection_script` and `print_emoji_styles`).

### 1.1.0
- Replaced custom `dc-sw.js` service worker with vendored Partytown 0.10.3.
- Added `scripts/update-partytown.sh` and weekly auto-update workflow.

### 1.0.0
- Initial release.

---

## License

GPL-2.0-or-later — see [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html)

---

**Author:** [lennilg](https://github.com/lennilg) — manager@dampcig.dk
