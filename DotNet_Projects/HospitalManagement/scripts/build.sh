#!/usr/bin/env bash
# Publishes all projects (Release) to .publish/<Project>/
source "$(dirname "$0")/common.sh"
cd "$ROOT"
for entry in "${SERVICES[@]}" "$GATEWAY"; do
  IFS=: read -r name proj port db <<< "$entry"
  dotnet publish "src/$proj/$proj.csproj" -c Release -o "$PUBLISH_DIR/$proj" --nologo -v q 2>&1 | grep -E "error|rror CS" ; [ -f "$PUBLISH_DIR/$proj/$proj.dll" ] && echo "published $proj" || { echo "FAILED $proj"; exit 1; }
done
