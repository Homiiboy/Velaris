#!/usr/bin/env bash
# Configure an already installed Velaris YouTube 0.2.0 plugin for Jellyfin.
# Reads the private sidecar .env locally and never prints its token.
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$HERE/../.." && pwd)"
SIDECAR_ENV="$ROOT/services/velaris-youtube-sidecar/.env"
CONFIG_DIR="/DATA/AppData/jellyfin/config/data/plugins/configurations"
CONFIG_FILE="$CONFIG_DIR/Velaris.YouTube.xml"

if [ ! -f "$SIDECAR_ENV" ]; then
  echo "FAIL: sidecar .env not found. Run sidecar setup first." >&2
  exit 1
fi
if [ ! -d "$CONFIG_DIR" ]; then
  echo "FAIL: Jellyfin plugin configuration directory missing: $CONFIG_DIR" >&2
  exit 1
fi
if [ -e "$CONFIG_FILE" ]; then
  echo "Configuration already exists at $CONFIG_FILE; refusing to overwrite it." >&2
  echo "Review or back up the existing file locally before changing its values." >&2
  exit 1
fi

echo "Preparing server-only Velaris YouTube configuration (token hidden) ..."
# Create in a root-owned temporary file, then install with Jellyfin user permissions.
# Use only Python standard library; never put the secret in argv or command output.
tmp="$(mktemp)"
trap 'rm -f -- "$tmp"' EXIT
python3 - "$SIDECAR_ENV" "$tmp" <<'PY'
import pathlib
import sys
import xml.etree.ElementTree as ET

path = pathlib.Path(sys.argv[1])
values = [
    line.split("=", 1)[1].strip().strip('"').strip("'")
    for line in path.read_text(encoding="utf-8").splitlines()
    if line.startswith("VELARIS_YOUTUBE_TOKEN=")
]
if len(values) != 1 or len(values[0]) < 32:
    raise SystemExit("FAIL: private sidecar token missing or too short")

config = ET.Element("PluginConfiguration")
ET.SubElement(config, "SidecarBaseUrl").text = "http://velaris-youtube-sidecar:8787"
ET.SubElement(config, "SidecarApiToken").text = values[0]
ET.SubElement(config, "EnableDownloads").text = "false"
ET.SubElement(config, "ArchiveLibraryPath").text = "/media/youtube"
ET.ElementTree(config).write(sys.argv[2], encoding="utf-8", xml_declaration=True)
PY

sudo install -o 1000 -g 1000 -m 600 "$tmp" "$CONFIG_FILE"
echo "PASS: plugin configuration created at $CONFIG_FILE"
echo "The sidecar API token was not printed."
echo "Restart Jellyfin to load the configuration:"
echo "  sudo docker restart jellyfin"
