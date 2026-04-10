# DC Script Worker Proxy — Next Features Implementation Plan

You are implementing new features for the `dc-sw-prefetch` WordPress plugin. Read this entire file before writing any code. Follow every instruction precisely.

---

## Plugin Identity

| Field | Value |
|---|---|
| Plugin Name | DC Script Worker Proxy |
| Slug | `dc-sw-prefetch` |
| Current version | `1.9.0` |
| PHP requirement | 8.0+ |
| WordPress requirement | 6.8+ |
| WooCommerce tested up to | 10.4.3 |
| Text Domain | `dc-sw-prefetch` |
| Function/constant prefix | `dc_swp_` / `DC_SWP_` |
| Package annotation | `@package DC_Service_Worker_Proxy` |
| License | GPL-2.0-or-later |

---

## Repository Layout

```
dc-sw-prefetch.php          — Main plugin file (~3100 lines, all PHP logic)
admin.php                   — Admin UI; required at bottom of main file
uninstall.php               — Cleanup on plugin deletion
assets/
  js/
    admin.js                — Admin page JS
    partytown-config.js     — Sets window.partytown from dcSwpPartytownData
    consent-gate.js         — Unblocks text/plain scripts when CMP fires consent
    consent-update.js       — Fires gtag('consent','update',...) via WP Consent API
    coi-iframe.js           — Stamps credentialless on cross-origin iframes
    footer-credit.js        — DOM TreeWalker to wrap first © in <footer>
    prefetch.js             — IntersectionObserver viewport prefetch
  partytown/                — Vendored Partytown lib (DO NOT hand-edit)
languages/
  dc-sw-prefetch.pot
scripts/
  update-partytown.sh
phpcs.xml                   — PHPCS config (WordPress ruleset, dc_swp_ prefix declared)
package.json                — version + vendored Partytown version
```

---

## Existing Architecture — Do NOT Re-implement

These functions already exist in `dc-sw-prefetch.php`. Use them; never duplicate them.

| Function | Purpose |
|---|---|
| `dc_swp_is_bot_request()` | Bot/crawler/speed-tool detection |
| `dc_swp_is_safe_page()` | True on cart, checkout, account pages |
| `dc_swp_get_csp_nonce()` | Stable per-request CSP nonce (static memoised) |
| `dc_swp_get_service_category($hostname)` | hostname → WP Consent API category |
| `dc_swp_get_proxy_allowed_hosts()` | Hostnames extracted from Script List + Inline Blocks |
| `dc_swp_get_partytown_patterns()` | Flat `string[]` of active URL patterns |
| `dc_swp_get_script_list_entries()` | Structured `{pattern, category}[]` from DB |
| `dc_swp_get_auto_detect_patterns()` | Virtual patterns for GTM detect mode |
| `dc_swp_build_path_rewrites()` | Active path-rewrite map for Partytown config |
| `dc_swp_is_consent_gate_enabled()` | Reads `dc_swp_consent_gate` option |
| `dc_swp_is_consent_mode_enabled()` | Reads `dc_swp_consent_mode` option |
| `dc_swp_is_meta_ldu_enabled()` | Reads `dc_swp_meta_ldu` option |
| `dc_swp_has_fullstory_configured()` | Scans Script List + Inline Blocks for FullStory |
| `dc_swp_bust_page_cache()` | Clears object cache keys + W3TC page cache |
| `dc_swp_str($key)` | EN/DA bilingual admin UI strings |

### Existing options (all prefixed `dc_swp_`)

`dc_swp_sw_enabled`, `dc_swp_partytown_scripts`, `dc_swp_inline_scripts`,
`dc_swp_consent_gate`, `dc_swp_consent_mode`, `dc_swp_meta_ldu`,
`dc_swp_gtm_mode`, `dc_swp_gtm_id`, `dc_swp_coi_headers`, `dc_swp_debug_mode`,
`dc_swp_footer_credit`, `dc_swp_script_list_category`, `dc_swp_preload_products`,
`dc_swp_product_base`.

---

## WordPress Coding Standards — Mandatory

### Security

Every privileged form submit:
```php
check_admin_referer( 'dc_swp_save_settings', 'dc_swp_nonce' );
if ( ! current_user_can( 'manage_options' ) ) { wp_die(); }
```

Every AJAX handler:
```php
check_ajax_referer( 'dc_swp_my_action', 'nonce' );
if ( ! current_user_can( 'manage_options' ) ) {
    wp_send_json_error( array( 'message' => 'Unauthorized' ), 403 );
}
```

Exception — anonymous metric/health reporters have no cap check; nonce + data validation is sufficient.

Sanitize all user input:
```php
$val = sanitize_text_field( wp_unslash( $_POST['field'] ?? '' ) );
$url = esc_url_raw( wp_unslash( $_POST['url'] ?? '' ) );
$int = absint( $_POST['count'] ?? 0 );
```

Escape all output:
```php
echo esc_html( $string );
echo esc_attr( $attr );
echo esc_url( $url );
```

For static PHP-built JS strings that cannot be escaped, add per-line ignore with justification:
```php
// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fully static JS; nonce is pre-escaped via esc_attr.
echo '<script' . $nonce_attr . ">\n" . $static_js . "</script>\n";
```

Never use `file_get_contents()` for local files. Always use WP Filesystem:
```php
global $wp_filesystem;
if ( empty( $wp_filesystem ) ) {
    require_once ABSPATH . 'wp-admin/includes/file.php';
    WP_Filesystem();
}
$contents = $wp_filesystem->get_contents( $absolute_path );
```

HTTP calls via WP HTTP API only:
```php
$response = wp_remote_get( $url, array( 'timeout' => 10, 'sslverify' => true ) );
if ( is_wp_error( $response ) ) { /* handle */ }
```

### Naming & Prefixes

- Every function, class, constant, and option name must use prefix `dc_swp_` / `DC_SWP_`.
- Hook names belonging to third-party APIs are exempt — add on that line only:
  `// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound`
- Do NOT add `phpcs:ignore NonPrefixedFunctionFound` on functions that already use `dc_swp_` — redundant ignores are a WP.org rejection reason.

### Code Style

- Tabs for indentation (WordPress standard — not spaces).
- `array()` not `[]`.
- `true` / `false` / `null` lowercase.
- Function docblocks with `@param`, `@return`, `@since`.
- Guard every file: `if ( ! defined( 'ABSPATH' ) ) { die(); }`.
- PHP 8.0+ features acceptable: `str_contains()`, `str_starts_with()`, named arguments.
- WooCommerce conditional functions must be wrapped: `function_exists( 'is_cart' ) && is_cart()`.

### Translation

- All user-facing strings: `esc_html__( 'Text', 'dc-sw-prefetch' )`.
- `/* translators: %s is X */` comment on every `printf`/`sprintf` i18n string.
- Admin UI uses `dc_swp_str( $key )` for EN/DA bilingual output — add new keys to that function.

### Script Enqueuing Pattern

```php
wp_register_script(
    'dc-swp-my-script',
    plugins_url( 'assets/js/my-script.js', __FILE__ ),
    array(),
    DC_SWP_VERSION,
    array( 'in_footer' => true )
);
wp_localize_script( 'dc-swp-my-script', 'dcSwpMyData', array( /* data */ ) );
wp_enqueue_script( 'dc-swp-my-script' );
```

### Version Bump (all 4 locations must match — mandatory)

| File | What to change |
|---|---|
| `dc-sw-prefetch.php` | `Version:` plugin header line |
| `dc-sw-prefetch.php` | `define( 'DC_SWP_VERSION', '...' )` constant (~line 517) |
| `readme.txt` | `Stable tag:` line |
| `package.json` | `"version"` field |

Versioning: `PATCH` = bug fixes only · `MINOR` = new features · `MAJOR` = breaking schema changes.

---

## Feature 1 — Early Resource Hints (target: v2.0.0)

### Goal

Auto-inject `<link rel="preconnect">` and `<link rel="dns-prefetch">` for every unique
third-party hostname in the Script List, Inline Blocks, and GTM detect mode.
Reduces TCP+TLS round-trip latency for the first worker fetch — measurable improvement
for first-time visitors who have no warm DNS cache.

### New option

`dc_swp_resource_hints` — string `yes/no`, default `yes`. Stored via `update_option`.

### New functions — add to `dc-sw-prefetch.php`

**`dc_swp_get_resource_hint_hosts(): string[]`**
- Collects unique hostnames from `dc_swp_get_proxy_allowed_hosts()`.
- Also adds `www.googletagmanager.com` when GTM mode is `own`, `managed`, or `detect` and a valid tag ID is saved.
- Excludes the site's own hostname: `wp_parse_url( home_url(), PHP_URL_HOST )`.
- Returns deduplicated lowercase array.

**`dc_swp_inject_resource_hints(): void`**
- Hook: `add_action( 'wp_head', 'dc_swp_inject_resource_hints', 2 )`
  (priority 2 — after GCM v2 stub at 1, before GTM injection at 5)
- Guards (return early if any is true):
  - `dc_swp_is_bot_request()`
  - `is_admin()`
  - `get_option( 'dc_swp_sw_enabled', 'yes' ) !== 'yes'`
  - `get_option( 'dc_swp_resource_hints', 'yes' ) !== 'yes'`
  - `dc_swp_is_safe_page()` (cart/checkout/account)
  - `dc_swp_is_excluded_url()` — only after Feature 4 exists; wrap in `function_exists()`
- For each host from `dc_swp_get_resource_hint_hosts()`:
  ```php
  echo '<link rel="preconnect" href="' . esc_url( 'https://' . $host ) . '" crossorigin />' . "\n";
  echo '<link rel="dns-prefetch" href="//' . esc_attr( $host ) . '" />' . "\n";
  ```

### Admin UI — changes to `admin.php`

- Add checkbox row "Early Resource Hints" in the opening Performance section (near Partytown toggle).
- Save the `dc_swp_resource_hints` option in the existing save handler (nonce-protected form).
- Add to `dc_swp_str()`:
  - `resource_hints_label` → EN: `'Early Resource Hints'` / DA: `'Tidlige Ressource-hints'`
  - `resource_hints_desc` → EN: description of preconnect benefit / DA: translation

### Files changed

- `dc-sw-prefetch.php` — 2 new functions, 1 new `add_action` call
- `admin.php` — 1 new checkbox field, 1 new save line, 2 new bilingual strings

---

## Feature 2 — Partytown Health Monitor (target: v2.1.0)

### Goal

Detect when a configured third-party service fails silently inside the Partytown worker
(no network requests arriving from expected hostnames) and surface an admin notice.

### New option

`dc_swp_health_monitor` — string `yes/no`, default `yes`.

### New transient

`dc_swp_health_issues` — `array` of failing hostname strings. TTL: 86400 seconds (24h).
Delete transient at end of settings save handler: `delete_transient( 'dc_swp_health_issues' )`.

### New JS file — `assets/js/health-monitor.js`

```js
/* DC SW Prefetch — Partytown Health Monitor */
( function () {
    if ( ! window.dcSwpHealthData ) return;
    const { hosts, nonce, ajaxUrl, timeout } = window.dcSwpHealthData;
    if ( ! hosts || ! hosts.length ) return;

    const observed = new Set();

    const observer = new PerformanceObserver( ( list ) => {
        list.getEntries().forEach( ( entry ) => {
            if ( entry.initiatorType !== 'script' && entry.initiatorType !== 'fetch' && entry.initiatorType !== 'xmlhttprequest' ) return;
            hosts.forEach( ( host ) => {
                if ( entry.name.includes( host ) ) observed.add( host );
            } );
        } );
    } );

    try {
        observer.observe( { type: 'resource', buffered: true } );
    } catch ( e ) {
        return; // PerformanceObserver not supported — skip silently.
    }

    setTimeout( function () {
        observer.disconnect();
        hosts.forEach( function ( host ) {
            if ( ! observed.has( host ) ) {
                const data = new FormData();
                data.append( 'action', 'dc_swp_health_report' );
                data.append( 'nonce', nonce );
                data.append( 'host', host );
                navigator.sendBeacon ? navigator.sendBeacon( ajaxUrl, data )
                    : fetch( ajaxUrl, { method: 'POST', body: data } );
            }
        } );
    }, timeout );
} )();
```

### New functions — add to `dc-sw-prefetch.php`

**`dc_swp_enqueue_health_monitor(): void`**
- Hook: `add_action( 'wp_enqueue_scripts', 'dc_swp_enqueue_health_monitor', 20 )`
- Guards: `dc_swp_is_bot_request()`, `is_admin()`, `sw_enabled !== yes`, `health_monitor option !== yes`, safe page.
- Only enqueue when `dc_swp_get_partytown_patterns()` is non-empty.
- `wp_register_script( 'dc-swp-health-monitor', plugins_url('assets/js/health-monitor.js', __FILE__), array(), DC_SWP_VERSION, array('in_footer'=>true) )`
- `wp_localize_script( 'dc-swp-health-monitor', 'dcSwpHealthData', array( 'hosts' => dc_swp_get_proxy_allowed_hosts(), 'nonce' => wp_create_nonce('dc_swp_health_nonce'), 'ajaxUrl' => admin_url('admin-ajax.php'), 'timeout' => 15000 ) )`
- `wp_enqueue_script( 'dc-swp-health-monitor' )`

**`dc_swp_ajax_health_report(): void`**
- Hook: `add_action( 'wp_ajax_dc_swp_health_report', 'dc_swp_ajax_health_report' )`
- Hook: `add_action( 'wp_ajax_nopriv_dc_swp_health_report', 'dc_swp_ajax_health_report' )`
- `check_ajax_referer( 'dc_swp_health_nonce', 'nonce' )`
- NO `current_user_can()` — anonymous reporter. Nonce + allowlist check = sufficient.
- `$host = sanitize_text_field( wp_unslash( $_POST['host'] ?? '' ) )`
- Validate: `$host` must be in `dc_swp_get_proxy_allowed_hosts()`. If not: `wp_send_json_error(array('message'=>'Invalid host'), 400)`.
- Append to transient:
  ```php
  $issues = get_transient( 'dc_swp_health_issues' );
  $issues = is_array( $issues ) ? $issues : array();
  $issues[] = $host;
  $issues = array_unique( $issues );
  set_transient( 'dc_swp_health_issues', $issues, DAY_IN_SECONDS );
  ```
- `wp_send_json_success()`

### New function — add to `admin.php`

**`dc_swp_admin_health_notice(): void`**
- Hook: `add_action( 'admin_notices', 'dc_swp_admin_health_notice' )`
- `if ( ! current_user_can( 'manage_options' ) ) return;`
- `$issues = get_transient( 'dc_swp_health_issues' ); if ( empty( $issues ) ) return;`
- Render a dismissible `notice-warning` div listing the failing hostnames with a link to plugin settings.

### Admin UI

- Add "Health Monitor" toggle checkbox in admin page.
- Add bilingual strings: `health_monitor_label`, `health_monitor_desc`, `health_monitor_notice`.

---

## Feature 3 — Performance Metrics Dashboard (target: v2.2.0)

### Goal

Collect real-world TBT (Total Blocking Time) and INP (Interaction to Next Paint) from
anonymous front-end page loads and display rolling averages in the WP admin — giving site
owners visible proof of Partytown's main-thread offloading benefit.

### New options

| Option | Type | Autoloaded | Purpose |
|---|---|---|---|
| `dc_swp_perf_monitor` | `yes/no` | yes | Toggle |
| `dc_swp_perf_metrics` | JSON string | **no** | Rolling averages |
| `dc_swp_perf_samples` | JSON string | **no** | Last 100 TBT + INP values for P75 |

Store non-autoloaded options: `update_option( 'dc_swp_perf_metrics', $json, false )`.

Schema for `dc_swp_perf_metrics`:
```json
{
  "samples": 0,
  "tbt_avg": 0.0,
  "inp_avg": 0.0,
  "tbt_p75": 0.0,
  "inp_p75": 0.0,
  "last_updated": "2026-04-10T12:00:00+00:00"
}
```

### New JS file — `assets/js/perf-reporter.js`

```js
/* DC SW Prefetch — Performance Reporter */
( function () {
    if ( ! window.dcSwpPerfData ) return;
    const { nonce, ajaxUrl, sessionKey } = window.dcSwpPerfData;
    if ( sessionStorage.getItem( sessionKey ) ) return;

    let tbt = 0;
    let inp = 0;
    const LONG_TASK_THRESHOLD = 50;

    try {
        new PerformanceObserver( ( list ) => {
            list.getEntries().forEach( ( e ) => {
                tbt += Math.max( 0, e.duration - LONG_TASK_THRESHOLD );
            } );
        } ).observe( { type: 'longtask', buffered: true } );
    } catch ( e ) { /* not supported */ }

    try {
        new PerformanceObserver( ( list ) => {
            list.getEntries().forEach( ( e ) => {
                if ( e.interactionId > 0 ) inp = Math.max( inp, e.duration );
            } );
        } ).observe( { type: 'event', buffered: true, durationThreshold: 16 } );
    } catch ( e ) { /* not supported */ }

    function report() {
        sessionStorage.setItem( sessionKey, '1' );
        const data = new FormData();
        data.append( 'action', 'dc_swp_perf_report' );
        data.append( 'nonce', nonce );
        data.append( 'tbt', tbt.toFixed( 2 ) );
        data.append( 'inp', inp.toFixed( 2 ) );
        navigator.sendBeacon ? navigator.sendBeacon( ajaxUrl, data )
            : fetch( ajaxUrl, { method: 'POST', body: data } );
    }

    const IDLE_DELAY = 10000;
    if ( 'requestIdleCallback' in window ) {
        requestIdleCallback( report, { timeout: IDLE_DELAY } );
    } else {
        setTimeout( report, IDLE_DELAY );
    }

    document.addEventListener( 'visibilitychange', function () {
        if ( document.visibilityState === 'hidden' && ! sessionStorage.getItem( sessionKey ) ) report();
    } );
} )();
```

### New functions — add to `dc-sw-prefetch.php`

**`dc_swp_enqueue_perf_reporter(): void`**
- Hook: `add_action( 'wp_enqueue_scripts', 'dc_swp_enqueue_perf_reporter', 20 )`
- Guards: `dc_swp_is_bot_request()`, `is_admin()`, `sw_enabled !== yes`, `perf_monitor option !== yes`.
- Register, localize (`dcSwpPerfData = { nonce, ajaxUrl, sessionKey: 'dc_swp_perf_reported' }`), enqueue.

**`dc_swp_ajax_perf_report(): void`**
- Hook: `wp_ajax_dc_swp_perf_report` + `wp_ajax_nopriv_dc_swp_perf_report`
- `check_ajax_referer( 'dc_swp_perf_nonce', 'nonce' )`
- NO cap check — anonymous reporter.
- Validate and cast: `$tbt = max( 0.0, min( 30000.0, (float) ( $_POST['tbt'] ?? 0 ) ) )` / same for INP max 10000.
- Read existing metrics, update rolling average and samples array (max 100 entries), compute P75 from sorted samples.
- `update_option( 'dc_swp_perf_metrics', wp_json_encode( $metrics ), false )`
- `update_option( 'dc_swp_perf_samples', wp_json_encode( $samples ), false )`
- `wp_send_json_success()`

**`dc_swp_ajax_perf_reset(): void`**
- Hook: `wp_ajax_dc_swp_perf_reset`
- `check_ajax_referer` + `current_user_can( 'manage_options' )` both required.
- `delete_option( 'dc_swp_perf_metrics' ); delete_option( 'dc_swp_perf_samples' );`
- `wp_send_json_success()`

### Admin UI — new "Performance" sub-tab

- Show: TBT avg, INP avg, TBT P75, INP P75, sample count, last updated timestamp.
- Pure CSS progress bars (0–300ms range for TBT, 0–200ms for INP) — no external chart library.
- "Reset Metrics" button wired to `dc_swp_ajax_perf_reset`.
- Toggle for `dc_swp_perf_monitor`.
- Bilingual strings: `perf_tab_label`, `perf_tbt_label`, `perf_inp_label`, `perf_samples_label`, `perf_reset_btn`, `perf_no_data`, `perf_last_updated`.

---

## Feature 4 — Per-Page Script Exclusion Patterns (target: v2.3.0)

### Goal

Let admins define URL patterns where Partytown is completely skipped — useful when a specific
landing page or payment flow has scripts that are incompatible with the Partytown worker.

### New option

`dc_swp_exclusion_patterns` — plain text, newline-separated URL substrings.
Each line sanitized individually with `sanitize_text_field()` on save.
Supports `*` wildcard (any characters).

### New functions — add to `dc-sw-prefetch.php`

**`dc_swp_get_exclusion_patterns(): string[]`**
- Read `get_option( 'dc_swp_exclusion_patterns', '' )`.
- Split on newlines, `sanitize_text_field` each, filter empty.
- Object-cache memoised: `wp_cache_get( 'exclusion_patterns', 'dc_swp' )` / `wp_cache_set`.
- Returns `string[]`.

**`dc_swp_is_excluded_url( string $request_uri = '' ): bool`**
- Static variable memoisation (one check per request).
- If `$request_uri` is empty: `$request_uri = sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ?? '' ) )`.
- For each pattern in `dc_swp_get_exclusion_patterns()`:
  - If pattern contains `*`: escape for regex, replace `\*` with `.*`, use `preg_match`.
  - Otherwise: `str_contains( $request_uri, $pattern )`.
- Return `true` if any matches.

### Integration — add guard to these existing functions

In each function listed below, add after the bot/`is_admin`/`sw_enabled` guards:
```php
if ( dc_swp_is_excluded_url() ) {
    return;
}
```

Functions to patch:
1. `dc_swp_partytown_config()` — skips Partytown config enqueue entirely
2. `dc_swp_partytown_buffer_start()` — skips output buffer
3. `dc_swp_partytown_script_attrs()` — returns attributes unchanged
4. `dc_swp_inject_gtm_head()` — skips GTM injection
5. `dc_swp_inject_resource_hints()` — skips resource hints (Feature 1, check with `function_exists`)

### Cache busting

Add to existing `add_action` calls in `dc-sw-prefetch.php`:
```php
add_action( 'update_option_dc_swp_exclusion_patterns', 'dc_swp_bust_page_cache' );
```

### Admin UI — new "Advanced" section in `admin.php`

- Textarea: "Partytown Exclusion Patterns" (one per line).
- Placeholder: `/landing-page/` on first line, `/payment-flow/*` on second.
- Hint text: supports `*` wildcard.
- Save: split lines, `sanitize_text_field` each, `implode( "\n", ... )`, `update_option`.
- Bilingual strings: `exclusion_patterns_label`, `exclusion_patterns_desc`, `exclusion_patterns_placeholder`.

---

## Verification Checklist

After implementing each feature before committing:

- [ ] `vendor/bin/phpcs` — 0 errors, 0 warnings
- [ ] Bot UA curl (`Googlebot`) → no Partytown output, no new JS enqueued
- [ ] Safe pages (cart/checkout/account) → no Partytown output for any new feature
- [ ] Feature 1: Add `static.hotjar.com` to Script List → view source → `<link rel="preconnect" href="https://static.hotjar.com" crossorigin />` present
- [ ] Feature 2: Add `nonexistent.example.com` to Script List → load page → after 15s check transient → admin notice appears on next WP admin load
- [ ] Feature 3: Enable perf monitor → load front page → `get_option('dc_swp_perf_metrics')` has non-null `samples` value after ~10s
- [ ] Feature 4: Add `/shop/` exclusion → visit `/shop/` → no `<link rel="preconnect">`, no Partytown config script; visit `/product/x/` → Partytown fully active
- [ ] All 4 version locations match before `git tag`

---

## Deployment

```powershell
cd "wp-content/plugins/dc-sw-prefetch"
git add -A
git commit -m "feat: <one-line description>

- Bullet list of changes"

git tag -a vX.Y.Z -m "Version X.Y.Z — <summary>"
git push origin main --tags
```

`--tags` is required — pushing `main` alone does not push the tag and the GitHub Release will not be created.
