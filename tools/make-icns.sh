#!/bin/bash
# Convert build/icon.png (1024x1024) into build/icon.icns for the app bundle.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="build/icon.png"
SET="build/icon.iconset"

if [ ! -f "$SRC" ]; then
  echo "missing $SRC — run 'npm run icon' first" >&2
  exit 1
fi

rm -rf "$SET"
mkdir -p "$SET"

sips -z 16 16     "$SRC" --out "$SET/icon_16x16.png"      >/dev/null
sips -z 32 32     "$SRC" --out "$SET/icon_16x16@2x.png"   >/dev/null
sips -z 32 32     "$SRC" --out "$SET/icon_32x32.png"      >/dev/null
sips -z 64 64     "$SRC" --out "$SET/icon_32x32@2x.png"   >/dev/null
sips -z 128 128   "$SRC" --out "$SET/icon_128x128.png"    >/dev/null
sips -z 256 256   "$SRC" --out "$SET/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$SRC" --out "$SET/icon_256x256.png"    >/dev/null
sips -z 512 512   "$SRC" --out "$SET/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$SRC" --out "$SET/icon_512x512.png"    >/dev/null
sips -z 1024 1024 "$SRC" --out "$SET/icon_512x512@2x.png" >/dev/null

iconutil -c icns "$SET" -o build/icon.icns
rm -rf "$SET"
echo "wrote build/icon.icns"
