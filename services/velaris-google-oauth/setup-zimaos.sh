#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
if [ ! -s "$ROOT/secrets/google-oauth.json" ]; then
  echo 'ERROR: private secrets/google-oauth.json is missing' >&2
  exit 1
fi
if [ "$(stat -c '%a' "$ROOT/secrets/google-oauth.json")" != "600" ]; then
  echo 'ERROR: set chmod 600 on secrets/google-oauth.json' >&2
  exit 1
fi
mkdir -p "$HERE/data"
sudo chown 10002:10002 "$HERE/data"
sudo chmod 700 "$HERE/data"
sudo docker compose -f "$HERE/compose.yaml" up -d --build
if ! sudo docker inspect velaris-zimaos-web --format '{{json .NetworkSettings.Networks}}' | grep -q 'velaris-google-oauth_default'; then
  sudo docker network connect velaris-google-oauth_default velaris-zimaos-web
fi
echo "OAuth service started; web container connected to private Docker network."
echo "Callback via Tailscale path routing must still be configured separately."
