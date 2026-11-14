#!/usr/bin/env bash
# Sidecar smoke tests: connectivity + authentication + optional video metadata.
# Usage: bash test-zimaos.sh [11-character-video-id]
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
[ -f .env ] || { echo "Missing .env: run setup-zimaos.sh first" >&2; exit 1; }

# Secret never appears in printed commands or HTTP responses.
TOKEN="$(sed -n 's/^VELARIS_YOUTUBE_TOKEN=//p' .env | head -n 1)"
if [ -z "$TOKEN" ] || [ "$TOKEN" = "replace-with-a-random-secret" ]; then
  echo "No valid token in .env" >&2
  exit 1
fi

BASE="http://127.0.0.1:8787"
echo "1/4 Checking health ..."
curl --fail --silent --show-error --max-time 15 "$BASE/health"
printf '\n'

echo "2/4 Checking that anonymous access is blocked (expect 401) ..."
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$BASE/library")"
if [ "$code" != "401" ]; then
  echo "FAIL: anonymous API returned HTTP $code (expected 401)" >&2
  exit 1
fi
echo "PASS: HTTP 401"

echo "3/4 Checking authorized library access ..."
curl --fail --silent --show-error --max-time 15 \
  -H "Authorization: Bearer $TOKEN" "$BASE/library"
printf '\n'

echo "4/4 Checking validation of unknown video IDs (expect 422) ..."
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 \
  -H "Authorization: Bearer $TOKEN" "$BASE/videos/invalid")"
if [ "$code" != "422" ]; then
  echo "FAIL: invalid ID returned HTTP $code (expected 422)" >&2
  exit 1
fi
echo "PASS: HTTP 422"

if [ -n "${1:-}" ]; then
  echo "Optional live YouTube metadata test for video ID: $1"
  curl --fail --silent --show-error --max-time 90 \
    -H "Authorization: Bearer $TOKEN" "$BASE/videos/$1"
  printf '\n'
fi

echo "Sidecar smoke tests passed."
