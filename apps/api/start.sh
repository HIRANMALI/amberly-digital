#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "================================================"
echo "  Agnes Video Generator"
echo "================================================"
echo ""

VENV_DIR=".venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "[1/3] Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

echo "[2/3] Installing dependencies..."
$VENV_PIP install -q -r requirements.txt

echo "[3/3] Starting service..."
echo ""
echo "  Browser will automatically open http://localhost:8765"
echo "  Press Ctrl+C to stop service"
echo ""

sleep 1

if command -v open &> /dev/null; then
    (sleep 1.5 && open http://localhost:8765) &
elif command -v xdg-open &> /dev/null; then
    (sleep 1.5 && xdg-open http://localhost:8765) &
fi

$VENV_PYTHON server.py