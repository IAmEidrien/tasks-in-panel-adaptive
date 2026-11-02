#!/usr/bin/env bash
set -euo pipefail
UUID="tasks-in-panel@fthx"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
mkdir -p "$DEST"
cp -a "$SRC_DIR"/. "$DEST"/
if command -v glib-compile-schemas >/dev/null 2>&1; then
  glib-compile-schemas "$DEST/schemas"
fi
echo "Installed $UUID to $DEST"
echo "Disable/re-enable the extension (or restart GNOME Shell/session) to load the fork."
