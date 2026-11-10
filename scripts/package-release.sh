#!/bin/bash
# Compone lo ZIP da scaricare: Compasso.zxp + installer a doppio clic + istruzioni.
# Uso: scripts/package-release.sh <percorso/Compasso.zxp> [cartella di uscita]
set -euo pipefail
ZXP="${1:?percorso del file .zxp}"
OUT="${2:-release}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/apps/illustrator/package.json').version")"
NAME="Compasso $VERSION"
STAGE="$(mktemp -d)"
DIR="$STAGE/$NAME"

mkdir -p "$DIR" "$OUT"
cp "$ZXP" "$DIR/Compasso.zxp"
cp "$ROOT/installer/"* "$DIR/"
chmod +x "$DIR/"*.command
cp "$ROOT/CHANGELOG.md" "$ROOT/LICENSE.md" "$ROOT/THIRD-PARTY-NOTICES.md" "$DIR/"

OUT_ABS="$(cd "$OUT" && pwd)"
rm -f "$OUT_ABS/Compasso-Windows-macOS.zip"
(cd "$STAGE" && zip -qr -X "$OUT_ABS/Compasso-Windows-macOS.zip" "$NAME")
cp "$ZXP" "$OUT_ABS/Compasso.zxp"
rm -rf "$STAGE"
echo "Creati: $OUT_ABS/Compasso-Windows-macOS.zip e $OUT_ABS/Compasso.zxp ($NAME)"
