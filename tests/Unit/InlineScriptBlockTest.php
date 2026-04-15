<?php

namespace DC_SW_Proxy\Tests\Unit;

/**
 * Tests for the "Disable for logged-in users" guard in dc_swp_output_inline_scripts().
 *
 * The function reads dc_swp_inline_scripts from the options store, loops over
 * enabled blocks, and skips any block where skip_logged_in=true and the current
 * visitor is logged in. These tests verify that guard without exercising the full
 * Partytown / consent pipeline (Partytown is disabled so output is the simple
 * defer path, making assertions straightforward).
 */
class InlineScriptBlockTest extends TestCase {

	/** Build a minimal valid block JSON string. */
	private function makeBlocks( array $overrides = array() ): string {
		$block = array_merge(
			array(
				'id'              => 'test-block',
				'label'           => 'Test',
				'code'            => '<script>console.log("hello");</script>',
				'enabled'         => true,
				'force_partytown' => false,
				'skip_logged_in'  => false,
				'category'        => 'marketing',
			),
			$overrides
		);
		return (string) wp_json_encode( array( $block ) );
	}

	/** Capture output of dc_swp_output_inline_scripts(). */
	private function capture(): string {
		ob_start();
		dc_swp_output_inline_scripts();
		return (string) ob_get_clean();
	}

	// -----------------------------------------------------------------------
	// skip_logged_in = false (default) — block always fires
	// -----------------------------------------------------------------------

	public function test_block_fires_for_anonymous_user_when_skip_is_off(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'no' ); // Partytown off — simple output path.
		$this->setOption( 'dc_swp_inline_scripts', $this->makeBlocks( array( 'skip_logged_in' => false ) ) );
		$this->setLoggedIn( false );

		$this->assertStringContainsString( 'console.log("hello")', $this->capture() );
	}

	public function test_block_fires_for_logged_in_user_when_skip_is_off(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'no' );
		$this->setOption( 'dc_swp_inline_scripts', $this->makeBlocks( array( 'skip_logged_in' => false ) ) );
		$this->setLoggedIn( true );

		$this->assertStringContainsString( 'console.log("hello")', $this->capture() );
	}

	// -----------------------------------------------------------------------
	// skip_logged_in = true — suppressed for logged-in, fires for anonymous
	// -----------------------------------------------------------------------

	public function test_block_suppressed_for_logged_in_user_when_skip_is_on(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'no' );
		$this->setOption( 'dc_swp_inline_scripts', $this->makeBlocks( array( 'skip_logged_in' => true ) ) );
		$this->setLoggedIn( true );

		$this->assertSame( '', $this->capture() );
	}

	public function test_block_fires_for_anonymous_user_when_skip_is_on(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'no' );
		$this->setOption( 'dc_swp_inline_scripts', $this->makeBlocks( array( 'skip_logged_in' => true ) ) );
		$this->setLoggedIn( false );

		$this->assertStringContainsString( 'console.log("hello")', $this->capture() );
	}

	// -----------------------------------------------------------------------
	// Interaction with enabled flag — both guards are independent
	// -----------------------------------------------------------------------

	public function test_disabled_block_is_suppressed_regardless_of_skip_flag(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'no' );
		$this->setOption( 'dc_swp_inline_scripts', $this->makeBlocks( array( 'enabled' => false, 'skip_logged_in' => false ) ) );
		$this->setLoggedIn( false );

		$this->assertSame( '', $this->capture() );
	}

	// -----------------------------------------------------------------------
	// Multiple blocks — only the flagged one is suppressed
	// -----------------------------------------------------------------------

	public function test_only_flagged_block_is_suppressed_for_logged_in_user(): void {
		$this->setOption( 'dc_swp_sw_enabled', 'no' );
		$blocks = array(
			array(
				'id'              => 'block-a',
				'label'           => 'A',
				'code'            => '<script>console.log("always");</script>',
				'enabled'         => true,
				'force_partytown' => false,
				'skip_logged_in'  => false,
				'category'        => 'marketing',
			),
			array(
				'id'              => 'block-b',
				'label'           => 'B',
				'code'            => '<script>console.log("logged-out-only");</script>',
				'enabled'         => true,
				'force_partytown' => false,
				'skip_logged_in'  => true,
				'category'        => 'marketing',
			),
		);
		$this->setOption( 'dc_swp_inline_scripts', (string) wp_json_encode( $blocks ) );
		$this->setLoggedIn( true );

		$output = $this->capture();

		$this->assertStringContainsString( 'console.log("always")', $output );
		$this->assertStringNotContainsString( 'console.log("logged-out-only")', $output );
	}
}
