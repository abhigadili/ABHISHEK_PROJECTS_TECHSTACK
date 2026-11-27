#!/usr/bin/env bash
# Builds every Maven module (common first, then services). Usage: scripts/build.sh [-q]
. "$(dirname "$0")/common.sh"
cd "$ROOT" && mvn ${1:--q} clean install -DskipTests
