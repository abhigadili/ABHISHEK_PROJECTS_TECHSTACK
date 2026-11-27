#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
cd "$ROOT" && mvn -q -DskipTests clean package && echo "build OK"
