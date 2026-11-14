#!/usr/bin/env bash
# First-time setup for the Velaris YouTube sidecar on ZimaOS.
# Run from any directory: bash services/velaris-youtube-sidecar/setup-zimaos.sh
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

for cmd in openssl sudo docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing prerequisite: $cmd" >&2
    exit 1
  fi
done

if [ -f .env ]; then
  echo "Existing .env found; preserving token and archive path."
  # Allow Docker Compose to read the existing .env without printing secrets.
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  if [ -z "${VELARIS_YOUTUBE_TOKEN:-}" ] || [ "${VELARIS_YOUTUBE_TOKEN}" = "replace-with-a-random-secret" ]; then
    echo "Existing token is missing or insecure; edit .env manually." >&2
    exit 1
  fi
  DATA_DIR="${VELARIS_YOUTUBE_ARCHIVE_PATH:-}"
else
  umask 077
  TOKEN="$(openssl rand -hex 32)"
  DATA_DIR="$HERE/data"
  printf 'VELARIS_YOUTUBE_TOKEN=%s\nVELARIS_YOUTUBE_ARCHIVE_PATH=%s\n' "$TOKEN" "$DATA_DIR" > .env
  echo "Generated private API token in $HERE/.env (not printing it)."
fi

if [ -z "$DATA_DIR" ] || [ "${DATA_DIR#/}" = "$DATA_DIR" ]; then
  echo "Archive path must be an absolute path. Set VELARIS_YOUTUBE_ARCHIVE_PATH in .env." >&2
  exit 1
fi

# Sidecar runs as uid 10001; grant it access to *newly created* directory.
if [ ! -d "$DATA_DIR" ]; then
  sudo install -d -m 0750 -o 10001 -g 10001 -- "$DATA_DIR"
  echo "Created writable archive directory: $DATA_DIR"
else
  echo "Archive directory already exists: $DATA_DIR"
  echo "Ensure Docker user 10001 can write there; existing ownership is not changed."
fi
chmod 600 .env
echo "Building and starting isolated sidecar on 127.0.0.1:8787 ..."
sudo docker compose up -d --build
echo "Inspect status: sudo docker compose ps"
echo "Check health:   curl -fsS http://127.0.0.1:8787/health"
echo "Test token:     bash $HERE/test-zimaos.sh"
