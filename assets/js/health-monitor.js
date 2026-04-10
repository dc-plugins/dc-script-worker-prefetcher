/* DC SW Prefetch — Partytown Health Monitor */
( function () {
	if ( ! window.dcSwpHealthData ) return;
	var data = window.dcSwpHealthData;
	var hosts = data.hosts;
	var nonce = data.nonce;
	var ajaxUrl = data.ajaxUrl;
	var timeout = data.timeout;
	if ( ! hosts || ! hosts.length ) return;

	var observed = new Set();

	var observer = new PerformanceObserver( function ( list ) {
		list.getEntries().forEach( function ( entry ) {
			if ( entry.initiatorType !== 'script' && entry.initiatorType !== 'fetch' && entry.initiatorType !== 'xmlhttprequest' ) return;
			hosts.forEach( function ( host ) {
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
				var formData = new FormData();
				formData.append( 'action', 'dc_swp_health_report' );
				formData.append( 'nonce', nonce );
				formData.append( 'host', host );
				if ( navigator.sendBeacon ) {
					navigator.sendBeacon( ajaxUrl, formData );
				} else {
					fetch( ajaxUrl, { method: 'POST', body: formData } );
				}
			}
		} );
	}, timeout );
} )();
