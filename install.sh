#!/usr/bin/env bash
# KidsLearn - Mac/Linux one-line installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/blueyfamliy/kidslearn/main/install.sh | bash

set -e

REPO="blueyfamliy/kidslearn"
echo ""
echo "  ========================================"
echo "   KidsLearn - Installer"
echo "  ========================================"
echo ""

OS="$(uname -s)"
ARCH="$(uname -m)"

# Resolve the latest release download URL for this OS/arch
api="https://api.github.com/repos/${REPO}/releases/latest"

pick_asset() {
  # $1 = grep pattern for the asset name
  curl -fsSL "$api" \
    | grep -o '"browser_download_url": *"[^"]*"' \
    | sed 's/.*"browser_download_url": *"//;s/"$//' \
    | grep -iE "$1" \
    | head -n 1
}

case "$OS" in
  Darwin)
    echo "[*] Detected macOS ($ARCH)"
    if [ "$ARCH" = "arm64" ]; then
      URL="$(pick_asset 'arm64.*\.dmg$|\.dmg$')"
    else
      URL="$(pick_asset 'x64.*\.dmg$|\.dmg$')"
    fi
    EXT="dmg"
    ;;
  Linux)
    echo "[*] Detected Linux ($ARCH)"
    URL="$(pick_asset '\.AppImage$')"
    EXT="AppImage"
    ;;
  *)
    echo "[X] Unsupported OS: $OS"
    echo "    Download manually from: https://github.com/${REPO}/releases/latest"
    exit 1
    ;;
esac

if [ -z "$URL" ]; then
  echo "[X] Could not find a $EXT build in the latest release."
  echo "    See: https://github.com/${REPO}/releases/latest"
  exit 1
fi

OUT="$HOME/Downloads/KidsLearn.$EXT"
mkdir -p "$HOME/Downloads"
echo "[1/2] Downloading: $URL"
curl -fSL "$URL" -o "$OUT"
echo "      Saved to: $OUT"
echo ""

if [ "$EXT" = "AppImage" ]; then
  chmod +x "$OUT"
  echo "[2/2] Done! Run KidsLearn with:"
  echo "      $OUT"
  echo ""
  echo "  (Double-click it in your file manager, or run the line above.)"
else
  echo "[2/2] Opening the installer..."
  open "$OUT" 2>/dev/null || true
  echo "      Drag KidsLearn into your Applications folder."
  echo ""
  echo "  Note: macOS may warn the app is unsigned. Right-click the app ->"
  echo "        Open -> Open to bypass Gatekeeper the first time."
fi

echo ""
echo "  ========================================"
echo "   Done!"
echo "  ========================================"
