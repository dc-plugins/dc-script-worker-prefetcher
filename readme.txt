=== DC Service Worker Prefetcher ===
Contributors: dampcig
Tags: service worker, prefetch, partytown, performance, woocommerce
Requires at least: 6.8
Tested up to: 6.9
Requires PHP: 8.0
WC tested up to: 10.4.3
Stable tag: 1.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Partytown service worker (third-party script offloading) + viewport/pagination prefetching for WooCommerce. Vendored — no npm required.

== Description ==

DC Service Worker Prefetcher integrates [Partytown](https://github.com/QwikDev/partytown) (by Builder.io / QwikDev) into WordPress as a vendored plugin. Partytown moves third-party scripts — Google Analytics, Meta Pixel, LinkedIn Insight Tag, etc. — into a dedicated service worker so they never block the browser main thread.

On top of Partytown, the plugin ships its own viewport/pagination prefetcher: products visible in the viewport are prefetched via `<link rel="prefetch">` so clicking a product loads it instantly from W3TC or the browser cache.

= Key features =

* **Partytown service worker** — third-party scripts tagged `type="text/partytown"` run off the main thread.
* **Vendored lib** — Partytown's `lib/` files are bundled in `assets/partytown/`; no npm or build step needed on the server.
* **Automatic updates** — a weekly GitHub Actions workflow detects new Partytown releases and opens a PR with the updated vendor files.
* **Viewport prefetching** — IntersectionObserver watches visible products and issues `<link rel="prefetch">` before the user clicks.
* **Pagination prefetch** — next-page link is prefetched 2 s after page load.
* **WP emoji removal** — dequeues the emoji detection script and CSS (76 KB round-trip to s.w.org eliminated).
* **WooCommerce LCP preload** — emits `<link rel="preload" imagesrcset>` for the LCP product image on product and category pages, ensuring the preload matches the mobile browser's srcset candidate.
* **Bot detection** — bots never receive Partytown or prefetch JS, keeping crawl budget clean.
* **W3TC compatible** — HTML pages are cached by W3TC; Partytown handles only script execution.
* **Standalone mode** — when W3TC is absent, PHP fallback cache headers keep browsers and CDNs caching correctly.
* **Cart/checkout safe** — Partytown and the prefetcher are skipped on cart, checkout, and account pages.
* **Admin UI** — toggle Partytown, control viewport prefetch, see the vendored Partytown version at a glance.
* **Bilingual** — EN/DA auto-detection.
* **Optional footer credit** — easily disabled.

= Architecture =

| Layer | Handled by |
|---|---|
| Third-party scripts (GA, Pixel…) | Partytown service worker |
| HTML page caching | W3 Total Cache (or PHP fallback headers) |
| Product/pagination prefetch | DC Prefetch (IntersectionObserver) |

= Updating Partytown =

**Automatic:** the `update-partytown.yml` workflow runs every Monday at 08:00 UTC and opens a PR when a new release is detected.

**Manual:** run `bash scripts/update-partytown.sh` (or `bash scripts/update-partytown.sh 0.10.3` to pin a version). Then commit `assets/partytown/` and `package.json`.

= Using Partytown with third-party scripts =

Change the `type` attribute of any script you want to offload:

    <script type="text/partytown" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>

The `window.partytown.forward` array (configured by the plugin) already forwards `dataLayer.push`, `gtag`, `fbq`, `lintrk`, and `twq`.

== Installation ==

1. Upload the `dc-sw-prefetch` folder to `/wp-content/plugins/`.
2. Activate the plugin from the **Plugins** screen.
3. Go to **SW Prefetch** in the admin menu.
4. Enable Partytown and/or Viewport Preloading and save.

== Frequently Asked Questions ==

= Will this interfere with WooCommerce cart/checkout? =
No. Partytown and the prefetcher are completely disabled on cart, checkout, and account pages.

= Does it work without W3 Total Cache? =
Yes. PHP fallback cache headers are emitted for public pages when W3TC is not active.

= How do I verify Partytown is running? =
Open DevTools → Application → Service Workers. You should see `partytown-sw.js` registered under `/~partytown/`. In the Console you should see no third-party scripts on the main thread.

= How do I update Partytown? =
Either let the weekly GitHub Action open a PR automatically, or run `bash scripts/update-partytown.sh` locally.

= What scripts does Partytown forward by default? =
`dataLayer.push`, `gtag`, `fbq` (Meta Pixel), `lintrk` (LinkedIn), `twq` (Twitter/X). Add more via the `window.partytown.forward` array.

== Screenshots ==

1. Admin settings page (English) showing Partytown version and changelog link.
2. Admin settings page (Danish).
3. DevTools showing Partytown service worker registered at `/~partytown/`.

== Changelog ==

= 1.2.0 =
* **New:** WP emoji removal — dequeues `print_emoji_detection_script` and `print_emoji_styles` saving ~76 KB and one s.w.org DNS lookup per page. Toggle in admin (default: on).
* **New:** WooCommerce LCP image preload — emits `<link rel="preload" as="image" imagesrcset imagesizes>` for the featured product image on single product and category/shop pages. The `imagesrcset` attribute matches the `<img srcset>` so the preload is never discarded by the browser as unused — critical fix for PSI mobile scoring. Toggle in admin (default: on).
* Version bump: 1.1.0 → 1.2.0.

= 1.1.0 =
* **Breaking:** replaced custom `dc-sw.js` asset-caching service worker with vendored Partytown 0.10.3.
* Partytown lib files served from `/~partytown/` (plugin `assets/partytown/`).
* Added `scripts/update-partytown.sh` for manual vendor updates.
* Added `.github/workflows/update-partytown.yml` weekly auto-update bot.
* Added `package.json` to track vendored Partytown version.
* Removed offline-fallback-page setting (no longer needed without custom SW).
* Viewport/pagination prefetcher unchanged and fully retained.

= 1.0.0 =
* Initial release. Service worker renamed to `dc-sw.js`.
* Standalone fallback cache headers added (fires when W3TC is not active).
* Bot detection wrapped in `function_exists` for safe coexistence with child themes.
* Footer credit with object-cache → transient strategy caching.
* Bilingual admin UI (English default, Danish auto-detected).

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== Description ==

Service Worker Prefetcher installs a lean service worker (`/dampcig-sw.js`) that caches static assets (CSS, JS, fonts, images) locally in the browser using a Cache-First strategy. HTML pages are deliberately left to W3 Total Cache — no duplicated caching layers.

On category and shop pages, products visible in the viewport are automatically prefetched via browser `<link rel="prefetch">`, so clicking a product loads it instantly from the W3TC cache.

= Key features =

* **Asset caching** — CSS, JS, fonts, and images cached locally via Cache-First strategy.
* **Viewport prefetching** — IntersectionObserver watches visible products and prefetches them before the user clicks.
* **Bot detection** — Bots and crawlers never receive the service worker, keeping crawl budget clean.
* **W3TC hybrid mode** — HTML pages are never intercepted; W3TC handles page caching entirely.
* **Bot-safe** — Service worker is skipped entirely for known bots (Googlebot, PageSpeed, GTmetrix, etc.).
* **Cart/checkout safe** — Service worker is unregistered on cart, checkout, and account pages.
* **Admin UI** — Toggle the service worker, configure the offline fallback URL, and control viewport preloading.
* **Bilingual** — Admin UI automatically switches between English and Danish (`da_DK`).
* **Optional footer credit** — Pre-checked, easily disabled. Defers to Dampcig PNG→WebP plugin if both are active.

= W3TC Hybrid Mode =

This plugin is designed to work alongside W3 Total Cache:

* W3TC caches HTML pages (product pages, categories, homepage).
* This plugin caches static assets (CSS, JS, images) in the browser.
* No duplication, no conflicts.

== Installation ==

1. Upload the `dc-sw-prefetch` folder to `/wp-content/plugins/`.
2. Activate the plugin from the **Plugins** screen.
3. Go to **SW Prefetch** in the admin menu.
4. Verify settings and save. The service worker is active immediately.

== Frequently Asked Questions ==

= Will this interfere with WooCommerce cart/checkout? =
No. The service worker is automatically unregistered on cart, checkout, and account pages to prevent any interference with session handling.

= Does it work without W3 Total Cache? =
Yes — the asset caching and viewport prefetching work independently. Without W3TC, prefetched HTML pages will be fetched fresh from the server instead of from cache.

= How do I verify the service worker is running? =
Open DevTools → Application → Service Workers. You should see `dampcig-sw.js` registered with scope `/`.

= What happens when a bot visits? =
The service worker is never registered for bots. The bot detection runs server-side before any JS is emitted.

== Screenshots ==

1. Admin settings page (English).
2. Admin settings page (Danish).
3. DevTools Application panel showing registered service worker.

== Changelog ==

= 1.0.0 =
* Initial release. Extracted from ecommerce-gem-child theme.
* Bot detection wrapped in `function_exists` for safe coexistence with child themes.
* Footer credit with object-cache → transient strategy caching.
* Bilingual admin UI (English default, Danish auto-detected).

== Upgrade Notice ==

= 1.0.0 =
Initial release.
