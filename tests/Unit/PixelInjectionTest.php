<?php

namespace DC_SW_Proxy\Tests\Unit;

/**
 * Tests for the Facebook / Meta Pixel implementation.
 *
 * Covers:
 *  - dc_swp_is_valid_pixel_id()        — ID format validation
 *  - dc_swp_inject_pixel_head()        — full head injection (mode, ID, LDU, consent)
 *  - dc_swp_inject_meta_ldu_default()  — legacy LDU stub (mode guard)
 */
class PixelInjectionTest extends TestCase {

	// -----------------------------------------------------------------------
	// dc_swp_is_valid_pixel_id() — validation
	// -----------------------------------------------------------------------

	public function test_valid_pixel_id_10_digits(): void {
		$this->assertTrue( dc_swp_is_valid_pixel_id( '1234567890' ) );
	}

	public function test_valid_pixel_id_15_digits(): void {
		$this->assertTrue( dc_swp_is_valid_pixel_id( '123456789012345' ) );
	}

	public function test_valid_pixel_id_20_digits(): void {
		$this->assertTrue( dc_swp_is_valid_pixel_id( '12345678901234567890' ) );
	}

	public function test_invalid_pixel_id_9_digits(): void {
		$this->assertFalse( dc_swp_is_valid_pixel_id( '123456789' ) );
	}

	public function test_invalid_pixel_id_21_digits(): void {
		$this->assertFalse( dc_swp_is_valid_pixel_id( '123456789012345678901' ) );
	}

	public function test_invalid_pixel_id_with_letters(): void {
		$this->assertFalse( dc_swp_is_valid_pixel_id( '1234567abc' ) );
	}

	public function test_invalid_pixel_id_with_hyphens(): void {
		$this->assertFalse( dc_swp_is_valid_pixel_id( '1234-5678-90' ) );
	}

	public function test_invalid_pixel_id_with_spaces(): void {
		$this->assertFalse( dc_swp_is_valid_pixel_id( '1234567890 ' ) );
	}

	public function test_invalid_pixel_id_empty_string(): void {
		$this->assertFalse( dc_swp_is_valid_pixel_id( '' ) );
	}

	// -----------------------------------------------------------------------
	// dc_swp_inject_pixel_head() — early-return guards
	// -----------------------------------------------------------------------

	/** Helper: capture output of dc_swp_inject_pixel_head(). */
	private function capturePixelHead(): string {
		ob_start();
		dc_swp_inject_pixel_head();
		return (string) ob_get_clean();
	}

	public function test_inject_pixel_head_silent_when_mode_is_off(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', 'off' );
		$this->setOption( 'dc_swp_pixel_id', '1234567890' );

		$this->assertSame( '', $this->capturePixelHead() );
	}

	public function test_inject_pixel_head_silent_when_sw_disabled(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'no' );
		$this->setOption( 'dc_swp_pixel_mode', 'own' );
		$this->setOption( 'dc_swp_pixel_id', '1234567890' );

		$this->assertSame( '', $this->capturePixelHead() );
	}

	public function test_inject_pixel_head_silent_when_pixel_id_empty(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', 'own' );
		$this->setOption( 'dc_swp_pixel_id', '' );

		$this->assertSame( '', $this->capturePixelHead() );
	}

	public function test_inject_pixel_head_silent_when_pixel_id_invalid(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', 'own' );
		$this->setOption( 'dc_swp_pixel_id', '123abc' );

		$this->assertSame( '', $this->capturePixelHead() );
	}

	// -----------------------------------------------------------------------
	// dc_swp_inject_pixel_head() — output structure (mode = own)
	// -----------------------------------------------------------------------

	private function setActivePixel( string $mode = 'own', string $id = '1234567890' ): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', $mode );
		$this->setOption( 'dc_swp_pixel_id', $id );
	}

	public function test_inject_pixel_head_emits_fbq_stub(): void {
		$this->setActivePixel();

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( 'window.fbq=window.fbq||function()', $output );
		$this->assertStringContainsString( "window.fbq.version='2.0'", $output );
	}

	public function test_inject_pixel_head_emits_partytown_fbevents_script(): void {
		$this->setActivePixel();

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( 'type="text/partytown"', $output );
		$this->assertStringContainsString( 'connect.facebook.net/en_US/fbevents.js', $output );
	}

	public function test_inject_pixel_head_emits_init_and_pageview(): void {
		$this->setActivePixel( 'own', '1234567890' );

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( "fbq('init','1234567890')", $output );
		$this->assertStringContainsString( "fbq('track','PageView')", $output );
	}

	public function test_inject_pixel_head_works_for_detect_mode(): void {
		$this->setActivePixel( 'detect', '9876543210' );

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( "fbq('init','9876543210')", $output );
		$this->assertStringContainsString( 'text/partytown', $output );
	}

	public function test_inject_pixel_head_works_for_managed_mode(): void {
		$this->setActivePixel( 'managed', '9876543210' );

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( "fbq('init','9876543210')", $output );
		$this->assertStringContainsString( 'text/partytown', $output );
	}

	// -----------------------------------------------------------------------
	// dc_swp_inject_pixel_head() — LDU / consent signal combinations
	// -----------------------------------------------------------------------

	public function test_ldu_unconditional_when_no_consent_gate(): void {
		$this->setActivePixel();
		$this->setOption( 'dc_swp_meta_ldu', 'yes' );
		// Consent gate off (default) — LDU is emitted regardless.

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( "fbq('dataProcessingOptions',['LDU'],0,0)", $output );
		$this->assertStringNotContainsString( "fbq('consent'", $output );
	}

	public function test_no_ldu_signals_when_ldu_off_and_no_consent_gate(): void {
		$this->setActivePixel();
		$this->setOption( 'dc_swp_meta_ldu', 'no' );

		$output = $this->capturePixelHead();

		$this->assertStringNotContainsString( 'dataProcessingOptions', $output );
		$this->assertStringNotContainsString( "fbq('consent'", $output );
	}

	public function test_consent_gate_grants_consent_when_marketing_allowed(): void {
		$this->setActivePixel();
		$this->setOption( 'dc_swp_meta_ldu', 'no' );
		$this->setOption( 'dc_swp_consent_gate', 'yes' );
		$this->setConsent( 'marketing', true );

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( "fbq('consent','grant')", $output );
		$this->assertStringNotContainsString( "fbq('consent','revoke')", $output );
		$this->assertStringNotContainsString( 'dataProcessingOptions', $output );
	}

	public function test_consent_gate_revokes_consent_when_marketing_denied(): void {
		$this->setActivePixel();
		$this->setOption( 'dc_swp_meta_ldu', 'no' );
		$this->setOption( 'dc_swp_consent_gate', 'yes' );
		$this->setConsent( 'marketing', false );

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( "fbq('consent','revoke')", $output );
		$this->assertStringNotContainsString( "fbq('consent','grant')", $output );
		$this->assertStringNotContainsString( 'dataProcessingOptions', $output );
	}

	public function test_consent_gate_plus_ldu_emits_ldu_on_grant(): void {
		$this->setActivePixel();
		$this->setOption( 'dc_swp_meta_ldu', 'yes' );
		$this->setOption( 'dc_swp_consent_gate', 'yes' );
		$this->setConsent( 'marketing', true );

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( "fbq('consent','grant')", $output );
		// LDU with empty geo signals (0,0) when LDU is on AND consent granted.
		$this->assertStringContainsString( "fbq('dataProcessingOptions',[],0,0)", $output );
	}

	public function test_consent_gate_plus_ldu_emits_ldu_on_revoke(): void {
		$this->setActivePixel();
		$this->setOption( 'dc_swp_meta_ldu', 'yes' );
		$this->setOption( 'dc_swp_consent_gate', 'yes' );
		$this->setConsent( 'marketing', false );

		$output = $this->capturePixelHead();

		$this->assertStringContainsString( "fbq('consent','revoke')", $output );
		$this->assertStringContainsString( "fbq('dataProcessingOptions',['LDU'],0,0)", $output );
	}

	// -----------------------------------------------------------------------
	// dc_swp_inject_meta_ldu_default() — mode guard
	// -----------------------------------------------------------------------

	private function captureLduDefault(): string {
		ob_start();
		dc_swp_inject_meta_ldu_default();
		return (string) ob_get_clean();
	}

	public function test_ldu_default_fires_when_mode_off_and_ldu_on(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', 'off' );
		$this->setOption( 'dc_swp_meta_ldu', 'yes' );

		$output = $this->captureLduDefault();

		$this->assertStringContainsString( "fbq('dataProcessingOptions',['LDU'],0,0)", $output );
	}

	public function test_ldu_default_silent_when_mode_is_own(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', 'own' );
		$this->setOption( 'dc_swp_meta_ldu', 'yes' );

		$this->assertSame( '', $this->captureLduDefault() );
	}

	public function test_ldu_default_silent_when_mode_is_detect(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', 'detect' );
		$this->setOption( 'dc_swp_meta_ldu', 'yes' );

		$this->assertSame( '', $this->captureLduDefault() );
	}

	public function test_ldu_default_silent_when_mode_is_managed(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', 'managed' );
		$this->setOption( 'dc_swp_meta_ldu', 'yes' );

		$this->assertSame( '', $this->captureLduDefault() );
	}

	public function test_ldu_default_silent_when_mode_off_but_ldu_off_and_no_gate(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'yes' );
		$this->setOption( 'dc_swp_pixel_mode', 'off' );
		$this->setOption( 'dc_swp_meta_ldu', 'no' );
		// consent gate also off (default)

		$this->assertSame( '', $this->captureLduDefault() );
	}
}
