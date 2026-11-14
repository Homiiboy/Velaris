#!/usr/bin/env bash
# Build Jellyfin 10.11.11 / .NET 9 Velaris YouTube plugin in an isolated SDK container.
# Does NOT install into or restart Jellyfin.
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$HERE/build"
echo "Building Velaris YouTube plugin against Jellyfin 10.11.11 ..."
sudo docker run --rm \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$HERE,target=/src" \
  -w /src \
  -e DOTNET_CLI_HOME=/tmp/dotnet-cli \
  -e NUGET_PACKAGES=/tmp/nuget \
  -e DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
  mcr.microsoft.com/dotnet/sdk:9.0 \
  dotnet publish Velaris.YouTube.csproj --configuration Release \
  --property:JellyfinVersion=10.11.11 \
  --output /src/build
if [ ! -s "$HERE/build/Velaris.YouTube.dll" ]; then
  echo "FAIL: no Velaris.YouTube.dll artifact found" >&2
  exit 1
fi
echo "PASS: Jellyfin plugin compiled successfully."
echo "DLL: $HERE/build/Velaris.YouTube.dll"
echo "Not installed. Jellyfin remains untouched."
