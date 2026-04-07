/**
 * GCM v2 consent mode default initialisation.
 *
 * Reads CMP consent cookies at runtime in the browser — not in PHP —
 * so full-page cache (W3 Total Cache, WP Rocket, etc.) never serves
 * a cached 'granted' state to unconsented visitors.
 *
 * PHP settings are injected before this script as window.dcSwpConsentData:
 *   {boolean} urlPassthrough   — enable GCM url_passthrough
 *   {boolean} adsDataRedaction — enable GCM ads_data_redaction
 *
 * Supported CMPs:
 *   Complianz (opt-in + opt-out), CookieYes, Borlabs Cookie,
 *   Cookie Notice, WebToffee GDPR, Cookiebot, Cookie Information,
 *   Moove GDPR.
 *
 * @package DC_Service_Worker_Prefetcher
 */

/* global dcSwpConsentData */

window.dataLayer = window.dataLayer || [];

// Define gtag in outer scope so CMPs and tag libraries can call window.gtag().
function gtag() { // eslint-disable-line no-inner-declarations
	dataLayer.push( arguments ); // eslint-disable-line prefer-rest-params
}

( function () {
	'use strict';

	var settings = ( typeof dcSwpConsentData !== 'undefined' ) ? dcSwpConsentData : {};

	// ── GCM optional flags ─────────────────────────────────────────────────
	if ( settings.urlPassthrough ) {
		gtag( 'set', 'url_passthrough', true );
	}
	if ( settings.adsDataRedaction ) {
		gtag( 'set', 'ads_data_redaction', true );
	}

	// ── Cookie reader ──────────────────────────────────────────────────────
	function getCookie( name ) {
		var value = '; ' + document.cookie;
		var parts = value.split( '; ' + name + '=' );
		if ( parts.length === 2 ) {
			return decodeURIComponent( parts.pop().split( ';' )[ 0 ] );
		}
		return null;
	}

	// ── JSON-cookie helper ─────────────────────────────────────────────────
	function getJsonCookie( name ) {
		try {
			var v = getCookie( name );
			return v ? JSON.parse( v ) : {};
		} catch ( e ) {
			return {};
		}
	}

	// ── Read cookies once ──────────────────────────────────────────────────
	var cmplzConsentType = getCookie( 'cmplz_consenttype' ) || '';
	var cookieYes        = getCookie( 'cookieyes-consent' ) || '';
	var cookieBot        = getCookie( 'CookieConsent' )     || '';
	var borlabs          = getJsonCookie( 'borlabs-cookie' );
	var borlabsConsents  = borlabs.consents || {};
	var cookieInfo       = getJsonCookie( 'CookieInformationConsent' );
	var ciApproved       = cookieInfo.consents_approved || [];
	var moove            = getJsonCookie( 'moove_gdpr_popup' );

	// ── Opt-out mode detection ─────────────────────────────────────────────
	// Complianz: cmplz_consenttype === 'optout' means consent is implicit
	// (granted by default unless the visitor has explicitly denied it).
	// CookieYes: 'type:lss' (Legitimate Soft Skip) and 'type:no-consent'
	// also signal implicit/soft consent.
	var isOptOut = cmplzConsentType.indexOf( 'optout' ) !== -1
		|| cookieYes.indexOf( 'type:lss' ) !== -1
		|| cookieYes.indexOf( 'type:no-consent' ) !== -1;

	// ── Per-category consent checkers ──────────────────────────────────────

	/**
	 * Returns true when the visitor has granted marketing consent.
	 * Maps to: ad_storage, ad_user_data, ad_personalization.
	 */
	function hasMarketing() {
		var v;
		if ( isOptOut ) {
			v = getCookie( 'cmplz_marketing' );
			return v === null || v !== 'deny';
		}
		if ( getCookie( 'cmplz_marketing' ) === 'allow' )           return true;
		if ( cookieYes.indexOf( 'marketing:yes' ) !== -1 )          return true;
		if ( borlabsConsents.marketing )                             return true;
		if ( getCookie( 'cookie_notice_accepted' ) === 'true' )     return true;
		if ( getCookie( 'cookie_cat_marketing' ) === 'accept' )     return true;
		if ( cookieBot.indexOf( 'marketing:true' ) !== -1 )         return true;
		if ( ciApproved.indexOf( 'cookie_cat_marketing' ) !== -1 )  return true;
		if ( parseInt( moove.thirdparty || 0, 10 ) === 1 )          return true;
		return false;
	}

	/**
	 * Returns true when the visitor has granted statistics/analytics consent.
	 * Maps to: analytics_storage.
	 */
	function hasStatistics() {
		var v;
		if ( isOptOut ) {
			v = getCookie( 'cmplz_statistics' );
			return v === null || v !== 'deny';
		}
		if ( getCookie( 'cmplz_statistics' ) === 'allow' )          return true;
		if ( cookieYes.indexOf( 'analytics:yes' ) !== -1 )          return true;
		if ( borlabsConsents.statistics )                            return true;
		if ( getCookie( 'cookie_notice_accepted' ) === 'true' )     return true;
		if ( getCookie( 'cookie_cat_analytics' ) === 'accept' )     return true;
		if ( cookieBot.indexOf( 'statistics:true' ) !== -1 )        return true;
		if ( ciApproved.indexOf( 'cookie_cat_statistic' ) !== -1 )  return true;
		if ( parseInt( moove.analytics || 0, 10 ) === 1 )           return true;
		return false;
	}

	/**
	 * Returns true when the visitor has granted preferences/personalisation consent.
	 * Maps to: personalization_storage.
	 */
	function hasPreferences() {
		var v;
		if ( isOptOut ) {
			v = getCookie( 'cmplz_preferences' );
			return v === null || v !== 'deny';
		}
		if ( getCookie( 'cmplz_preferences' ) === 'allow' )          return true;
		if ( cookieYes.indexOf( 'preferences:yes' ) !== -1 )         return true;
		if ( borlabsConsents.preferences )                            return true;
		if ( getCookie( 'cookie_notice_accepted' ) === 'true' )      return true;
		if ( cookieBot.indexOf( 'preferences:true' ) !== -1 )        return true;
		if ( ciApproved.indexOf( 'cookie_cat_functional' ) !== -1 )  return true;
		return false;
	}

	// ── Set GCM v2 consent default ─────────────────────────────────────────
	var mkt  = hasMarketing();
	var stat = hasStatistics();
	var pref = hasPreferences();

	gtag( 'consent', 'default', {
		security_storage:        'granted',
		functionality_storage:   'granted',
		personalization_storage:  pref ? 'granted' : 'denied',
		analytics_storage:        stat ? 'granted' : 'denied',
		ad_storage:               mkt  ? 'granted' : 'denied',
		ad_user_data:             mkt  ? 'granted' : 'denied',
		ad_personalization:       mkt  ? 'granted' : 'denied',
		// 500 ms grace period: gives the CMP's deferred JS time to call
		// gtag('consent','update',{…}) on first-visit pages before any
		// tag library fires its first network beacon.
		wait_for_update: 500,
	} );

	// Signal to GTM that the consent default stub has been set.
	dataLayer.push( { event: 'default_consent' } );
}() );
