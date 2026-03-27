/**
 * Admin UI — autodetect scripts + inline script blocks accordion.
 * Data injected by PHP via wp_localize_script as dcSwpAdminData.
 *
 * @package DC_Service_Worker_Prefetcher
 */

/* global dcSwpAdminData */

// ── Autodetect scripts ───────────────────────────────────────────────────────
jQuery( function ( $ ) {
	const nonce        = dcSwpAdminData.nonce;
	const noScriptsMsg = dcSwpAdminData.noScriptsMsg;

	$( '#dc-swp-autodetect-btn' ).on( 'click', function () {
		const $btn  = $( this );
		const $spin = $( '#dc-swp-autodetect-spinner' );
		const $res  = $( '#dc-swp-autodetect-results' );
		const $list = $( '#dc-swp-autodetect-list' );

		$btn.prop( 'disabled', true );
		$spin.css( 'display', 'inline-block' );
		$res.hide();

		$.post( ajaxurl, { action: 'dc_swp_detect_scripts', nonce: nonce }, function ( r ) {
			$btn.prop( 'disabled', false );
			$spin.hide();

			const compatible   = ( r.success && r.data && r.data.compatible )   ? r.data.compatible   : [];
			const incompatible = ( r.success && r.data && r.data.incompatible ) ? r.data.incompatible : [];

			// Auto-merge only the incompatible scripts that were actually found on the site.
			if ( incompatible.length ) {
				const $excl      = $( 'textarea[name="dc_swp_partytown_exclude"]' );
				const existingEx = $excl.val().split( '\n' ).map( function ( s ) { return s.trim(); } ).filter( Boolean );
				const toExclude  = incompatible.filter( function ( p ) { return existingEx.indexOf( p ) === -1; } );
				if ( toExclude.length ) {
					$excl.val( existingEx.concat( toExclude ).join( '\n' ) );
				}
			}

			// Show compatible scripts as checkboxes for the include list.
			if ( ! compatible.length ) {
				$list.html( '<em>' + $( '<span>' ).text( noScriptsMsg ).html() + '</em>' );
				$( '#dc-swp-add-selected' ).hide();
			} else {
				let html = '';
				$.each( compatible, function ( _i, url ) {
					const safe = $( '<span>' ).text( url ).html();
					html += '<label style="display:block;margin:2px 0"><input type="checkbox" value="' + safe + '" checked> <code>' + safe + '</code></label>';
				} );
				$list.html( html );
				$( '#dc-swp-add-selected' ).show();
			}
			$res.show();
		} ).fail( function () { $btn.prop( 'disabled', false ); $spin.hide(); } );
	} );

	$( '#dc-swp-add-selected' ).on( 'click', function () {
		const $ta      = $( 'textarea[name="dc_swp_partytown_scripts"]' );
		const $list    = $( '#dc-swp-autodetect-list' );
		const existing = $ta.val().split( '\n' ).map( function ( s ) { return s.trim(); } ).filter( Boolean );
		const toAdd    = [];

		$list.find( 'input[type="checkbox"]:checked' ).each( function () {
			const url = $( this ).val();
			if ( existing.indexOf( url ) === -1 ) { toAdd.push( url ); }
		} );

		if ( toAdd.length ) {
			$ta.val( existing.concat( toAdd ).join( '\n' ) );
		}
		$( '#dc-swp-autodetect-results' ).fadeOut();
	} );
} );

// ── Inline script blocks accordion ──────────────────────────────────────────
( function ( $ ) {
	let blocks      = dcSwpAdminData.blocks;
	const noBlocksMsg = dcSwpAdminData.noBlocksMsg;
	const delMsg      = dcSwpAdminData.delMsg;

	function buildBlockEl( b, idx ) {
		const labelSafe = $( '<span>' ).text( b.label || ( 'Block ' + ( idx + 1 ) ) ).html();
		const codeSafe  = $( '<span>' ).text( b.code  || '' ).html();
		const checked   = b.enabled ? ' checked' : '';
		const disCls    = b.enabled ? '' : ' dc-swp-blk-disabled';
		return $( [
			'<div class="dc-swp-blk-item' + disCls + '" data-id="' + b.id + '">',
			'<div class="dc-swp-blk-hdr">',
			'<span class="dc-swp-blk-chevron dashicons dashicons-arrow-right-alt2"></span>',
			'<label class="dc-swp-blk-toggle pwa-toggle" onclick="event.stopPropagation()">',
			'<input class="dc-swp-blk-enable" type="checkbox"' + checked + '>',
			'<span class="pwa-slider"></span></label>',
			'<span class="dc-swp-blk-label" contenteditable="true" spellcheck="false">' + labelSafe + '</span>',
			'<button type="button" class="dc-swp-blk-del button-link" style="color:#a00;padding:4px 8px;margin-left:auto;flex-shrink:0">&times; Delete</button>',
			'</div>',
			'<div class="dc-swp-blk-body">',
			'<textarea class="dc-swp-blk-code large-text code" rows="8" spellcheck="false">' + codeSafe + '</textarea>',
			'</div></div>',
		].join( '' ) );
	}

	function renderList() {
		const $list = $( '#dc-swp-block-list' );
		$list.empty();
		if ( ! blocks.length ) {
			$list.append( '<p style="color:#888;font-style:italic;margin:0 0 4px">' + $( '<span>' ).text( noBlocksMsg ).html() + '</p>' );
			return;
		}
		$.each( blocks, function ( _i, b ) { $list.append( buildBlockEl( b, _i ) ); } );
	}

	function patchBlock( id, changes ) {
		blocks = blocks.map( function ( b ) { return b.id === id ? Object.assign( {}, b, changes ) : b; } );
	}

	renderList();

	// Expand / collapse.
	$( document ).on( 'click', '.dc-swp-blk-hdr', function ( e ) {
		if ( $( e.target ).closest( 'button,input,label' ).length ) return;
		const $it  = $( this ).closest( '.dc-swp-blk-item' );
		const open = ! $it.hasClass( 'dc-swp-blk-open' );
		$it.toggleClass( 'dc-swp-blk-open', open );
		$it.find( '.dc-swp-blk-body' ).stop( true, true ).slideToggle( 160 );
		$it.find( '.dc-swp-blk-chevron' )
			.toggleClass( 'dashicons-arrow-right-alt2', ! open )
			.toggleClass( 'dashicons-arrow-down-alt2',   open );
	} );

	// Enable / disable.
	$( document ).on( 'change', '.dc-swp-blk-enable', function () {
		const $it = $( this ).closest( '.dc-swp-blk-item' );
		const en  = $( this ).prop( 'checked' );
		$it.toggleClass( 'dc-swp-blk-disabled', ! en );
		patchBlock( $it.data( 'id' ), { enabled: en } );
	} );

	// Delete.
	$( document ).on( 'click', '.dc-swp-blk-del', function () {
		const $it = $( this ).closest( '.dc-swp-blk-item' );
		if ( ! window.confirm( delMsg ) ) return;
		const id = $it.data( 'id' );
		blocks = blocks.filter( function ( b ) { return b.id !== id; } );
		$it.fadeOut( 180, function () { $( this ).remove(); if ( ! blocks.length ) renderList(); } );
	} );

	// Live label edit.
	$( document ).on( 'input', '.dc-swp-blk-label', function () {
		patchBlock( $( this ).closest( '.dc-swp-blk-item' ).data( 'id' ), { label: $( this ).text().trim() } );
	} );

	// Live code edit.
	$( document ).on( 'input', '.dc-swp-blk-code', function () {
		patchBlock( $( this ).closest( '.dc-swp-blk-item' ).data( 'id' ), { code: $( this ).val() } );
	} );

	// Add new block.
	$( '#dc-swp-add-block-btn' ).on( 'click', function () {
		const code  = $.trim( $( '#dc-swp-new-code' ).val() );
		if ( ! code ) {
			$( '#dc-swp-new-code' ).focus().css( 'outline', '2px solid #d63638' );
			setTimeout( function () { $( '#dc-swp-new-code' ).css( 'outline', '' ); }, 1500 );
			return;
		}
		const label = $.trim( $( '#dc-swp-new-label' ).val() ) || ( 'Script Block ' + ( blocks.length + 1 ) );
		const nb    = { id: 'block_' + Date.now(), label: label, code: code, enabled: true };
		blocks.push( nb );
		renderList();
		const $ni = $( '.dc-swp-blk-item[data-id="' + nb.id + '"]' );
		$ni.addClass( 'dc-swp-blk-open' ).find( '.dc-swp-blk-body' ).show();
		$ni.find( '.dc-swp-blk-chevron' ).removeClass( 'dashicons-arrow-right-alt2' ).addClass( 'dashicons-arrow-down-alt2' );
		try { $ni[ 0 ].scrollIntoView( { behavior: 'smooth', block: 'nearest' } ); } catch { /* not supported in all browsers */ }
		$( '#dc-swp-new-label' ).val( '' );
		$( '#dc-swp-new-code' ).val( '' );
	} );

	// Sync to hidden field before form submit.
	$( 'form.pwa-cache-settings' ).on( 'submit', function () {
		$( '.dc-swp-blk-item' ).each( function () {
			const id = $( this ).data( 'id' );
			patchBlock( id, {
				code:    $( this ).find( '.dc-swp-blk-code' ).val(),
				label:   $( this ).find( '.dc-swp-blk-label' ).text().trim(),
				enabled: $( this ).find( '.dc-swp-blk-enable' ).prop( 'checked' ),
			} );
		} );
		$( '#dc_swp_inline_scripts_json' ).val( JSON.stringify( blocks ) );
	} );
}( jQuery ) );
