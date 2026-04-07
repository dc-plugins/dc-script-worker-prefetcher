/**
 * GCM v2 consent revoke listener.
 *
 * Fires gtag('consent','update',{…denied}) when the visitor withdraws
 * consent via their CMP so GCM v2-aware services immediately stop
 * collecting data without waiting for the next page load.
 *
 * Events handled:
 *   cmplz_revoke          — Complianz (CustomEvent on document)
 *   dc_swp_consent_revoke — generic fallback; any CMP can dispatch this
 *
 * @package DC_Service_Worker_Prefetcher
 */

( function () {
	'use strict';

	function revokeAll() {
		if ( typeof window.gtag !== 'function' ) {
			return;
		}
		gtag( 'consent', 'update', {
			security_storage:        'granted',
			functionality_storage:   'granted',
			personalization_storage: 'denied',
			analytics_storage:       'denied',
			ad_storage:              'denied',
			ad_user_data:            'denied',
			ad_personalization:      'denied',
		} );
	}

	document.addEventListener( 'cmplz_revoke', revokeAll );
	document.addEventListener( 'dc_swp_consent_revoke', revokeAll );
}() );
