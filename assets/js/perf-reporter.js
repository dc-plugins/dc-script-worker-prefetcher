/* DC SW Prefetch — Performance Reporter */
( function () {
	if ( ! window.dcSwpPerfData ) return;
	var data = window.dcSwpPerfData;
	var nonce = data.nonce;
	var ajaxUrl = data.ajaxUrl;
	var sessionKey = data.sessionKey;
	if ( sessionStorage.getItem( sessionKey ) ) return;

	var tbt = 0;
	var inp = 0;
	var LONG_TASK_THRESHOLD = 50;

	try {
		new PerformanceObserver( function ( list ) {
			list.getEntries().forEach( function ( e ) {
				tbt += Math.max( 0, e.duration - LONG_TASK_THRESHOLD );
			} );
		} ).observe( { type: 'longtask', buffered: true } );
	} catch ( e ) { /* not supported */ }

	try {
		new PerformanceObserver( function ( list ) {
			list.getEntries().forEach( function ( e ) {
				if ( e.interactionId > 0 ) inp = Math.max( inp, e.duration );
			} );
		} ).observe( { type: 'event', buffered: true, durationThreshold: 16 } );
	} catch ( e ) { /* not supported */ }

	function report() {
		sessionStorage.setItem( sessionKey, '1' );
		var formData = new FormData();
		formData.append( 'action', 'dc_swp_perf_report' );
		formData.append( 'nonce', nonce );
		formData.append( 'tbt', tbt.toFixed( 2 ) );
		formData.append( 'inp', inp.toFixed( 2 ) );
		if ( navigator.sendBeacon ) {
			navigator.sendBeacon( ajaxUrl, formData );
		} else {
			fetch( ajaxUrl, { method: 'POST', body: formData } );
		}
	}

	var IDLE_DELAY = 10000;
	if ( 'requestIdleCallback' in window ) {
		requestIdleCallback( report, { timeout: IDLE_DELAY } );
	} else {
		setTimeout( report, IDLE_DELAY );
	}

	document.addEventListener( 'visibilitychange', function () {
		if ( document.visibilityState === 'hidden' && ! sessionStorage.getItem( sessionKey ) ) report();
	} );
} )();
