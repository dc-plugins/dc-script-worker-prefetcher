#!/usr/bin/env bash
# scripts/update-partytown.sh
# ---------------------------------------------------------------
# Vendor the latest (or a pinned) @builder.io/partytown lib build
# into assets/partytown/ and update the version in package.json.
#
# Usage:
#   bash scripts/update-partytown.sh            # latest
#   bash scripts/update-partytown.sh 0.10.3     # pinned version
# ---------------------------------------------------------------
set -euo pipefail

DEST="assets/partytown"
PKG="package.json"

# ── Resolve target version ────────────────────────────────────
if [ -n "${1:-}" ]; then
  VERSION="$1"
else
  echo "→ Fetching latest @builder.io/partytown version from npm…"
  VERSION=$(curl -fsSL "https://registry.npmjs.org/@builder.io/partytown/latest" \
    | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo "→ Target version: $VERSION"

# ── Compare to currently vendored version ─────────────────────
CURRENT=$(grep -o '"@builder.io/partytown": "[^"]*"' "$PKG" 2>/dev/null \
          | cut -d'"' -f4 || echo "none")
if [ "$CURRENT" = "$VERSION" ]; then
  echo "✓ Already at $VERSION — nothing to do."
  exit 0
fi

# ── Download & extract tarball ────────────────────────────────
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "→ Downloading partytown-${VERSION}.tgz…"
curl -fsSL "https://registry.npmjs.org/@builder.io/partytown/-/partytown-${VERSION}.tgz" \
  -o "$TMP/partytown.tgz"

echo "→ Extracting lib/ files…"
mkdir -p "$TMP/pkg"
tar -xzf "$TMP/partytown.tgz" -C "$TMP/pkg" --strip-components=1

# ── Copy the lib/ tree into assets/partytown/ ─────────────────
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$TMP/pkg/lib/." "$DEST/"
echo "→ Copied lib/ → $DEST/"

# ── Bump version in package.json vendored block ───────────────
# Uses sed to replace ONLY the vendored entry (not plugin version)
sed -i.bak "s|\"@builder.io/partytown\": \"${CURRENT}\"|\"@builder.io/partytown\": \"${VERSION}\"|g" "$PKG"
rm -f "$PKG.bak"
echo "→ package.json updated: $CURRENT → $VERSION"

echo ""
echo "✅ Partytown $VERSION vendored in $DEST/"
echo "   Commit with:"
echo "     git add assets/partytown package.json"
echo "     git commit -m \"chore: vendor partytown $VERSION\""
